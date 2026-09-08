import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const hostDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(dirname(hostDir)));
const installStep = join(hostDir, "install.d", "45-runtime-bundle.sh");
const runnerScript = join(hostDir, "install-runtime.sh");
const runtimeBundleSource = join(
  repoRoot,
  "scripts",
  "symphony",
  "runtime-bundle"
);

const currentUser = userInfo().username;
const currentGroup = spawnSync("id", ["-gn"], {
  encoding: "utf8",
}).stdout.trim();

const runBash = (command, env = {}) =>
  spawnSync("bash", ["-c", command], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

const writeExecutable = async (path, contents) => {
  await writeFile(path, contents);
  await chmod(path, 0o755);
};

const fileSha = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");

const regularFiles = async (root, dir = root) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await regularFiles(root, path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
};

const treeSha = async (root) => {
  const hash = createHash("sha256");
  const files = await regularFiles(root);
  files.sort((left, right) => {
    const relativeLeft = relative(root, left);
    const relativeRight = relative(root, right);
    if (relativeLeft < relativeRight) return -1;
    if (relativeLeft > relativeRight) return 1;
    return 0;
  });

  for (const file of files) {
    hash.update(await readFile(file));
  }

  return hash.digest("hex");
};

test("runtime bundle install stages release, links skills through current, and writes manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-runtime-bundle-"));
  const stateDir = join(root, "state");
  const workspaceRoot = join(root, "workspace");
  const codexHome = join(workspaceRoot, "cache", "codex-home");
  const repoSha = "abc4700000000000000000000000000000000000";
  const binDir = join(root, "bin");
  const installerLog = join(root, "installer.log");
  const fakeInstaller = join(root, "install-runtime.sh");
  const currentLink = join(workspaceRoot, "cache", "runtime-bundle", "current");
  const releaseDir = join(
    workspaceRoot,
    "cache",
    "runtime-bundle",
    "releases",
    repoSha
  );
  const env = {
    SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
    SYMPHONY_BOOTSTRAP_STATE_DIR: stateDir,
    SYMPHONY_CODEX_HOME: codexHome,
    SYMPHONY_RUNTIME_BUNDLE_INSTALLED_AT: "2026-09-01T19:00:00Z",
    SYMPHONY_RUNTIME_BUNDLE_REPO_SHA: repoSha,
    SYMPHONY_RUNTIME_GROUP: currentGroup,
    SYMPHONY_RUNTIME_USER: currentUser,
    SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
  };

  try {
    await mkdir(stateDir, { recursive: true });
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, "auth.json"),
      '{"OPENAI_API_KEY":"keep"}\n'
    );

    const result = runBash(`source "${installStep}"; main`, env);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    assert.equal((await stat(releaseDir)).isDirectory(), true);
    assert.equal(await readlink(currentLink), releaseDir);
    assert.equal(
      await readFile(join(codexHome, "auth.json"), "utf8"),
      '{"OPENAI_API_KEY":"keep"}\n'
    );
    const installedAgents = await readFile(
      join(codexHome, "AGENTS.md"),
      "utf8"
    );
    assert.match(installedAgents, /Hosted Symphony Codex Runtime/);
    assert.match(installedAgents, /## Codex Workpad Startup/);
    assert.match(
      installedAgents,
      /Never select or update `## Symphony Workpad`/
    );
    assert.equal(
      await readFile(join(codexHome, "config.toml"), "utf8"),
      await readFile(
        join(runtimeBundleSource, "codex", "config.toml.template"),
        "utf8"
      )
    );
    const releaseWorkflow = await readFile(
      join(releaseDir, "workflow", "WORKFLOW.md"),
      "utf8"
    );
    assert.match(releaseWorkflow, /Only after the Codex workpad ID is pinned/);

    const privateSkill = "symphony-proof-of-work";
    const sharedSkill = "karpathy-guidelines";
    assert.equal(
      await readlink(join(codexHome, "skills", privateSkill)),
      join(currentLink, "skills", privateSkill)
    );
    assert.equal(
      await readlink(join(codexHome, "skills", sharedSkill)),
      join(currentLink, "shared-skills", sharedSkill)
    );
    assert.equal(
      (
        await stat(join(releaseDir, "shared-skills", sharedSkill, "SKILL.md"))
      ).isFile(),
      true
    );

    for (const skill of [
      privateSkill,
      sharedSkill,
      "linear-graphql",
    ]) {
      const linkTarget = await readlink(join(codexHome, "skills", skill));
      assert.equal(linkTarget.startsWith(currentLink), true);
      assert.equal(linkTarget.startsWith(repoRoot), false);
    }
    await assert.rejects(
      readlink(join(codexHome, "skills", "symphony-project-factory"))
    );

    const wrapper = join(
      codexHome,
      "runtime",
      "bin",
      "codex-with-runtime-bundle.sh"
    );
    assert.notEqual((await stat(wrapper)).mode & 0o111, 0);
    assert.match(
      await readFile(wrapper, "utf8"),
      /--check-runtime-bundle-fresh/
    );
    const wrapperSyntax = spawnSync("bash", ["-n", wrapper], {
      encoding: "utf8",
    });
    assert.equal(wrapperSyntax.status, 0, wrapperSyntax.stderr);

    await mkdir(binDir);
    await writeExecutable(
      fakeInstaller,
      `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >"${installerLog}"\n`
    );
    await writeExecutable(
      join(binDir, "codex"),
      "#!/usr/bin/env bash\nprintf 'codex %s\\n' \"$*\"\n"
    );
    const wrapperRun = spawnSync("bash", [wrapper, "--version"], {
      encoding: "utf8",
      env: {
        ...process.env,
        ...env,
        PATH: `${binDir}:${process.env.PATH}`,
        SYMPHONY_RUNTIME_BUNDLE_INSTALLER: fakeInstaller,
      },
    });
    assert.equal(
      wrapperRun.status,
      0,
      `${wrapperRun.stdout}\n${wrapperRun.stderr}`
    );
    assert.equal(
      await readFile(installerLog, "utf8"),
      "--check-runtime-bundle-fresh\n"
    );
    assert.equal(wrapperRun.stdout, "codex --version\n");

    const installedManifest = JSON.parse(
      await readFile(join(codexHome, "runtime-bundle-manifest.json"), "utf8")
    );
    assert.equal(
      installedManifest.schemaVersion,
      "symphony-runtime-bundle-install/v1"
    );
    assert.equal(installedManifest.installedAt, "2026-09-01T19:00:00Z");
    assert.equal(installedManifest.repo.sha, repoSha);
    const bundleSha = await treeSha(runtimeBundleSource);
    assert.equal(installedManifest.bundle.sha256, bundleSha);
    assert.equal(
      installedManifest.bundle.workflowSourceSha256,
      await fileSha(join(runtimeBundleSource, "workflow", "WORKFLOW.md"))
    );
    assert.equal(installedManifest.bundle.currentLink, currentLink);
    assert.equal(installedManifest.bundle.currentTarget, releaseDir);
    assert.equal(installedManifest.codex.home, codexHome);
    assert.equal(
      installedManifest.codex.configPath,
      join(codexHome, "config.toml")
    );
    assert.equal(
      installedManifest.codex.agentsPath,
      join(codexHome, "AGENTS.md")
    );

    const installedSkillNames = installedManifest.skills
      .map((skill) => `${skill.kind}:${skill.name}`)
      .sort();
    assert.deepEqual(installedSkillNames, [
      "private:symphony-finalize-project",
      "private:symphony-google-docs",
      "private:symphony-linear-api",
      "private:symphony-proof-of-work",
      "shared:karpathy-guidelines",
      "shared:linear-graphql",
    ]);

    const fresh = spawnSync(
      "bash",
      [runnerScript, "--check-runtime-bundle-fresh"],
      { encoding: "utf8", env: { ...process.env, ...env } }
    );
    assert.equal(fresh.status, 0, fresh.stderr);

    const freshAfterRepoShaMoves = spawnSync(
      "bash",
      [runnerScript, "--check-runtime-bundle-fresh"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          ...env,
          SYMPHONY_RUNTIME_BUNDLE_REPO_SHA:
            "def4700000000000000000000000000000000000",
        },
      }
    );
    assert.equal(
      freshAfterRepoShaMoves.status,
      0,
      freshAfterRepoShaMoves.stderr
    );

    const stale = spawnSync(
      "bash",
      [
        runnerScript,
        "--check-runtime-bundle-fresh",
        createHash("sha256").update("not-the-current-bundle").digest("hex"),
      ],
      { encoding: "utf8", env: { ...process.env, ...env } }
    );
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /runtime bundle is stale/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
