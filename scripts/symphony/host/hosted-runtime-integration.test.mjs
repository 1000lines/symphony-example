import yaml from "js-yaml";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const hostDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(dirname(hostDir)));
const installStep = join(hostDir, "install.d", "45-runtime-bundle.sh");
const provenanceStep = join(hostDir, "install.d", "90-provenance.sh");

const currentUser = userInfo().username;
const currentGroup = spawnSync("id", ["-gn"], {
  encoding: "utf8",
}).stdout.trim();

const privateRuntimeSkillNames = [
  "symphony-finalize-project",
  "symphony-google-docs",
  "symphony-linear-api",
  "symphony-proof-of-work",
  "symphony-replan",
  "symphony-repository",
];

const commonAbsentSkillNames = [
  "symphony-finalize-project",
  "symphony-google-docs",
  "symphony-linear-api",
  "symphony-proof-of-work",
];

const runBash = (command, env = {}) =>
  spawnSync("bash", ["-c", command], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

const pathExists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

const writeExecutable = async (path, contents) => {
  await writeFile(path, contents);
  await chmod(path, 0o755);
};

const writeRuntimeEnv = async (path, values) => {
  const body = Object.entries(values)
    .map(([key, value]) => `${key}=${quote(value)}`)
    .join("\n");
  await writeFile(path, `${body}\n`);
};

const makeInstallFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "hosted-runtime-integration-"));
  const workspaceRoot = join(root, "workspace");
  const stateDir = join(root, "state");
  const codexHome = join(workspaceRoot, "cache", "codex-home");
  const runtimeBundleCacheDir = join(workspaceRoot, "cache", "runtime-bundle");
  const repoSha = "abc4790000000000000000000000000000000000";
  const env = {
    SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
    SYMPHONY_BOOTSTRAP_STATE_DIR: stateDir,
    SYMPHONY_CODEX_HOME: codexHome,
    SYMPHONY_RUNTIME_BUNDLE_CACHE_DIR: runtimeBundleCacheDir,
    SYMPHONY_RUNTIME_BUNDLE_INSTALLED_AT: "2026-09-03T20:00:00Z",
    SYMPHONY_RUNTIME_BUNDLE_REPO_SHA: repoSha,
    SYMPHONY_RUNTIME_GROUP: currentGroup,
    SYMPHONY_RUNTIME_USER: currentUser,
    SYMPHONY_SRC_ROOT: join(root, "src"),
    SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
  };

  await mkdir(stateDir, { recursive: true });
  await mkdir(codexHome, { recursive: true });
  await writeFile(join(codexHome, "auth.json"), '{"OPENAI_API_KEY":"keep"}\n');

  const result = runBash(`source "${installStep}"; main`, env);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  return {
    codexHome,
    currentLink: join(runtimeBundleCacheDir, "current"),
    env,
    releaseDir: join(runtimeBundleCacheDir, "releases", repoSha),
    repoSha,
    root,
    stateDir,
    workspaceRoot,
  };
};

