import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import yaml from "js-yaml";
import { fileURLToPath } from "node:url";

const hostDir = dirname(fileURLToPath(import.meta.url));
const configStep = join(hostDir, "install.d", "80-config.sh");
const hooksStep = join(hostDir, "install.d", "85-hooks.sh");
const reconcileScript = join(hostDir, "reconcile.sh");

const runBash = (command, env = {}) =>
  spawnSync("bash", ["-c", command], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

const writeExecutable = async (path, contents) => {
  await writeFile(path, contents);
  await chmod(path, 0o755);
};

test("renders service units with runtime paths and worker settings", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-units-"));
  const env = {
    SYMPHONY_BOOTSTRAP_BIN_DIR: join(tempRoot, "opt", "bootstrap"),
    SYMPHONY_BOOTSTRAP_STATE_DIR: join(tempRoot, "state"),
    SYMPHONY_CONFIG_DIR: join(tempRoot, "etc", "symphony"),
    SYMPHONY_CURRENT_LINK: join(tempRoot, "opt", "symphony", "current"),
    SYMPHONY_LOGS_ROOT: join(tempRoot, "logs"),
    SYMPHONY_OPT_ROOT: join(tempRoot, "opt", "symphony"),
    SYMPHONY_RUNTIME_GROUP: "runner",
    SYMPHONY_RUNTIME_USER: "runner",
    SYMPHONY_SERVICE_PORT: "4777",
    SYMPHONY_SYSTEMD_DIR: join(tempRoot, "systemd"),
    SYMPHONY_WORKER_SLOTS: "9",
    SYMPHONY_WORKSPACE_ROOT: join(tempRoot, "workspace"),
  };

  try {
    await mkdir(env.SYMPHONY_BOOTSTRAP_BIN_DIR, { recursive: true });
    await mkdir(env.SYMPHONY_BOOTSTRAP_STATE_DIR, { recursive: true });
    await mkdir(env.SYMPHONY_CONFIG_DIR, { recursive: true });
    await mkdir(env.SYMPHONY_SYSTEMD_DIR, { recursive: true });

    const result = runBash(`source "${configStep}"; render_config_files`, env);
    assert.equal(result.status, 0, result.stderr);

    const service = await readFile(
      join(env.SYMPHONY_SYSTEMD_DIR, "symphony.service"),
      "utf8",
    );
    assert.match(service, new RegExp(`User=${env.SYMPHONY_RUNTIME_USER}`));
    assert.match(
      service,
      new RegExp(`EnvironmentFile=${env.SYMPHONY_CONFIG_DIR}/runtime.env`),
    );
    assert.match(service, /--port 4777/);
    assert.match(
      service,
      /--i-understand-that-this-will-be-running-without-the-usual-guardrails/,
    );
    assert.match(
      service,
      new RegExp(`ReadWritePaths=${env.SYMPHONY_WORKSPACE_ROOT}`),
    );

    const workflow = await readFile(
      join(env.SYMPHONY_CONFIG_DIR, "WORKFLOW.md"),
      "utf8",
    );
    assert.match(workflow, /^---\ntracker:/);
    assert.match(workflow, /\n  max_concurrent_agents: 9\n/);
    assert.match(workflow, /\n  host: "::"\n/);
    assert.match(workflow, /codex-with-runtime-bundle\.sh --enable apps/);
    assert.match(workflow, /Only after the Codex workpad ID is pinned/);
    for (const hook of ["after_create", "before_run", "after_run", "before_remove"]) {
      assert.ok(workflow.includes(`  ${hook}: |\n    true\n`));
    }
    assert.ok(service.includes(` ${env.SYMPHONY_CONFIG_DIR}/WORKFLOW.md\n`));
    assert.doesNotMatch(workflow, /Worker slots:/);

    const reconcile = await readFile(
      join(env.SYMPHONY_SYSTEMD_DIR, "symphony-reconcile.service"),
      "utf8",
    );
    assert.match(
      reconcile,
      new RegExp(`ExecStart=${env.SYMPHONY_BOOTSTRAP_BIN_DIR}/reconcile.sh`),
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("workflow rendering fails closed unless exactly one front-matter worker line matches", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-workflow-"));
  const configDir = join(tempRoot, "etc", "symphony");
  const stateDir = join(tempRoot, "state");
  const systemdDir = join(tempRoot, "systemd");
  const missing = join(tempRoot, "missing.md");
  const duplicate = join(tempRoot, "duplicate.md");

  try {
    await mkdir(configDir, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(systemdDir, { recursive: true });
    await writeFile(
      missing,
      "---\nagent:\n  max_turns: 20\ncodex:\n  command: codex app-server\n---\nbody\n",
    );
    await writeFile(
      duplicate,
      "---\nagent:\n  max_concurrent_agents: 3\n  max_concurrent_agents: 4\ncodex:\n  command: codex app-server\n---\nbody\n",
    );

    const env = {
      SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
      SYMPHONY_BOOTSTRAP_STATE_DIR: stateDir,
      SYMPHONY_CONFIG_DIR: configDir,
      SYMPHONY_SYSTEMD_DIR: systemdDir,
      SYMPHONY_WORKER_SLOTS: "7",
    };

    const noMatch = runBash(`source "${configStep}"; render_workflow_config`, {
      ...env,
      SYMPHONY_WORKFLOW_SOURCE: missing,
    });
    assert.notEqual(noMatch.status, 0);
    assert.match(noMatch.stderr, /expected exactly one front-matter/);

    const twoMatches = runBash(
      `source "${configStep}"; render_workflow_config`,
      { ...env, SYMPHONY_WORKFLOW_SOURCE: duplicate },
    );
    assert.notEqual(twoMatches.status, 0);
    assert.match(twoMatches.stderr, /expected exactly one front-matter/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("runs executable hooks lexicographically and fails on a nonzero hook", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-hooks-"));
  const hooksDir = join(tempRoot, "hooks.d");
  const logPath = join(tempRoot, "hooks.log");

  try {
    await mkdir(hooksDir);
    await writeExecutable(
      join(hooksDir, "20-second.sh"),
      `#!/usr/bin/env bash\nprintf 'second\\n' >>"${logPath}"\n`,
    );
    await writeExecutable(
      join(hooksDir, "10-first.sh"),
      `#!/usr/bin/env bash\nprintf 'first\\n' >>"${logPath}"\n`,
    );

    const result = runBash(`source "${hooksStep}"; run_hooks "${hooksDir}"`);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(logPath, "utf8"), "first\nsecond\n");

    await writeExecutable(
      join(hooksDir, "30-fail.sh"),
      "#!/usr/bin/env bash\nexit 7\n",
    );
    const failed = runBash(`source "${hooksStep}"; run_hooks "${hooksDir}"`);
    assert.equal(failed.status, 7);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("reconcile delegates to the installed bootstrap script in reconcile mode", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-reconcile-"));
  const fakeBootstrap = join(tempRoot, "bootstrap.sh");
  const logPath = join(tempRoot, "reconcile.log");

  try {
    await writeExecutable(
      fakeBootstrap,
      `#!/usr/bin/env bash\nprintf '%s\\n' "$1" >"${logPath}"\n`,
    );

    const result = spawnSync("bash", [reconcileScript], {
      encoding: "utf8",
      env: { ...process.env, SYMPHONY_BOOTSTRAP_SCRIPT: fakeBootstrap },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(logPath, "utf8"), "reconcile\n");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("reconcile runtime-bundle refresh delegates to the installed runner", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-reconcile-bundle-"));
  const fakeInstaller = join(tempRoot, "install-runtime.sh");
  const logPath = join(tempRoot, "installer.log");

  try {
    await writeExecutable(
      fakeInstaller,
      `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >"${logPath}"\n`,
    );

    const result = spawnSync("bash", [reconcileScript, "--runtime-bundle-refresh"], {
      encoding: "utf8",
      env: { ...process.env, SYMPHONY_INSTALLER_SCRIPT: fakeInstaller },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(logPath, "utf8"), "--runtime-bundle-refresh\n");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("reconcile runtime-bundle freshness check delegates to the installed runner", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-reconcile-check-"));
  const fakeInstaller = join(tempRoot, "install-runtime.sh");
  const logPath = join(tempRoot, "installer.log");

  try {
    await writeExecutable(
      fakeInstaller,
      `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >"${logPath}"\n`,
    );

    const result = spawnSync(
      "bash",
      [reconcileScript, "--check-runtime-bundle-fresh", "bundle-sha"],
      {
        encoding: "utf8",
        env: { ...process.env, SYMPHONY_INSTALLER_SCRIPT: fakeInstaller },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(logPath, "utf8"),
      "--check-runtime-bundle-fresh bundle-sha\n",
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("authoritative CI timer workflow retains its state contract after host rendering", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-ci-timer-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));
  const repoRoot = dirname(dirname(dirname(hostDir)));
  const configDir = join(tempRoot, "config");
  const stateDir = join(tempRoot, "state");
  await mkdir(configDir);
  await mkdir(stateDir);
  const result = runBash(`source "${configStep}"; render_workflow_config`, {
    SYMPHONY_WORKFLOW_SOURCE: join(
      repoRoot,
      "scripts/symphony/runtime-bundle/workflow/WORKFLOW.md"
    ),
    SYMPHONY_CONFIG_DIR: configDir,
    SYMPHONY_BOOTSTRAP_STATE_DIR: stateDir,
    SYMPHONY_WORKER_SLOTS: "9",
  });
  assert.equal(result.status, 0, result.stderr);
  const rendered = await readFile(join(configDir, "WORKFLOW.md"), "utf8");
  const { tracker, agent } = yaml.load(rendered.split(/^---\s*$/m)[1]);
  assert.deepEqual(tracker.daemon_states, ["Unhappy"]);
  assert.deepEqual(tracker.daemon_dispatch_states, ["Evaluating"]);
  assert.equal(tracker.daemon_default_wake, "15m");
  assert.ok(tracker.active_states.includes("Active"));
  for (const state of tracker.daemon_dispatch_states) {
    assert.ok(tracker.active_states.includes(state));
    assert.ok(!tracker.terminal_states.includes(state));
  }
  for (const state of tracker.daemon_states) {
    assert.ok(!tracker.active_states.includes(state));
    assert.ok(!tracker.terminal_states.includes(state));
  }
  assert.equal(agent.max_concurrent_agents, 9);
  assert.equal(agent.max_concurrent_agents_by_state.Evaluating, 1);
});
