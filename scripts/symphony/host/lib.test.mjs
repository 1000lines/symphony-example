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

test("App materializer keeps provider/Linear credentials with no PAT and installs renewable gh/askpass", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-app-materializer-"));
  try {
    const stateDir = join(root, "state"), configDir = join(root, "config"), workspace = join(root, "workspace"), secrets = join(root, "secrets");
    await mkdir(join(secrets, "symphony", "github-apps"), { recursive: true });
    await mkdir(stateDir); await mkdir(configDir);
    const provider = "fixture-openai", linear = "fixture-linear";
    const keys = JSON.stringify({ OPENAI_API_KEY: provider, LINEAR_API_TOKEN: linear, UNRELATED_FIELD: "preserved" });
    await writeFile(join(secrets, "symphony", "keys"), keys);
    await writeFile(join(secrets, "symphony", "github-apps", "symphony"), JSON.stringify({
      appId: 4866508, appSlug: "1000lines-symphony", installationId: 101, repositoryId: 123, repository: "example/repo",
      privateKey: "-----BEGIN PRIVATE KEY-----\nfixture-offline-only\n-----END PRIVATE KEY-----", permissions: { contents: "write" },
    }));
    const noNodeBin = join(root, "without-node");
    await mkdir(noNodeBin);
    await writeFile(join(noNodeBin, "node"), "#!/bin/sh\nexit 97\n", { mode: 0o700 });
    const env = { PATH: `${noNodeBin}:${process.env.PATH}`, SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1", SYMPHONY_SECRETS_DIR: secrets,
      SYMPHONY_BOOTSTRAP_STATE_DIR: stateDir, SYMPHONY_CONFIG_DIR: configDir, SYMPHONY_WORKSPACE_ROOT: workspace,
      SYMPHONY_RUNTIME_USER: currentUser, SYMPHONY_RUNTIME_GROUP: currentGroup, SYMPHONY_WORKER_SLOTS: "1",
      SYMPHONY_GITHUB_AUTH_MODE: "app", SYMPHONY_GIT_AUTHOR_EMAIL: "123+1000lines-symphony[bot]@users.noreply.github.com",
      SYMPHONY_HUMAN_LOGIN: "jeremycarroll", CADENCE_APP_ID: "4866513", CADENCE_APP_SLUG: "1000lines-cadence", GITHUB_TOKEN: "inherited-pat" };
    const installed = spawnSync("bash", [join(hostDir, "install.d", "40-credentials.sh")], { encoding: "utf8", env });
    assert.equal(installed.status, 0, installed.stderr);
    const runtimeEnv = await readFile(join(configDir, "runtime.env"), "utf8");
    assert.doesNotMatch(runtimeEnv, /GITHUB_TOKEN=|inherited-pat|PRIVATE KEY/);
    assert.match(runtimeEnv, /GIT_AUTHOR_NAME='1000lines-symphony\[bot\]'/);
    assert.match(runtimeEnv, /CADENCE_APP_ID='4866513'/);
    assert.match(runtimeEnv, /credential.useHttpPath/);
    assert.ok(runtimeEnv.includes(`PATH='${configDir}/bin:`));
    assert.match(runtimeEnv, /LINEAR_API_TOKEN='fixture-linear'/);
    assert.match(runtimeEnv, /OPENAI_API_KEY='fixture-openai'/);
    assert.equal(JSON.parse(await readFile(join(workspace, "cache", "codex-home", "auth.json"), "utf8")).OPENAI_API_KEY, provider);
    assert.equal(await readFile(join(secrets, "symphony", "keys"), "utf8"), keys);
    const report = JSON.parse(await readFile(join(stateDir, "credential-presence.json"), "utf8"));
    assert.equal(report.runtime_env_keys.GITHUB_TOKEN, false);
    assert.equal(report.github.app_config_present, true);
    assert.doesNotMatch(JSON.stringify(report) + installed.stdout + installed.stderr, /fixture-openai|fixture-linear|inherited-pat|PRIVATE KEY/);
    const wrongTarget = spawnSync("bash", ["-c", `set -a; source "$SYMPHONY_CONFIG_DIR/runtime.env"; export PATH="$TEST_PATH"; "$GIT_ASKPASS" "Password for 'https://github.com/other/repo': "`], { env: { ...env, TEST_PATH: process.env.PATH }, encoding: "utf8" });
    assert.equal(wrongTarget.status, 1, wrongTarget.stderr);
    assert.match(wrongTarget.stderr, /target mismatch/);
    const ghBin = join(root, "installed-gh", "bin");
    await mkdir(ghBin, { recursive: true });
    await writeFile(join(ghBin, "gh"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
    const toolsConfigured = runLib('prepend_runtime_path "$TEST_GH_BIN"', { ...env, TEST_GH_BIN: ghBin });
    assert.equal(toolsConfigured.status, 0, toolsConfigured.stderr);
    const afterTools = await readFile(join(configDir, "runtime.env"), "utf8");
    assert.ok(afterTools.includes(`PATH='${configDir}/bin:${ghBin}:`));
    assert.ok(afterTools.includes(`SYMPHONY_GH_BIN='${ghBin}/gh'`));
    const reloadEnv = { ...env };
    for (const name of ["SYMPHONY_GITHUB_AUTH_MODE", "SYMPHONY_GIT_AUTHOR_EMAIL", "SYMPHONY_HUMAN_LOGIN", "CADENCE_APP_ID", "CADENCE_APP_SLUG"]) delete reloadEnv[name];
    const reloaded = spawnSync("bash", [join(hostDir, "install.d", "40-credentials.sh")], { encoding: "utf8", env: reloadEnv });
    assert.equal(reloaded.status, 0, reloaded.stderr);
    const afterReload = await readFile(join(configDir, "runtime.env"), "utf8");
    assert.match(afterReload, /SYMPHONY_GITHUB_AUTH_MODE='app'/);
    assert.doesNotMatch(afterReload, /GITHUB_TOKEN=|inherited-pat/);
    assert.ok(afterReload.includes(`SYMPHONY_GH_BIN='${ghBin}/gh'`));
    const denied = spawnSync("bash", [join(hostDir, "install.d", "40-credentials.sh")], { encoding: "utf8", env: { ...env, SYMPHONY_GITHUB_AUTH_MODE: "invalid" } });
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /invalid SYMPHONY_GITHUB_AUTH_MODE/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
