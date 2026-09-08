import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const hostDir = dirname(fileURLToPath(import.meta.url));
const libScript = join(hostDir, "lib.sh");

const currentUser = userInfo().username;
const currentGroup = spawnSync("id", ["-gn"], {
  encoding: "utf8",
}).stdout.trim();

const gitEnv = {
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.com",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};

const git = (cwd, ...args) => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...gitEnv },
  });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
};

const runLib = (command, env = {}) =>
  spawnSync("bash", ["-c", `set -euo pipefail; source "${libScript}"; ${command}`], {
    encoding: "utf8",
    env: { ...process.env, ...gitEnv, ...env },
  });

// A bare "remote" plus a clone of it, standing in for GitHub.
const makeCheckout = async (root, branch = "main") => {
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const checkout = join(root, "checkout");

  spawnSync("git", ["init", "--bare", "--initial-branch", branch, remote], {
    env: { ...process.env, ...gitEnv },
  });
  spawnSync("git", ["init", "--initial-branch", branch, seed], {
    env: { ...process.env, ...gitEnv },
  });
  await writeFile(join(seed, "file.txt"), "one\n");
  git(seed, "add", ".");
  git(seed, "commit", "-m", "one");
  git(seed, "remote", "add", "origin", remote);
  git(seed, "push", "-u", "origin", branch);

  spawnSync("git", ["clone", remote, checkout], {
    env: { ...process.env, ...gitEnv },
  });

  return { remote, seed, checkout, branch };
};

const stateEnv = (root) => ({
  SYMPHONY_BOOTSTRAP_STATE_DIR: join(root, "state"),
  SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
});

