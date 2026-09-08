import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const hostDir = dirname(fileURLToPath(import.meta.url));
const bootstrapScript = join(hostDir, "bootstrap.sh");

const gitEnv = {
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.com",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};

const runBash = (command, env = {}) =>
  spawnSync("bash", ["-c", `source "${bootstrapScript}"; ${command}`], {
    encoding: "utf8",
    env: { ...process.env, ...gitEnv, ...env },
  });

test("git askpass supplies the bot token without persisting it", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-askpass-"));
  const configDir = join(root, "etc");

  try {
    const result = runBash(`write_git_askpass 'secret-token'`, {
      SYMPHONY_CONFIG_DIR: configDir,
    });
    assert.equal(result.status, 0, result.stderr);

    const askpass = join(configDir, "git-askpass.sh");
    await access(askpass);

    const username = spawnSync("bash", [askpass, "Username for 'https://github.com':"], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_TOKEN: "secret-token" },
    });
    assert.equal(username.stdout.trim(), "x-access-token");

    const password = spawnSync("bash", [askpass, "Password for 'https://github.com':"], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_TOKEN: "secret-token" },
    });
    assert.equal(password.stdout.trim(), "secret-token");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("clones example-repo only when the checkout is absent", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-clone-"));
  const remoteRoot = join(root, "remotes");
  const remote = join(remoteRoot, "example-org", "example-repo.git");
  const seed = join(root, "seed");
  const srcRoot = join(root, "src");

  try {
    spawnSync("git", ["init", "--bare", "--initial-branch", "main", remote], {
      env: { ...process.env, ...gitEnv },
    });
    spawnSync("git", ["init", "--initial-branch", "main", seed], {
      env: { ...process.env, ...gitEnv },
    });
    await writeFile(join(seed, "file.txt"), "one\n");
    for (const args of [
      ["add", "."],
      ["commit", "-m", "one"],
      ["remote", "add", "origin", remote],
      ["push", "-u", "origin", "main"],
    ]) {
      const step = spawnSync("git", args, {
        cwd: seed,
        encoding: "utf8",
        env: { ...process.env, ...gitEnv },
      });
      assert.equal(step.status, 0, step.stderr);
    }

    const env = {
      SYMPHONY_SRC_ROOT: srcRoot,
      SYMPHONY_GITHUB_BASE_URL: `file://${remoteRoot}`,
    };

    const first = runBash(`ensure_bootstrap_source_clone`, env);
    assert.equal(first.status, 0, first.stderr);
    await access(join(srcRoot, "example-repo", ".git"));

    // Second run must be a no-op rather than a re-clone, so local work survives.
    await writeFile(join(srcRoot, "example-repo", "local-only.txt"), "kept\n");
    const second = runBash(`ensure_bootstrap_source_clone`, env);
    assert.equal(second.status, 0, second.stderr);
    await access(join(srcRoot, "example-repo", "local-only.txt"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