test("hosted private skills install from the personal bundle and not common paths", async () => {
  const fixture = await makeInstallFixture();

  try {
    assert.equal(
      await readFile(join(fixture.codexHome, "auth.json"), "utf8"),
      '{"OPENAI_API_KEY":"keep"}\n'
    );
    assert.match(
      await readFile(join(fixture.codexHome, "AGENTS.md"), "utf8"),
      /Hosted Symphony Codex Runtime/
    );

    assert.equal(await readlink(fixture.currentLink), fixture.releaseDir);
    assert.equal(
      (await readFile(join(fixture.codexHome, "config.toml"), "utf8")).trim(),
      'preferred_auth_method = "apikey"'
    );

    for (const name of privateRuntimeSkillNames) {
      const link = join(fixture.codexHome, "skills", name);
      const target = await readlink(link);
      assert.equal(
        target,
        join(fixture.currentLink, "skills", name),
        `${name} must resolve through the installed runtime bundle`
      );
      assert.equal(
        target.startsWith(join(repoRoot, ".codex", "skills")),
        false,
        `${name} must not resolve through the old common Codex path`
      );
      assert.equal(
        (await stat(join(link, "SKILL.md"))).isFile(),
        true,
        `${name} must be loadable from CODEX_HOME`
      );
    }

    for (const name of commonAbsentSkillNames) {
      assert.equal(
        await pathExists(join(repoRoot, ".codex", "skills", name, "SKILL.md")),
        false,
        `${name} must not be loadable from .codex/skills`
      );
    }

    const installedManifest = JSON.parse(
      await readFile(
        join(fixture.codexHome, "runtime-bundle-manifest.json"),
        "utf8"
      )
    );
    const installedSkillNames = installedManifest.skills
      .map((skill) => `${skill.kind}:${skill.name}`)
      .sort();
    assert.deepEqual(installedSkillNames, [
      "private:symphony-finalize-project",
      "private:symphony-google-docs",
      "private:symphony-linear-api",
      "private:symphony-proof-of-work",
      "private:symphony-replan",
      "private:symphony-repository",
      "shared:karpathy-guidelines",
      "shared:linear-graphql",
    ]);
    assert.equal(
      installedManifest.skills.some(
        (skill) => skill.name === "symphony-project-factory"
      ),
      false
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("installed repository helper reads each target's selected base, not a task proposal", async () => {
  const fixture = await makeInstallFixture();
  const helper = join(
    fixture.codexHome,
    "skills/symphony-repository/scripts/config.mjs"
  );
  const targets = [
    {
      repository: "1000lines/symphony-example",
      commands: { setup: [["npm", "ci"]], test: [["npm", "test"]] },
      checks: ["CI Required"],
    },
    {
      repository: "jeremycarroll/venn-search-rs",
      commands: { test: [["cargo", "test", "--release"]] },
      checks: [3, 4, 5, 6]
        .map((n) => `Test Suite (NCOLORS=${n})`)
        .concat("Clippy (Linting)", "Format Check"),
    },
  ];
  try {
    for (const [index, target] of targets.entries()) {
      const checkout = join(fixture.root, `target-${index}`);
      await mkdir(checkout);
      const git = (...args) => {
        const result = spawnSync("git", ["-C", checkout, ...args], {
          encoding: "utf8",
          env: {
            ...process.env,
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
          },
        });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout.trim();
      };
      git("init", "--initial-branch=main");
      git(
        "remote",
        "add",
        "origin",
        `https://github.com/${target.repository}.git`
      );
      // Repository names/checks identify the two scenarios; no network or live grants.
      const config = {
        schemaVersion: "symphony-repository/v1",
        linear: { teamKey: "100" },
        workingDirectory: ".",
        instructions: [],
        commands: target.commands,
        ci: {
          requiredChecks: target.checks.map((name) => ({
            name,
            workflow: ".github/workflows/ci.yml",
            appId: 15368,
          })),
        },
      };
      const configPath = join(checkout, ".symphony.cfg.json");
      await writeFile(configPath, JSON.stringify(config));
      git("add", ".symphony.cfg.json");
      git(
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-m",
        "Base configuration"
      );
      const revision = git("rev-parse", "HEAD");
      git("update-ref", "refs/remotes/origin/main", revision);
      await writeFile(
        configPath,
        JSON.stringify({ ...config, commands: {}, ci: { requiredChecks: [] } })
      );
      const inspect = (base) =>
        spawnSync(process.execPath, [helper, "inspect", checkout, base], {
          encoding: "utf8",
        });
      const selected = inspect("main");
      assert.equal(selected.status, 0, selected.stderr);
      assert.deepEqual(JSON.parse(selected.stdout), {
        status: "configured",
        revision,
        config,
      });
      assert.notEqual(inspect("unavailable-base").status, 0);

      git("rm", "-f", ".symphony.cfg.json");
      git(
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-m",
        "Unconfigured target"
      );
      const missingRevision = git("rev-parse", "HEAD");
      git("update-ref", "refs/remotes/origin/main", missingRevision);
      const missing = inspect("main");
      assert.equal(missing.status, 0, missing.stderr);
      assert.deepEqual(JSON.parse(missing.stdout), {
        status: "missing",
        revision: missingRevision,
      });
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("staged workflow renders the same per-ticket timer and skill entry point for both auth modes", async () => {
  const fixture = await makeInstallFixture();
  try {
    for (const mode of ["app", "legacy"]) {
      const configDir = join(fixture.root, mode);
      await mkdir(configDir);
      const result = runBash(
        `source ${quote(
          join(hostDir, "install.d/80-config.sh")
        )}; worker_slots=5; render_workflow_config`,
        {
          ...fixture.env,
          SYMPHONY_CONFIG_DIR: configDir,
          SYMPHONY_GITHUB_AUTH_MODE: mode,
          SYMPHONY_WORKFLOW_SOURCE: "",
        }
      );
      assert.equal(result.status, 0, result.stderr);
      const workflow = await readFile(join(configDir, "WORKFLOW.md"), "utf8");
      const profile = yaml.load(workflow.split("---")[1]);
      assert.deepEqual(profile.tracker.active_states, ["Active", "Evaluating"]);
      assert.deepEqual(profile.tracker.daemon_states, ["Unhappy"]);
      assert.deepEqual(profile.tracker.daemon_dispatch_states, ["Evaluating"]);
      assert.equal(profile.tracker.daemon_default_wake, "15m");
      assert.equal(profile.agent.max_concurrent_agents, 5);
      assert.equal(profile.agent.max_concurrent_agents_by_state.Evaluating, 1);
      assert.ok(
        profile.codex.command.startsWith(
          join(fixture.codexHome, "runtime/bin/codex-with-runtime-bundle.sh")
        )
      );
      assert.ok(
        Object.values(profile.hooks).every(
          (command) => command.trim() === "true"
        )
      );
      assert.match(workflow, /installed `symphony-repository` skill/);
      assert.match(workflow, /reviewer through `workflow_call`/);
      assert.doesNotMatch(
        workflow,
        /ci_passes|ai_accepts|cadence-codex-review/
      );
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("host provenance is limited to surviving runtime bundle and credential evidence", async () => {
  const fixture = await makeInstallFixture();
  const configDir = join(fixture.root, "etc", "symphony");
  const provenancePath = join(fixture.stateDir, "provenance.json");
  const runtimeHead = "def4790000000000000000000000000000000000";
  const credentialValues = {
    CODEX_HOME: fixture.codexHome,
    GITHUB_TOKEN: "github-token",
    GOOGLE_APPLICATION_CREDENTIALS: join(
      configDir,
      "google-drive-reader-sa.json"
    ),
    GIT_ASKPASS: join(configDir, "git-askpass.sh"),
    LINEAR_API_TOKEN: "linear-token",
    OPENAI_API_KEY: "openai-key",
  };

  try {
    await mkdir(configDir, { recursive: true });
    await writeRuntimeEnv(join(configDir, "runtime.env"), credentialValues);
    await writeExecutable(
      join(configDir, "git-askpass.sh"),
      "#!/usr/bin/env bash\nexit 0\n"
    );
    await writeFile(
      join(configDir, "google-drive-reader-sa.json"),
      '{"client_email":"bot@example.com"}\n'
    );

    const result = runBash(
      `source "${provenanceStep}"; write_provenance "${provenancePath}"`,
      {
        ...fixture.env,
        SYMPHONY_AMI_ID: "ami-abc479",
        SYMPHONY_AWS_REGION: "us-west-2",
        SYMPHONY_BOOTSTRAP_HEAD: fixture.repoSha,
        SYMPHONY_BOOTSTRAP_REF: "main",
        SYMPHONY_BOOTSTRAP_SHA: fixture.repoSha,
        SYMPHONY_BOOTSTRAP_TIMESTAMP: "2026-09-03T20:05:00Z",
        SYMPHONY_CONFIG_DIR: configDir,
        SYMPHONY_CREDENTIAL_PRESENCE_RECORDED_AT: "2026-09-03T20:06:00Z",
        SYMPHONY_INSTANCE_ID: "i-abc479",
        SYMPHONY_RUNTIME_HEAD: runtimeHead,
        SYMPHONY_RUNTIME_REF: "release",
        SYMPHONY_RUNTIME_SHA: runtimeHead,
        SYMPHONY_WORKER_SLOTS: "6",
        SYMPHONY_WORKSPACE_STATE: "empty-volume",
      }
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
    assert.deepEqual(Object.keys(provenance).sort(), [
      "codex",
      "credentials",
      "installer",
      "instance",
      "mode",
      "refs",
      "runtime_bundle",
      "timestamp",
      "worker_slots",
      "workspace",
    ]);
    assert.deepEqual(Object.keys(provenance.runtime_bundle).sort(), [
      "bundle_sha256",
      "current_link",
      "current_target",
      "installed_manifest_path",
      "installed_manifest_sha256",
      "installed_skills",
      "manifest_path",
      "manifest_sha256",
      "release_path",
      "repo_sha",
      "workflow_source_sha256",
    ]);
    assert.deepEqual(Object.keys(provenance.credentials).sort(), [
      "checks",
      "presence_manifest_path",
      "presence_manifest_sha256",
    ]);
    assert.deepEqual(Object.keys(provenance.credentials.checks).sort(), [
      "codex",
      "files",
      "recordedAt",
      "runtime_env_keys",
      "schemaVersion",
    ]);

    for (const name of privateRuntimeSkillNames) {
      assert.ok(
        provenance.runtime_bundle.installed_skills.some(
          (skill) => skill.name === name && skill.kind === "private"
        ),
        `provenance should record installed private skill ${name}`
      );
    }

    assert.equal(
      provenance.credentials.checks.runtime_env_keys.CODEX_HOME,
      true
    );
    assert.equal(
      provenance.credentials.checks.codex.config_toml.path,
      join(fixture.codexHome, "config.toml")
    );

    const serialized = JSON.stringify(provenance);
    for (const secret of Object.values(credentialValues)) {
      if (secret.startsWith("/")) {
        continue;
      }
      assert.equal(
        serialized.includes(secret),
        false,
        `provenance must not contain secret value ${secret}`
      );
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