test("state values survive a round trip through the install-state file", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-state-"));

  try {
    const write = runLib(
      `state_set SYMPHONY_TEST_VALUE "spaces and 'quotes'"`,
      stateEnv(root)
    );
    assert.equal(write.status, 0, write.stderr);

    const read = runLib(
      `printf '%s\\n' "$SYMPHONY_TEST_VALUE"`,
      stateEnv(root)
    );
    assert.equal(read.status, 0, read.stderr);
    assert.equal(read.stdout.trim(), "spaces and 'quotes'");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("state_set replaces rather than appends a repeated key", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-state-replace-"));

  try {
    runLib(`state_set SYMPHONY_TEST_VALUE first`, stateEnv(root));
    runLib(`state_set SYMPHONY_TEST_VALUE second`, stateEnv(root));

    const contents = await readFile(
      join(root, "state", "install-state.env"),
      "utf8"
    );
    assert.equal(contents.match(/^SYMPHONY_TEST_VALUE=/gm).length, 1);

    const read = runLib(
      `printf '%s\\n' "$SYMPHONY_TEST_VALUE"`,
      stateEnv(root)
    );
    assert.equal(read.stdout.trim(), "second");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("state_load ignores malformed install-state lines", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-state-malformed-"));

  try {
    await mkdir(join(root, "state"), { recursive: true });
    await writeFile(
      join(root, "state", "install-state.env"),
      "SYMPHONY_BAD='\nSYMPHONY_TEST_VALUE='ok'\n"
    );

    const read = runLib(
      `printf '%s\\n' "$SYMPHONY_TEST_VALUE"`,
      stateEnv(root)
    );
    assert.equal(read.status, 0, read.stderr);
    assert.equal(read.stdout.trim(), "ok");
    assert.match(
      read.stderr,
      /ignoring malformed install-state line for SYMPHONY_BAD/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("parses worker slots with default and fail-closed invalid values", () => {
  const valid = runLib(`parse_worker_slots ''; parse_worker_slots 12`);
  assert.equal(valid.status, 0, valid.stderr);
  assert.deepEqual(valid.stdout.trim().split("\n"), ["6", "12"]);

  const invalid = runLib(`parse_worker_slots many`);
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /invalid symphony:worker-slots tag/);

  const outOfRange = runLib(`parse_worker_slots 0`);
  assert.notEqual(outOfRange.status, 0);
  assert.match(outOfRange.stderr, /must be between 1 and 64/);
});

test("sha256_tree hashes regular file bytes in sorted path order", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-tree-sha-"));
  const source = join(root, "source");

  try {
    await mkdir(join(source, "nested"), { recursive: true });
    await writeFile(join(source, "b.txt"), "two");
    await writeFile(join(source, "nested", "a.txt"), "one");

    const result = runLib(`sha256_tree "${source}"`, stateEnv(root));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      createHash("sha256").update("twoone").digest("hex"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime bundle freshness check compares bundle content under lock", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-bundle-fresh-"));
  const codexHome = join(root, "codex-home");
  const source = join(root, "runtime-bundle");
  const lockPath = join(root, "runtime-bundle.lock");
  const bundleSha = createHash("sha256").update("bundle v1").digest("hex");
  const env = {
    ...stateEnv(root),
    SYMPHONY_CODEX_HOME: codexHome,
    SYMPHONY_RUNTIME_BUNDLE_SOURCE_DIR: source,
    SYMPHONY_RUNTIME_GROUP: currentGroup,
    SYMPHONY_RUNTIME_USER: currentUser,
    SYMPHONY_RUNTIME_BUNDLE_LOCK_PATH: lockPath,
  };

  try {
    await mkdir(codexHome, { recursive: true });
    await mkdir(source, { recursive: true });
    await writeFile(join(source, "bundle.txt"), "bundle v1");
    await writeFile(
      join(codexHome, "runtime-bundle-manifest.json"),
      JSON.stringify({
        repo: { sha: "older-repo-sha" },
        bundle: { sha256: bundleSha },
      }),
    );

    const fresh = runLib(`runtime_bundle_fresh_for_source`, env);
    assert.equal(fresh.status, 0, fresh.stderr);

    await writeFile(join(source, "bundle.txt"), "bundle v2");
    const stale = runLib(`runtime_bundle_fresh_for_source`, env);
    assert.notEqual(stale.status, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("markers are recorded and detected", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-marker-"));

  try {
    const absent = runLib(`marker_present beam-1 && echo yes || echo no`, stateEnv(root));
    assert.equal(absent.stdout.trim(), "no");

    const present = runLib(
      `marker_record beam-1; marker_present beam-1 && echo yes || echo no`,
      stateEnv(root)
    );
    assert.equal(present.stdout.trim(), "yes");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("sync_checkout lands a branch ref on the branch, not a detached HEAD", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-sync-clean-"));

  try {
    const { checkout, seed, branch, remote } = await makeCheckout(root);

    await writeFile(join(seed, "file.txt"), "two\n");
    git(seed, "commit", "-am", "two");
    git(seed, "push", "origin", branch);
    const expected = git(seed, "rev-parse", "HEAD");

    const result = runLib(
      `sync_checkout "${checkout}" "${branch}" SYMPHONY_TEST`,
      stateEnv(root)
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(git(checkout, "rev-parse", "HEAD"), expected);
    // On the branch, so a host-side fix can be committed and pushed.
    assert.equal(git(checkout, "rev-parse", "--abbrev-ref", "HEAD"), branch);
    assert.ok(remote);

    const state = runLib(
      `printf '%s|%s\\n' "$SYMPHONY_TEST_STASHED" "$SYMPHONY_TEST_BACKUP_BRANCH"`,
      stateEnv(root)
    );
    assert.equal(state.stdout.trim(), "0|");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// Converge anyway, but stash rather than discard: sitting on stale code is the
// worse failure, because nobody notices it.
test("sync_checkout stashes an uncommitted working tree and still installs the ref", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-sync-dirty-"));

  try {
    const { checkout, seed, branch } = await makeCheckout(root);

    await writeFile(join(seed, "file.txt"), "remote moved on\n");
    git(seed, "commit", "-am", "two");
    git(seed, "push", "origin", branch);
    const expected = git(seed, "rev-parse", "HEAD");

    await writeFile(join(checkout, "file.txt"), "local edit in progress\n");
    await writeFile(join(checkout, "untracked.txt"), "also mine\n");

    const result = runLib(
      `sync_checkout "${checkout}" "${branch}" SYMPHONY_TEST`,
      stateEnv(root)
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /stashed as 'symphony-bootstrap/);

    // The requested ref is what runs.
    assert.equal(git(checkout, "rev-parse", "HEAD"), expected);
    assert.equal(await readFile(join(checkout, "file.txt"), "utf8"), "remote moved on\n");

    // The work is recoverable, tracked and untracked alike.
    assert.match(git(checkout, "stash", "list"), /symphony-bootstrap/);
    assert.match(
      git(checkout, "stash", "show", "--include-untracked", "--name-only", "stash@{0}"),
      /untracked\.txt/
    );

    const state = runLib(
      `printf '%s\\n' "$SYMPHONY_TEST_STASHED"`,
      stateEnv(root)
    );
    assert.equal(state.stdout.trim(), "1");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// The "fix a bug on the host and commit it" case: the tree is clean, so a
// status check alone would let checkout -B reset the commit away.
test("sync_checkout parks committed-but-unpushed work on a branch and still installs the ref", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-sync-ahead-"));

  try {
    const { checkout, seed, branch } = await makeCheckout(root);

    await writeFile(join(seed, "file.txt"), "remote moved on\n");
    git(seed, "commit", "-am", "remote change");
    git(seed, "push", "origin", branch);
    const expected = git(seed, "rev-parse", "HEAD");

    await writeFile(join(checkout, "file.txt"), "host-side fix\n");
    git(checkout, "commit", "-am", "host-side fix");
    const localCommit = git(checkout, "rev-parse", "HEAD");

    assert.equal(git(checkout, "status", "--porcelain"), "");

    const result = runLib(
      `sync_checkout "${checkout}" "${branch}" SYMPHONY_TEST`,
      stateEnv(root)
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /preserved on branch host-local\//);
    assert.equal(git(checkout, "rev-parse", "HEAD"), expected);

    const backup = runLib(
      `printf '%s\\n' "$SYMPHONY_TEST_BACKUP_BRANCH"`,
      stateEnv(root)
    ).stdout.trim();
    assert.match(backup, /^host-local\//);
    assert.equal(git(checkout, "rev-parse", backup), localCommit);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("sync_checkout leaves ignored build output alone while stashing", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-sync-ignored-"));

  try {
    const { checkout, seed, branch } = await makeCheckout(root);

    await writeFile(join(seed, ".gitignore"), "/_build/\n");
    git(seed, "add", ".");
    git(seed, "commit", "-m", "ignore build output");
    git(seed, "push", "origin", branch);
    git(checkout, "pull", "origin", branch);

    await mkdir(join(checkout, "_build"), { recursive: true });
    await writeFile(join(checkout, "_build", "artifact"), "expensive\n");
    await writeFile(join(checkout, "file.txt"), "dirty\n");

    const result = runLib(
      `sync_checkout "${checkout}" "${branch}" SYMPHONY_TEST`,
      stateEnv(root)
    );

    assert.equal(result.status, 0, result.stderr);
    // Incremental rebuilds depend on this surviving.
    assert.equal(
      await readFile(join(checkout, "_build", "artifact"), "utf8"),
      "expensive\n"
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("sync_checkout detaches for a ref that is not a branch", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-sync-tag-"));

  try {
    const { checkout, seed, branch } = await makeCheckout(root);
    const tagged = git(seed, "rev-parse", "HEAD");
    git(seed, "tag", "v1");
    git(seed, "push", "origin", "v1");

    await writeFile(join(seed, "file.txt"), "later\n");
    git(seed, "commit", "-am", "later");
    git(seed, "push", "origin", branch);

    const result = runLib(
      `sync_checkout "${checkout}" v1 SYMPHONY_TEST`,
      stateEnv(root)
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(git(checkout, "rev-parse", "HEAD"), tagged);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
