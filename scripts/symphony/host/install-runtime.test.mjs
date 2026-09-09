import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const hostDir = dirname(fileURLToPath(import.meta.url));
const runnerScript = join(hostDir, "install-runtime.sh");
const stepsDir = join(hostDir, "install.d");
const step = (name) => join(stepsDir, `${name}.sh`);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

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

const runBash = (command, env = {}) =>
  spawnSync("bash", ["-c", command], {
    encoding: "utf8",
    env: { ...process.env, ...gitEnv, ...env },
  });

const runRunner = (args, env = {}) =>
  spawnSync("bash", [runnerScript, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...gitEnv, ...env },
  });

const writeExecutable = async (path, contents) => {
  await writeFile(path, contents);
  await chmod(path, 0o755);
};

const runGit = (cwd, args) => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...gitEnv },
  });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
};

const makeCommittedCheckout = async (checkout) => {
  await mkdir(checkout, { recursive: true });
  runGit(checkout, ["init", "--initial-branch", "main"]);
  await writeFile(join(checkout, "file.txt"), `${checkout}\n`);
  runGit(checkout, ["add", "."]);
  runGit(checkout, ["commit", "-m", "seed"]);
  return runGit(checkout, ["rev-parse", "HEAD"]);
};

const installedRuntimeBundleManifest = ({
  codexHome,
  bundleCurrent,
  bundleRelease,
  repoSha,
  bundleSha = "bundle-content-sha",
  manifestSha = "bundle-manifest-sha",
  workflowSha = "workflow-source-sha",
  skills,
}) => ({
  schemaVersion: "symphony-runtime-bundle-install/v1",
  repo: { sha: repoSha },
  bundle: {
    sha256: bundleSha,
    manifestSha256: manifestSha,
    workflowSourceSha256: workflowSha,
    releasePath: bundleRelease,
    currentLink: bundleCurrent,
    currentTarget: bundleRelease,
  },
  skills: skills ?? [
    {
      name: "symphony-proof-of-work",
      kind: "private",
      destination: join(codexHome, "skills", "symphony-proof-of-work"),
      linkTarget: join(bundleCurrent, "skills", "symphony-proof-of-work"),
      sourceSha256: "skill-sha",
    },
  ],
});

const credentialPresenceEnv = ({ codexHome, configDir, workspaceRoot }) => ({
  HOME: workspaceRoot,
  GITHUB_TOKEN: "github_fake",
  LINEAR_API_TOKEN: "linear_fake",
  OPENAI_API_KEY: "present-openai-key",
  GOOGLE_APPLICATION_CREDENTIALS: join(
    configDir,
    "google-drive-reader-sa.json"
  ),
  GIT_ASKPASS: join(configDir, "git-askpass.sh"),
  CODEX_HOME: codexHome,
});

const writeRuntimeEnv = async (path, values) => {
  const body = Object.entries(values)
    .map(([key, value]) => `${key}='${value}'`)
    .join("\n");
  await writeFile(path, `${body}\n`);
};

const writeInstalledRuntimeBundleManifest = async (options) => {
  await writeFile(
    join(options.codexHome, "runtime-bundle-manifest.json"),
    JSON.stringify(installedRuntimeBundleManifest(options))
  );
};

const makeProvenanceFixture = async (
  root,
  { manifest = true, manifestRepoSha, manifestOverrides = {} } = {}
) => {
  const stateDir = join(root, "state");
  const srcRoot = join(root, "src");
  const bootstrapCheckout = join(srcRoot, "example-repo");
  const runtimeCheckout = join(srcRoot, "symphony");
  const workspaceRoot = join(root, "workspace");
  const codexHome = join(workspaceRoot, "cache", "codex-home");
  const configDir = join(root, "etc", "symphony");
  const bundleRelease = join(
    workspaceRoot,
    "cache",
    "runtime-bundle",
    "releases",
    "bundle-sha"
  );
  const bundleCurrent = join(
    workspaceRoot,
    "cache",
    "runtime-bundle",
    "current"
  );
  const provenancePath = join(root, "provenance.json");

  await mkdir(stateDir, { recursive: true });
  await mkdir(codexHome, { recursive: true });
  await mkdir(configDir, { recursive: true });
  await mkdir(bundleRelease, { recursive: true });
  await writeFile(join(bundleRelease, "manifest.json"), '{"fixture":true}\n');
  await writeRuntimeEnv(
    join(configDir, "runtime.env"),
    credentialPresenceEnv({ codexHome, configDir, workspaceRoot })
  );
  await writeExecutable(
    join(configDir, "git-askpass.sh"),
    "#!/usr/bin/env bash\nexit 0\n"
  );
  await writeFile(
    join(configDir, "google-drive-reader-sa.json"),
    '{"client_email":"bot@example.com"}\n'
  );
  await writeFile(
    join(codexHome, "auth.json"),
    '{"OPENAI_API_KEY":"present"}\n'
  );
  await writeFile(
    join(codexHome, "config.toml"),
    'preferred_auth_method = "apikey"\n'
  );

  const bootstrapHead = await makeCommittedCheckout(bootstrapCheckout);
  const runtimeHead = await makeCommittedCheckout(runtimeCheckout);

  await mkdir(dirname(bundleCurrent), { recursive: true });
  await symlink(bundleRelease, bundleCurrent);

  if (manifest) {
    await writeInstalledRuntimeBundleManifest({
      codexHome,
      bundleCurrent,
      bundleRelease,
      repoSha: manifestRepoSha ?? bootstrapHead,
      ...manifestOverrides,
    });
  }

  return {
    bootstrapHead,
    bundleCurrent,
    bundleRelease,
    codexHome,
    configDir,
    env: {
      SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
      SYMPHONY_AMI_ID: "ami-123",
      SYMPHONY_AWS_REGION: "us-west-2",
      SYMPHONY_BOOTSTRAP_REF: "main",
      SYMPHONY_BOOTSTRAP_SHA: "1111111111111111111111111111111111111111",
      SYMPHONY_BOOTSTRAP_HEAD: "3333333333333333333333333333333333333333",
      SYMPHONY_BOOTSTRAP_STATE_DIR: stateDir,
      SYMPHONY_BOOTSTRAP_TIMESTAMP: "2026-08-08T22:00:00Z",
      SYMPHONY_CODEX_HOME: codexHome,
      SYMPHONY_CONFIG_DIR: configDir,
      SYMPHONY_INSTALLER_CHECKSUM: "abcdef",
      SYMPHONY_INSTALLER_PATH: runnerScript,
      SYMPHONY_INSTALLER_URL:
        "https://github.com/example-org/example-repo/tree/bootstrap-sha",
      SYMPHONY_INSTANCE_ID: "i-123",
      SYMPHONY_RUNTIME_REF: "release",
      SYMPHONY_RUNTIME_SHA: "2222222222222222222222222222222222222222",
      SYMPHONY_RUNTIME_HEAD: "4444444444444444444444444444444444444444",
      SYMPHONY_RUNTIME_STASHED: "1",
      SYMPHONY_SRC_ROOT: srcRoot,
      SYMPHONY_WORKER_SLOTS: "6",
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
      SYMPHONY_WORKSPACE_STATE: "empty-volume",
    },
    provenancePath,
    runtimeHead,
    workspaceRoot,
  };
};

// A steps directory of trivial recorders, so runner selection can be asserted
// without executing any real installation step.
const makeFakeSteps = async (root, names) => {
  const dir = join(root, "steps");
  const log = join(root, "steps.log");
  await mkdir(dir, { recursive: true });

  for (const name of names) {
    await writeExecutable(
      join(dir, `${name}.sh`),
      `#!/usr/bin/env bash\nprintf '%s\\n' "${name}" >>"${log}"\n`
    );
  }

  return { dir, log };
};

const runnerEnv = (root, stepsOverride) => ({
  SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
  SYMPHONY_BOOTSTRAP_STATE_DIR: join(root, "state"),
  SYMPHONY_STEPS_DIR: stepsOverride,
});

const readLog = async (path) => {
  try {
    return (await readFile(path, "utf8")).trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
};

test("--list reports every step in execution order", () => {
  const result = runRunner(["--list"], {
    SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
  });
  assert.equal(result.status, 0, result.stderr);

  const listed = result.stdout.trim().split("\n");
  assert.deepEqual(listed, [...listed].sort());
  assert.ok(listed.includes("10-os-packages"));
  assert.ok(listed.includes("45-runtime-bundle"));
  assert.ok(listed.includes("55-node-toolchain"));
  assert.ok(listed.includes("60-dev-tools"));
  assert.ok(listed.includes("99-systemd"));
  assert.ok(
    listed.indexOf("10-os-packages") < listed.indexOf("30-workspace-volume")
  );
  assert.ok(
    listed.indexOf("50-beam-toolchain") < listed.indexOf("55-node-toolchain")
  );
  assert.ok(
    listed.indexOf("55-node-toolchain") < listed.indexOf("60-dev-tools")
  );
});

test("a bare run executes every step in order", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-runner-all-"));

  try {
    const { dir, log } = await makeFakeSteps(root, ["10-a", "20-b", "30-c"]);
    const result = runRunner([], runnerEnv(root, dir));

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readLog(log), ["10-a", "20-b", "30-c"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("--only runs a single step, matched on prefix", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-runner-only-"));

  try {
    const { dir, log } = await makeFakeSteps(root, ["10-a", "20-b", "30-c"]);
    const result = runRunner(["--only", "20"], runnerEnv(root, dir));

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readLog(log), ["20-b"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("--from resumes at a step and runs the rest", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-runner-from-"));

  try {
    const { dir, log } = await makeFakeSteps(root, ["10-a", "20-b", "30-c"]);
    const result = runRunner(["--from", "20-b"], runnerEnv(root, dir));

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readLog(log), ["20-b", "30-c"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("--skip drops the named steps", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-runner-skip-"));

  try {
    const { dir, log } = await makeFakeSteps(root, ["10-a", "20-b", "30-c"]);
    const result = runRunner(
      ["--skip", "10-a", "--skip", "30-c"],
      runnerEnv(root, dir)
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readLog(log), ["20-b"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a failing step aborts the run without continuing", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-runner-fail-"));

  try {
    const { dir, log } = await makeFakeSteps(root, ["10-a", "30-c"]);
    await writeExecutable(
      join(dir, "20-b.sh"),
      `#!/usr/bin/env bash\nprintf 'boom\\n' >&2\nexit 3\n`
    );

    const result = runRunner([], runnerEnv(root, dir));

    assert.notEqual(result.status, 0);
    assert.deepEqual(await readLog(log), ["10-a"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("--runtime-bundle-refresh runs source sync plus bundle, config, and provenance steps", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-runner-bundle-refresh-"));

  try {
    const { dir, log } = await makeFakeSteps(root, [
      "05-source",
      "40-credentials",
      "45-runtime-bundle",
      "50-beam-toolchain",
      "80-config",
      "90-provenance",
      "99-systemd",
    ]);
    const result = runRunner(
      ["--runtime-bundle-refresh"],
      runnerEnv(root, dir)
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readLog(log), [
      "05-source",
      "45-runtime-bundle",
      "80-config",
      "90-provenance",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an unmatched --from is an error rather than a silent no-op", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-runner-nomatch-"));

  try {
    const { dir } = await makeFakeSteps(root, ["10-a"]);
    const result = runRunner(["--from", "99-nope"], runnerEnv(root, dir));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no step matched --from/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("host dependency install does not replace AL2023 curl-minimal", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-host-deps-"));
  const binDir = join(root, "bin");
  const dnfLog = join(root, "dnf.log");

  try {
    await mkdir(binDir);
    await writeExecutable(
      join(binDir, "dnf"),
      `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >>"${dnfLog}"\n`
    );

    const result = runBash(
      `source "${step(
        "10-os-packages"
      )}"; install_host_dependencies; install_runtime_tool_dependencies`,
      { PATH: `${binDir}:/usr/bin:/bin` }
    );

    assert.equal(result.status, 0, result.stderr);
    const dnfArgs = await readFile(dnfLog, "utf8");
    assert.match(dnfArgs, /awscli/);
    assert.match(dnfArgs, /openssl-devel/);
    assert.doesNotMatch(dnfArgs, /(^| )curl( |$)/m);
    assert.doesNotMatch(dnfArgs, /(^| )erlang( |$)/m);
    assert.doesNotMatch(dnfArgs, /(^| )elixir( |$)/m);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

for (const installFailures of [0, 2, 3]) {
  test(`the BEAM step handles ${installFailures} Erlang install failures and remains rerunnable`, async () => {
    const root = await mkdtemp(join(tmpdir(), "symphony-mise-"));
    const binDir = join(root, "bin");
    const toolRoot = join(root, "tools");
    const miseLog = join(root, "mise.log");
    const operationLog = join(root, "operations.log");
    const configDir = join(root, "etc");
    const stateDir = join(root, "state");
    const marker = join(stateDir, "markers", "beam-28.5.0.5-1.19.5-otp-28");
    const elixirArchive = "elixir-archive";
    const elixirHash = sha256(elixirArchive);

    try {
      await mkdir(binDir);
      await mkdir(configDir);
      await writeFile(join(configDir, "runtime.env"), "PATH=/usr/bin:/bin\n");
      await writeExecutable(
        join(binDir, "mise"),
        `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >>"${miseLog}"
case "$1" in
  exec)
    # Reproduce the old implicit-install failure before Erlang exists.
    printf 'mise WARN Failed to resolve tool version list for erlang: kerl-4.4.0 list releases all failed: exit code 1\\n' >&2
    printf 'mise ERROR "erl" couldn\\x27t exec process: No such file or directory\\n' >&2
    exit 1
    ;;
  install)
    attempt=0
    [[ ! -f "${root}/attempt" ]] || read -r attempt <"${root}/attempt"
    attempt=$((attempt + 1))
    printf '%s\\n' "$attempt" >"${root}/attempt"
    if ((attempt <= ${installFailures})); then
      printf 'mise ERROR kerl-4.4.0 list releases all failed: exit code 1\\n' >&2
      exit 17
    fi
    mkdir -p "${toolRoot}/erlang@28.5.0.5/bin"
    cat >"${toolRoot}/erlang@28.5.0.5/bin/erl" <<'ERL'
#!/usr/bin/env bash
printf 'erl %s\\n' "$*" >>"${operationLog}"
exit 0
ERL
    chmod 0755 "${toolRoot}/erlang@28.5.0.5/bin/erl"
    ;;
  where)
    [[ -x "${toolRoot}/$2/bin/erl" ]] || exit 1
    printf '%s/%s\\n' "${toolRoot}" "$2"
    ;;
  *) exit 1 ;;
esac
`
      );
      await writeExecutable(
        join(binDir, "sleep"),
        `#!/usr/bin/env bash
printf 'sleep %s\\n' "$*" >>"${operationLog}"
`
      );
      await writeExecutable(
        join(binDir, "curl"),
        `#!/usr/bin/env bash
printf 'curl\\n' >>"${operationLog}"
output=""
url=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
if [[ "$url" == *.sha256sum ]]; then
  printf '${elixirHash}  elixir-otp-28.zip\\n'
else
  printf '${elixirArchive}' >"$output"
fi
`
      );
      await writeExecutable(
        join(binDir, "unzip"),
        `#!/usr/bin/env bash
dest=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -d) dest="$2"; shift 2 ;;
    *) shift ;;
  esac
done
mkdir -p "$dest/bin"
cat >"$dest/bin/elixir" <<'ELIXIR'
#!/usr/bin/env bash
exit 0
ELIXIR
cat >"$dest/bin/mix" <<'MIX'
#!/usr/bin/env bash
exit 0
MIX
chmod 0755 "$dest/bin/elixir" "$dest/bin/mix"
`
      );

      const env = {
        PATH: `${binDir}:/usr/bin:/bin`,
        SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
        SYMPHONY_BOOTSTRAP_STATE_DIR: stateDir,
        SYMPHONY_CONFIG_DIR: configDir,
        SYMPHONY_TOOLS_ROOT: toolRoot,
      };

      const runBeam = () =>
        runBash(
          `source "${step(
            "50-beam-toolchain"
          )}"; main; printf '%s\\n' "$runtime_tool_path"`,
          env
        );
      let first = runBeam();
      const attempts = (await readFile(miseLog, "utf8"))
        .split("\n")
        .filter((line) => line.startsWith("install "));
      assert.deepEqual(
        attempts,
        Array(Math.min(installFailures + 1, 3)).fill(
          "install --yes erlang@28.5.0.5"
        )
      );
      if (installFailures === 3) {
        assert.notEqual(first.status, 0);
        assert.match(first.stderr, /kerl-4\.4\.0 list releases all failed/);
        assert.match(
          first.stderr,
          /mise install --yes erlang@28\.5\.0\.5 failed after 3 attempts \(exit 17\)/
        );
        assert.doesNotMatch(await readFile(miseLog, "utf8"), /where|exec/);
        assert.equal(
          await readFile(operationLog, "utf8"),
          "sleep 5\nsleep 10\n"
        );
        await assert.rejects(stat(marker), { code: "ENOENT" });
        await assert.rejects(stat(join(stateDir, "install-state.env")), {
          code: "ENOENT",
        });
        assert.equal(
          await readFile(join(configDir, "runtime.env"), "utf8"),
          "PATH=/usr/bin:/bin\n"
        );
        // A later reconcile can recover because the failed install left no marker.
        first = runBeam();
      }
      assert.equal(first.status, 0, first.stderr);
      // Last line: progress logging shares stdout with the printed value.
      assert.equal(
        first.stdout.trim().split("\n").at(-1),
        `${toolRoot}/mise/installs/elixir/1.19.5-otp-28/bin:${toolRoot}/erlang@28.5.0.5/bin`
      );
      assert.doesNotMatch(await readFile(miseLog, "utf8"), /exec|elixir@/);
      assert.match(
        await readFile(operationLog, "utf8"),
        /erl -noshell -eval halt\(\)\.\ncurl\ncurl\n$/
      );
      await stat(marker);
      const runtimeEnv = await readFile(join(configDir, "runtime.env"), "utf8");
      const installState = await readFile(
        join(stateDir, "install-state.env"),
        "utf8"
      );

      // Reconcile rewrites runtime.env in 40-credentials before this step. The
      // marker skips installation while the tool path is still re-derived.
      await writeFile(join(configDir, "runtime.env"), "PATH=/usr/bin:/bin\n");
      await writeFile(miseLog, "");
      await writeFile(operationLog, "");
      const second = runBeam();
      assert.equal(second.status, 0, second.stderr);
      assert.equal(await readFile(miseLog, "utf8"), "where erlang@28.5.0.5\n");
      assert.equal(await readFile(operationLog, "utf8"), "");
      assert.equal(
        await readFile(join(configDir, "runtime.env"), "utf8"),
        runtimeEnv
      );
      assert.equal(
        await readFile(join(stateDir, "install-state.env"), "utf8"),
        installState
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("the Node step uses .nvmrc, installs pinned Codex, and prepends runtime PATH", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-node-"));
  const binDir = join(root, "bin");
  const stateDir = join(root, "state");
  const configDir = join(root, "etc", "symphony");
  const toolsRoot = join(root, "tools");
  const nodeArchive = "node-archive";
  const nodeHash = sha256(nodeArchive);
  const npmLog = join(root, "npm.log");
  const npmVersionFile = join(root, "npm-version");

  try {
    await mkdir(binDir);
    await mkdir(stateDir, { recursive: true });
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, "runtime.env"), "PATH='/base/bin'\n");

    await writeExecutable(
      join(binDir, "uname"),
      "#!/usr/bin/env bash\nprintf 'x86_64\\n'\n"
    );
    await writeExecutable(
      join(binDir, "jq"),
      "#!/usr/bin/env bash\nprintf 'npm@11.13.0\\n'\n"
    );
    await writeExecutable(
      join(binDir, "curl"),
      `#!/usr/bin/env bash
output=""
url=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
if [[ "$url" == *SHASUMS256.txt ]]; then
  printf '${nodeHash}  node-v20.20.0-linux-x64.tar.xz\\n'
else
  printf '${nodeArchive}' >"$output"
fi
`
    );
    await writeExecutable(
      join(binDir, "tar"),
      `#!/usr/bin/env bash
dest=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -C) dest="$2"; shift 2 ;;
    *) shift ;;
  esac
done
mkdir -p "$dest/node-v20.20.0-linux-x64/bin"
cat >"$dest/node-v20.20.0-linux-x64/bin/node" <<'NODE'
#!/usr/bin/env bash
exec bash "$@"
NODE
cat >"$dest/node-v20.20.0-linux-x64/bin/npm" <<'NPM'
#!/usr/bin/env node
prefix=""
if [[ "$1" == "--version" ]]; then
  if [[ -f "${npmVersionFile}" ]]; then
    cat "${npmVersionFile}"
  else
    printf '10.8.2\n'
  fi
  exit 0
fi
printf '%s\n' "$*" >>"${npmLog}"
if [[ "$*" == *"@openai/codex@"* ]]; then
  printf 'NPM_CONFIG_MIN_RELEASE_AGE=%s\n' "\${NPM_CONFIG_MIN_RELEASE_AGE:-}" >>"${npmLog}"
fi
if [[ "$*" == "install -g npm@11.13.0" ]]; then
  printf '11.13.0\n' >"${npmVersionFile}"
  printf 'changed 16 packages in 2s\n'
  exit 0
fi
printf 'added 2 packages in 3s\n'
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) prefix="$2"; shift 2 ;;
    *) shift ;;
  esac
done
mkdir -p "$prefix/bin"
cat >"$prefix/bin/codex" <<'CODEX'
#!/usr/bin/env bash
exit 0
CODEX
chmod 0755 "$prefix/bin/codex"
NPM
chmod 0755 "$dest/node-v20.20.0-linux-x64/bin/node" "$dest/node-v20.20.0-linux-x64/bin/npm"
`
    );

    const result = runBash(`source "${step("55-node-toolchain")}"; main`, {
      PATH: `${binDir}:${process.env.PATH}`,
      SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
      SYMPHONY_BOOTSTRAP_STATE_DIR: stateDir,
      SYMPHONY_CONFIG_DIR: configDir,
      SYMPHONY_TOOLS_ROOT: toolsRoot,
    });

    assert.equal(result.status, 0, result.stderr);
    const npmCommands = await readFile(npmLog, "utf8");
    assert.match(npmCommands, /install -g npm@11\.13\.0/);
    assert.match(npmCommands, /@openai\/codex@0\.153\.4/);
    assert.match(npmCommands, /NPM_CONFIG_MIN_RELEASE_AGE=0/);

    const runtimeEnv = await readFile(join(configDir, "runtime.env"), "utf8");
    assert.match(
      runtimeEnv,
      new RegExp(
        `PATH='${toolsRoot}/codex/0.153.4/bin:${toolsRoot}/node/v20.20.0-linux-x64/bin:/base/bin'`
      )
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the dev tools step installs pinned gh and Terraform with checksum verification", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-dev-tools-"));
  const binDir = join(root, "bin");
  const stateDir = join(root, "state");
  const configDir = join(root, "etc", "symphony");
  const toolsRoot = join(root, "tools");
  const ghArchive = "gh-archive";
  const terraformArchive = "terraform-archive";
  const ghHash = sha256(ghArchive);
  const terraformHash = sha256(terraformArchive);

  try {
    await mkdir(binDir);
    await mkdir(stateDir, { recursive: true });
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "runtime.env"),
      "PATH='/node/bin:/base/bin'\n"
    );

    await writeExecutable(
      join(binDir, "uname"),
      "#!/usr/bin/env bash\nprintf 'x86_64\\n'\n"
    );
    await writeExecutable(
      join(binDir, "curl"),
      `#!/usr/bin/env bash
output=""
url=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
case "$url" in
  *gh_2.97.0_checksums.txt) printf '${ghHash}  gh_2.97.0_linux_amd64.tar.gz\\n' ;;
  *terraform_1.4.2_SHA256SUMS) printf '${terraformHash}  terraform_1.4.2_linux_amd64.zip\\n' ;;
  *gh_2.97.0_linux_amd64.tar.gz) printf '${ghArchive}' >"$output" ;;
  *terraform_1.4.2_linux_amd64.zip) printf '${terraformArchive}' >"$output" ;;
  *) exit 1 ;;
esac
`
    );
    await writeExecutable(
      join(binDir, "tar"),
      `#!/usr/bin/env bash
dest=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -C) dest="$2"; shift 2 ;;
    *) shift ;;
  esac
done
mkdir -p "$dest/gh_2.97.0_linux_amd64/bin"
cat >"$dest/gh_2.97.0_linux_amd64/bin/gh" <<'GH'
#!/usr/bin/env bash
exit 0
GH
chmod 0755 "$dest/gh_2.97.0_linux_amd64/bin/gh"
`
    );
    await writeExecutable(
      join(binDir, "unzip"),
      `#!/usr/bin/env bash
dest=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -d) dest="$2"; shift 2 ;;
    *) shift ;;
  esac
done
cat >"$dest/terraform" <<'TF'
#!/usr/bin/env bash
exit 0
TF
chmod 0755 "$dest/terraform"
`
    );

    const result = runBash(`source "${step("60-dev-tools")}"; main`, {
      PATH: `${binDir}:${process.env.PATH}`,
      SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
      SYMPHONY_BOOTSTRAP_STATE_DIR: stateDir,
      SYMPHONY_CONFIG_DIR: configDir,
      SYMPHONY_TOOLS_ROOT: toolsRoot,
    });

    assert.equal(result.status, 0, result.stderr);
    const runtimeEnv = await readFile(join(configDir, "runtime.env"), "utf8");
    assert.match(
      runtimeEnv,
      new RegExp(
        `PATH='${toolsRoot}/gh/2.97.0-linux-amd64/bin:${toolsRoot}/terraform/1.4.2-linux-amd64/bin:/node/bin:/base/bin'`
      )
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("detects a blank workspace disk without a hard-coded device default", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-workspace-disk-"));
  const binDir = join(root, "bin");
  const lsblkLog = join(root, "lsblk.log");

  try {
    await mkdir(binDir);
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n"
    );
    await writeExecutable(
      join(binDir, "findfs"),
      "#!/usr/bin/env bash\nexit 1\n"
    );
    await writeExecutable(
      join(binDir, "lsblk"),
      `#!/usr/bin/env bash
printf '%s\\n' "$*" >"${lsblkLog}"
cat <<'LSBLK'
NAME="/dev/nvme0n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""
NAME="/dev/nvme0n1p1" PKNAME="/dev/nvme0n1" TYPE="part" FSTYPE="xfs" MOUNTPOINT="/"
NAME="/dev/nvme1n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""
LSBLK
`
    );

    const result = runBash(
      `source "${step("30-workspace-volume")}"; determine_workspace_state`,
      {
        PATH: `${binDir}:${process.env.PATH}`,
        SYMPHONY_WORKSPACE_DEVICE: "",
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "empty-volume");
    assert.doesNotMatch(await readFile(lsblkLog, "utf8"), /(^| )-r( |$)|--raw/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("waits for a late labelled workspace filesystem before reusing it", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-workspace-label-wait-"));
  const binDir = join(root, "bin");
  const findfsCount = join(root, "findfs-count");
  const sleepLog = join(root, "sleep.log");

  try {
    await mkdir(binDir);
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n"
    );
    await writeExecutable(
      join(binDir, "findfs"),
      `#!/usr/bin/env bash
count=0
if [[ -f "${findfsCount}" ]]; then count="$(cat "${findfsCount}")"; fi
count=$((count + 1))
printf '%s' "$count" >"${findfsCount}"
if [[ "$count" -lt 3 ]]; then exit 1; fi
printf '/dev/disk/by-label/SYMPHONYWS\\n'
`
    );
    await writeExecutable(
      join(binDir, "lsblk"),
      `#!/usr/bin/env bash
cat <<'LSBLK'
NAME="/dev/nvme0n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""
NAME="/dev/nvme0n1p1" PKNAME="/dev/nvme0n1" TYPE="part" FSTYPE="xfs" MOUNTPOINT="/"
LSBLK
`
    );
    await writeExecutable(
      join(binDir, "sleep"),
      `#!/usr/bin/env bash\nprintf 'sleep %s\\n' "$*" >>"${sleepLog}"\n`
    );

    const result = runBash(
      `source "${step("30-workspace-volume")}"; determine_workspace_state`,
      {
        PATH: `${binDir}:${process.env.PATH}`,
        SYMPHONY_WORKSPACE_DEVICE_WAIT_INTERVAL_SECONDS: "1",
        SYMPHONY_WORKSPACE_DEVICE_WAIT_TIMEOUT_SECONDS: "3",
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "reused");
    assert.equal(await readFile(sleepLog, "utf8"), "sleep 1\nsleep 1\n");
    assert.match(result.stderr, /waiting for workspace device/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("waits for a late explicit workspace device before classifying it", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-workspace-device-wait-"));
  const binDir = join(root, "bin");
  const devicePath = join(root, "dev", "workspace");
  const sleepLog = join(root, "sleep.log");

  try {
    await mkdir(binDir);
    await mkdir(dirname(devicePath), { recursive: true });
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n"
    );
    await writeExecutable(
      join(binDir, "findfs"),
      "#!/usr/bin/env bash\nexit 1\n"
    );
    await writeExecutable(
      join(binDir, "blkid"),
      "#!/usr/bin/env bash\nexit 0\n"
    );
    await writeExecutable(
      join(binDir, "lsblk"),
      `#!/usr/bin/env bash
cat <<'LSBLK'
NAME="/dev/nvme0n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""
NAME="/dev/nvme0n1p1" PKNAME="/dev/nvme0n1" TYPE="part" FSTYPE="xfs" MOUNTPOINT="/"
LSBLK
`
    );
    await writeExecutable(
      join(binDir, "sleep"),
      `#!/usr/bin/env bash
printf 'sleep %s\\n' "$*" >>"${sleepLog}"
: >"${devicePath}"
`
    );

    const result = runBash(
      `source "${step("30-workspace-volume")}"; determine_workspace_state`,
      {
        PATH: `${binDir}:${process.env.PATH}`,
        SYMPHONY_WORKSPACE_DEVICE: devicePath,
        SYMPHONY_WORKSPACE_DEVICE_WAIT_INTERVAL_SECONDS: "1",
        SYMPHONY_WORKSPACE_DEVICE_WAIT_TIMEOUT_SECONDS: "3",
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "reused");
    assert.equal(await readFile(sleepLog, "utf8"), "sleep 1\n");
    assert.match(result.stderr, new RegExp(`device=${devicePath}`));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("waits for a late blank workspace disk before classifying it empty", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-workspace-blank-wait-"));
  const binDir = join(root, "bin");
  const lsblkCount = join(root, "lsblk-count");
  const sleepLog = join(root, "sleep.log");

  try {
    await mkdir(binDir);
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n"
    );
    await writeExecutable(
      join(binDir, "findfs"),
      "#!/usr/bin/env bash\nexit 1\n"
    );
    await writeExecutable(
      join(binDir, "lsblk"),
      `#!/usr/bin/env bash
count=0
if [[ -f "${lsblkCount}" ]]; then count="$(cat "${lsblkCount}")"; fi
count=$((count + 1))
printf '%s' "$count" >"${lsblkCount}"
cat <<'LSBLK'
NAME="/dev/nvme0n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""
NAME="/dev/nvme0n1p1" PKNAME="/dev/nvme0n1" TYPE="part" FSTYPE="xfs" MOUNTPOINT="/"
LSBLK
if [[ "$count" -ge 2 ]]; then
  printf 'NAME="/dev/nvme1n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""\\n'
fi
`
    );
    await writeExecutable(
      join(binDir, "sleep"),
      `#!/usr/bin/env bash\nprintf 'sleep %s\\n' "$*" >>"${sleepLog}"\n`
    );

    const result = runBash(
      `source "${step("30-workspace-volume")}"; determine_workspace_state`,
      {
        PATH: `${binDir}:${process.env.PATH}`,
        SYMPHONY_WORKSPACE_DEVICE_WAIT_INTERVAL_SECONDS: "1",
        SYMPHONY_WORKSPACE_DEVICE_WAIT_TIMEOUT_SECONDS: "3",
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "empty-volume");
    assert.equal(await readFile(sleepLog, "utf8"), "sleep 1\n");
    assert.match(result.stderr, /waiting for workspace device/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("times out waiting for a workspace volume and names the missing label", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-workspace-timeout-"));
  const binDir = join(root, "bin");
  const sleepLog = join(root, "sleep.log");

  try {
    await mkdir(binDir);
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n"
    );
    await writeExecutable(
      join(binDir, "findfs"),
      "#!/usr/bin/env bash\nexit 1\n"
    );
    await writeExecutable(
      join(binDir, "lsblk"),
      `#!/usr/bin/env bash
cat <<'LSBLK'
NAME="/dev/nvme0n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""
NAME="/dev/nvme0n1p1" PKNAME="/dev/nvme0n1" TYPE="part" FSTYPE="xfs" MOUNTPOINT="/"
LSBLK
`
    );
    await writeExecutable(
      join(binDir, "sleep"),
      `#!/usr/bin/env bash\nprintf 'sleep %s\\n' "$*" >>"${sleepLog}"\n`
    );

    const result = runBash(
      `source "${step("30-workspace-volume")}"; determine_workspace_state`,
      {
        PATH: `${binDir}:${process.env.PATH}`,
        SYMPHONY_WORKSPACE_DEVICE_WAIT_INTERVAL_SECONDS: "1",
        SYMPHONY_WORKSPACE_DEVICE_WAIT_TIMEOUT_SECONDS: "2",
        SYMPHONY_WORKSPACE_LABEL: "MISSINGWS",
      }
    );

    assert.notEqual(result.status, 0);
    assert.equal(await readFile(sleepLog, "utf8"), "sleep 1\nsleep 1\n");
    assert.match(
      result.stderr,
      /LABEL=MISSINGWS was not found after waiting 2s/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails closed when a required secret is missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-secret-"));
  const secretsDir = join(root, "secrets");

  try {
    await mkdir(secretsDir, { recursive: true });
    const result = runBash(
      `source "${join(hostDir, "lib.sh")}"; require_secret 'symphony/keys'`,
      {
        SYMPHONY_BOOTSTRAP_STATE_DIR: join(root, "state"),
        SYMPHONY_SECRETS_DIR: secretsDir,
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing required secret: symphony\/keys/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writes complete provenance including checkout dirty state", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-provenance-"));

  try {
    const {
      bootstrapHead,
      bundleCurrent,
      bundleRelease,
      codexHome,
      env,
      provenancePath,
      runtimeHead,
    } = await makeProvenanceFixture(root);

    const result = runBash(
      `source "${step("90-provenance")}"; write_provenance "${provenancePath}"`,
      env
    );

    assert.equal(result.status, 0, result.stderr);
    const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
    assert.equal(provenance.timestamp, "2026-08-08T22:00:00Z");
    assert.equal(provenance.installer.checksum_sha256, "abcdef");
    assert.equal(provenance.instance.ami_id, "ami-123");
    assert.equal(provenance.refs.bootstrap.desired_ref, "main");
    assert.equal(provenance.refs.bootstrap.resolved_sha, bootstrapHead);
    assert.equal(provenance.refs.runtime.resolved_sha, runtimeHead);
    assert.equal(provenance.refs.bootstrap.stashed, false);
    assert.equal(provenance.refs.runtime.stashed, true);
    assert.equal(provenance.worker_slots, 6);
    assert.equal(provenance.workspace.state, "empty-volume");
    assert.match(provenance.codex.version, /0\.147\.0$/);
    assert.equal(provenance.codex.config_path, join(codexHome, "config.toml"));
    assert.equal(provenance.runtime_bundle.repo_sha, bootstrapHead);
    assert.equal(provenance.runtime_bundle.bundle_sha256, "bundle-content-sha");
    assert.equal(
      provenance.runtime_bundle.manifest_path,
      join(bundleCurrent, "manifest.json")
    );
    assert.equal(
      provenance.runtime_bundle.workflow_source_sha256,
      "workflow-source-sha"
    );
    assert.equal(provenance.runtime_bundle.release_path, bundleRelease);
    assert.equal(provenance.runtime_bundle.current_target, bundleRelease);
    assert.deepEqual(provenance.runtime_bundle.installed_skills[0], {
      name: "symphony-proof-of-work",
      kind: "private",
      destination: join(codexHome, "skills", "symphony-proof-of-work"),
      linkTarget: join(bundleCurrent, "skills", "symphony-proof-of-work"),
      sourceSha256: "skill-sha",
    });
    assert.equal(
      provenance.credentials.presence_manifest_path,
      join(root, "state", "credential-presence.json")
    );
    assert.equal(
      provenance.credentials.checks.schemaVersion,
      "symphony-host-credential-presence/v1"
    );
    assert.equal(
      provenance.credentials.checks.runtime_env_keys.CODEX_HOME,
      true
    );
    assert.equal(
      provenance.credentials.checks.codex.config_toml.path,
      join(codexHome, "config.toml")
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a missing runtime bundle manifest fails closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-provenance-missing-"));

  try {
    const { env } = await makeProvenanceFixture(root, { manifest: false });
    const result = runBash(
      `source "${step("90-provenance")}"; write_provenance "${join(
        root,
        "p.json"
      )}"`,
      env
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing runtime bundle manifest/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("provenance fails closed when credential presence checks fail", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "symphony-provenance-credentials-")
  );

  try {
    const { configDir, env, provenancePath } = await makeProvenanceFixture(
      root
    );
    await writeFile(join(configDir, "runtime.env"), "CODEX_HOME=''\n");

    const result = runBash(
      `source "${step("90-provenance")}"; write_provenance "${provenancePath}"`,
      env
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /credential presence check failed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a manifest-present missing provenance field fails closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-provenance-field-"));

  try {
    const { env, provenancePath } = await makeProvenanceFixture(root, {
      manifestOverrides: { workflowSha: "" },
    });
    const result = runBash(
      `source "${step("90-provenance")}"; write_provenance "${provenancePath}"`,
      env
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing required provenance field/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime bundle repo SHA must match the bootstrap checkout SHA", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-provenance-repo-sha-"));

  try {
    const { env, provenancePath } = await makeProvenanceFixture(root, {
      manifestRepoSha: "abc4700000000000000000000000000000000000",
    });
    const result = runBash(
      `source "${step("90-provenance")}"; write_provenance "${provenancePath}"`,
      env
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /runtime bundle repo SHA .* does not match bootstrap SHA/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime install builds the escript from the elixir subdirectory of the checkout", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-elixir-build-"));
  const binDir = join(root, "bin");
  const remoteRoot = join(root, "remotes");
  const remote = join(remoteRoot, "1000lines", "symphony.git");
  const seed = join(root, "seed");
  const mixLog = join(root, "mix.log");
  const optRoot = join(root, "opt", "symphony");
  const buildHome = join(root, "state", "runtime-build-home");

  try {
    await mkdir(binDir);
    spawnSync("git", ["init", "--bare", "--initial-branch", "main", remote], {
      env: { ...process.env, ...gitEnv },
    });
    spawnSync("git", ["init", "--initial-branch", "main", seed], {
      env: { ...process.env, ...gitEnv },
    });
    await mkdir(join(seed, "elixir"), { recursive: true });
    await writeFile(
      join(seed, "elixir", "mix.exs"),
      "defmodule Fixture.MixProject do\nend\n"
    );
    for (const args of [
      ["add", "."],
      ["commit", "-m", "seed"],
      ["remote", "add", "origin", remote],
      ["push", "-u", "origin", "main"],
    ]) {
      const stepResult = spawnSync("git", args, {
        cwd: seed,
        encoding: "utf8",
        env: { ...process.env, ...gitEnv },
      });
      assert.equal(stepResult.status, 0, stepResult.stderr);
    }
    const head = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: seed,
      encoding: "utf8",
      env: { ...process.env, ...gitEnv },
    }).stdout.trim();

    await writeExecutable(
      join(binDir, "mix"),
      `#!/usr/bin/env bash
if [[ -z "\${HOME:-}" ]]; then exit 22; fi
printf '%s|%s|%s\\n' "$PWD" "$HOME" "$*" >>"${mixLog}"
if [[ "$*" == "escript.build" ]]; then
  mkdir -p bin
  cat >bin/symphony <<'STUB'
#!/usr/bin/env bash
printf 'fixture symphony\\n'
STUB
  chmod 0755 bin/symphony
fi
`
    );

    const result = runBash(
      `source "${step("70-symphony-escript")}"; install_runtime_escript`,
      {
        PATH: `${binDir}:${process.env.PATH}`,
        SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
        SYMPHONY_BOOTSTRAP_STATE_DIR: join(root, "state"),
        SYMPHONY_GITHUB_BASE_URL: `file://${remoteRoot}`,
        SYMPHONY_OPT_ROOT: optRoot,
        SYMPHONY_RUNTIME_REF: "main",
        HOME: "",
      }
    );

    assert.equal(result.status, 0, result.stderr);
    // Built inside the checkout, so _build persists between runs.
    assert.match(
      await readFile(mixLog, "utf8"),
      new RegExp(
        `${optRoot}/src/symphony/elixir\\|${buildHome}\\|escript\\.build`
      )
    );
    // Published to a content-addressed release directory keyed on the real HEAD.
    assert.match(
      await readFile(
        join(optRoot, "releases", head, "bin", "symphony"),
        "utf8"
      ),
      /fixture symphony/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a full fixture run materializes credentials, units, workspace, and provenance", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-install-"));
  const secretsDir = join(root, "secrets");
  const stateDir = join(root, "state");
  const configDir = join(root, "etc", "symphony");
  const systemdDir = join(root, "systemd");
  const workspaceRoot = join(root, "workspace");
  const logsRoot = join(root, "logs");
  const optRoot = join(root, "opt", "symphony");
  const remoteRoot = join(root, "remotes");
  const remote = join(remoteRoot, "1000lines", "symphony.git");
  const seed = join(root, "seed");

  try {
    await mkdir(join(secretsDir, "symphony"), { recursive: true });
    await writeFile(
      join(secretsDir, "symphony", "keys"),
      JSON.stringify({
        GITHUB_TOKEN: "github-token",
        LINEAR_API_TOKEN: "linear-token",
        OPENAI_API_KEY: "openai-key",
      })
    );

    spawnSync("git", ["init", "--bare", "--initial-branch", "main", remote], {
      env: { ...process.env, ...gitEnv },
    });
    spawnSync("git", ["init", "--initial-branch", "main", seed], {
      env: { ...process.env, ...gitEnv },
    });
    await writeFile(join(seed, "README.md"), "fixture\n");
    for (const args of [
      ["add", "."],
      ["commit", "-m", "seed"],
      ["remote", "add", "origin", remote],
      ["push", "-u", "origin", "main"],
    ]) {
      spawnSync("git", args, {
        cwd: seed,
        encoding: "utf8",
        env: { ...process.env, ...gitEnv },
      });
    }

    const env = {
      SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
      SYMPHONY_AMI_ID: "ami-fixture",
      SYMPHONY_AWS_REGION: "us-west-2",
      SYMPHONY_BOOTSTRAP_LOG_DIR: join(root, "bootstrap-logs"),
      SYMPHONY_BOOTSTRAP_REF: "main",
      SYMPHONY_BOOTSTRAP_SHA: "1111111111111111111111111111111111111111",
      SYMPHONY_BOOTSTRAP_STATE_DIR: stateDir,
      SYMPHONY_BOOTSTRAP_TIMESTAMP: "2026-08-08T22:30:00Z",
      SYMPHONY_CONFIG_DIR: configDir,
      SYMPHONY_GITHUB_BASE_URL: `file://${remoteRoot}`,
      SYMPHONY_INSTALLER_CHECKSUM: "installer-checksum",
      SYMPHONY_INSTALLER_PATH: runnerScript,
      SYMPHONY_INSTALLER_URL:
        "https://github.com/example-org/example-repo/tree/sha",
      SYMPHONY_INSTANCE_ID: "i-fixture",
      SYMPHONY_LOGS_ROOT: logsRoot,
      SYMPHONY_OPT_ROOT: optRoot,
      SYMPHONY_RUNTIME_GROUP: currentGroup,
      SYMPHONY_RUNTIME_REF: "main",
      SYMPHONY_RUNTIME_USER: currentUser,
      SYMPHONY_SECRETS_DIR: secretsDir,
      SYMPHONY_SKIP_BEAM_TOOLCHAIN: "1",
      SYMPHONY_SKIP_DEV_TOOLS: "1",
      SYMPHONY_SKIP_NODE_TOOLCHAIN: "1",
      SYMPHONY_SKIP_PACKAGES: "1",
      SYMPHONY_SKIP_RUNTIME_INSTALL: "1",
      SYMPHONY_SKIP_SYSTEMD: "1",
      SYMPHONY_SKIP_USERADD: "1",
      SYMPHONY_SYSTEMD_DIR: systemdDir,
      SYMPHONY_WORKER_SLOTS: "6",
      SYMPHONY_WORKSPACE_MANAGE_FSTAB: "0",
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
      SYMPHONY_WORKSPACE_SKIP_MOUNT: "1",
    };

    // 05-source is covered by lib.test.mjs; starting at 10 keeps this fixture
    // from needing an example-repo remote and a mid-run re-exec.
    const result = runRunner(["--from", "10-os-packages"], env);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const runtimeEnv = await readFile(join(configDir, "runtime.env"), "utf8");
    assert.match(runtimeEnv, new RegExp(`HOME='${workspaceRoot}'`));
    assert.match(runtimeEnv, /GITHUB_TOKEN='github-token'/);
    assert.equal(runtimeEnv.includes("GOOGLE_APPLICATION_CREDENTIALS="), false);
    assert.ok(runtimeEnv.includes(`GIT_ASKPASS='${configDir}/git-askpass.sh'`));
    assert.match(runtimeEnv, /GIT_TERMINAL_PROMPT='0'/);
    assert.match(runtimeEnv, /GCM_INTERACTIVE='never'/);
    assert.match(runtimeEnv, /GIT_CONFIG_KEY_0='credential.helper'/);
    assert.match(runtimeEnv, /GIT_CONFIG_VALUE_0=''/);
    assert.match(runtimeEnv, /GIT_CONFIG_COUNT='2'/);
    assert.match(runtimeEnv, /GIT_AUTHOR_NAME='1000-symphony-bot'/);
    assert.match(runtimeEnv, /GIT_COMMITTER_EMAIL='327018241\+1000-symphony-bot@users\.noreply\.github\.com'/);
    assert.ok(
      runtimeEnv.includes(`CODEX_HOME='${workspaceRoot}/cache/codex-home'`)
    );
    assert.ok(
      runtimeEnv.includes(`NPM_CONFIG_CACHE='${workspaceRoot}/cache/npm'`)
    );
    assert.match(
      runtimeEnv,
      /PATH='\/usr\/local\/sbin:\/usr\/local\/bin:\/usr\/sbin:\/usr\/bin:\/sbin:\/bin'/
    );

    const askpassMode = (await stat(join(configDir, "git-askpass.sh"))).mode;
    assert.notEqual(askpassMode & 0o111, 0);

    const codexHome = join(workspaceRoot, "cache", "codex-home");
    const auth = JSON.parse(
      await readFile(join(codexHome, "auth.json"), "utf8")
    );
    assert.equal(auth.OPENAI_API_KEY, "openai-key");
    assert.equal(
      (await stat(join(codexHome, "auth.json"))).mode & 0o777,
      0o600
    );
    assert.equal(
      await readFile(join(codexHome, "config.toml"), "utf8"),
      'preferred_auth_method = "apikey"\n'
    );
    assert.match(
      await readFile(join(codexHome, "AGENTS.md"), "utf8"),
      /Hosted Symphony Codex Runtime/
    );
    assert.equal(
      await readlink(join(workspaceRoot, "cache", "runtime-bundle", "current")),
      join(
        workspaceRoot,
        "cache",
        "runtime-bundle",
        "releases",
        env.SYMPHONY_BOOTSTRAP_SHA
      )
    );

    const installedManifest = JSON.parse(
      await readFile(join(codexHome, "runtime-bundle-manifest.json"), "utf8")
    );
    assert.equal(installedManifest.repo.sha, env.SYMPHONY_BOOTSTRAP_SHA);
    assert.equal(
      installedManifest.bundle.currentLink,
      join(workspaceRoot, "cache", "runtime-bundle", "current")
    );
    assert.ok(
      installedManifest.skills.some(
        (skill) =>
          skill.name === "symphony-proof-of-work" && skill.kind === "private"
      )
    );
    assert.ok(
      installedManifest.skills.some(
        (skill) =>
          skill.name === "karpathy-guidelines" && skill.kind === "shared"
      )
    );
    assert.equal(
      await readlink(join(codexHome, "skills", "symphony-proof-of-work")),
      join(
        workspaceRoot,
        "cache",
        "runtime-bundle",
        "current",
        "skills",
        "symphony-proof-of-work"
      )
    );
    assert.equal(
      await readlink(join(codexHome, "skills", "karpathy-guidelines")),
      join(
        workspaceRoot,
        "cache",
        "runtime-bundle",
        "current",
        "shared-skills",
        "karpathy-guidelines"
      )
    );
    assert.notEqual(
      (
        await lstat(
          join(codexHome, "runtime", "bin", "codex-with-runtime-bundle.sh")
        )
      ).mode & 0o111,
      0
    );

    const credentialPresence = JSON.parse(
      await readFile(join(stateDir, "credential-presence.json"), "utf8")
    );
    assert.equal(
      credentialPresence.schemaVersion,
      "symphony-host-credential-presence/v1"
    );
    assert.equal(credentialPresence.runtime_env_keys.GITHUB_TOKEN, true);
    assert.equal(credentialPresence.runtime_env_keys.OPENAI_API_KEY, true);
    assert.equal(credentialPresence.files.git_askpass.executable, true);
    assert.equal(
      credentialPresence.codex.config_toml.path,
      join(codexHome, "config.toml")
    );
    for (const secret of [
      "github-token",
      "linear-token",
      "openai-key",
      "private_key",
    ]) {
      assert.equal(JSON.stringify(credentialPresence).includes(secret), false);
    }

    const service = await readFile(
      join(systemdDir, "symphony.service"),
      "utf8"
    );
    assert.ok(service.includes(`${optRoot}/current/bin/symphony`));
    assert.ok(service.includes(`ReadWritePaths=${workspaceRoot}`));
    assert.ok(
      service.includes("Wants=network-online.target symphony-reconcile.service")
    );

    const reconcile = await readFile(
      join(systemdDir, "symphony-reconcile.service"),
      "utf8"
    );
    assert.ok(reconcile.includes("RemainAfterExit=yes"));
    assert.ok(reconcile.includes("WantedBy=multi-user.target"));

    for (const dir of [
      "workspaces",
      "sessions",
      "artifacts",
      "cache",
      "logs",
    ]) {
      assert.equal((await stat(join(workspaceRoot, dir))).isDirectory(), true);
    }

    const provenance = JSON.parse(
      await readFile(join(stateDir, "provenance.json"), "utf8")
    );
    assert.equal(provenance.workspace.state, "skip-mount");
    assert.equal(
      provenance.refs.bootstrap.resolved_sha,
      env.SYMPHONY_BOOTSTRAP_SHA
    );
    assert.equal(provenance.refs.runtime.stashed, false);
    assert.equal(provenance.worker_slots, 6);
    assert.equal(provenance.codex.home, codexHome);
    assert.equal(provenance.codex.config_path, join(codexHome, "config.toml"));
    assert.equal(
      provenance.runtime_bundle.repo_sha,
      env.SYMPHONY_BOOTSTRAP_SHA
    );
    assert.equal(
      provenance.runtime_bundle.manifest_path,
      join(workspaceRoot, "cache", "runtime-bundle", "current", "manifest.json")
    );
    assert.equal(
      provenance.runtime_bundle.current_link,
      join(workspaceRoot, "cache", "runtime-bundle", "current")
    );
    assert.ok(
      provenance.runtime_bundle.installed_skills.some(
        (skill) => skill.name === "linear-graphql" && skill.kind === "shared"
      )
    );
    assert.deepEqual(provenance.credentials.checks, credentialPresence);
    for (const secret of [
      "github-token",
      "linear-token",
      "openai-key",
      "postgres://example",
      "private_key",
    ]) {
      assert.equal(
        JSON.stringify(provenance.credentials).includes(secret),
        false
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("credentials install from symphony/keys without Google credentials", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-credentials-"));
  try {
    const secretsDir = join(root, "secrets");
    const stateDir = join(root, "state");
    const configDir = join(root, "config");
    const workspaceRoot = join(root, "workspace");
    await mkdir(join(secretsDir, "symphony"), { recursive: true });
    await mkdir(stateDir);
    await mkdir(configDir);
    await writeFile(
      join(secretsDir, "symphony", "keys"),
      JSON.stringify({
        GITHUB_TOKEN: "fixture-github",
        LINEAR_API_TOKEN: "fixture-linear",
        OPENAI_API_KEY: "fixture-openai",
      })
    );
    const result = runBash(`bash "${step("40-credentials")}"`, {
      SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
      SYMPHONY_SECRETS_DIR: secretsDir,
      SYMPHONY_BOOTSTRAP_STATE_DIR: stateDir,
      SYMPHONY_CONFIG_DIR: configDir,
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
      SYMPHONY_WORKER_SLOTS: "1",
      SYMPHONY_RUNTIME_USER: currentUser,
      SYMPHONY_RUNTIME_GROUP: currentGroup,
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(
      await readFile(join(stateDir, "credential-presence.json"), "utf8")
    );
    const runtimeEnv = await readFile(join(configDir, "runtime.env"), "utf8");
    assert.match(runtimeEnv, /SYMPHONY_BOT_USER='1000-symphony-bot'/);
    assert.match(runtimeEnv, /CADENCE_REVIEWER='1000-cadence-bot'/);
    assert.match(runtimeEnv, /GIT_AUTHOR_EMAIL='327018241\+1000-symphony-bot@users\.noreply\.github\.com'/);
    assert.equal(report.files.google_credentials.present, false);
    assert.equal(report.runtime_env_keys.GOOGLE_APPLICATION_CREDENTIALS, false);
    for (const key of ["GITHUB_TOKEN", "LINEAR_API_TOKEN", "OPENAI_API_KEY"]) {
      assert.equal(report.runtime_env_keys[key], true);
    }
    const authPath = join(workspaceRoot, "cache", "codex-home", "auth.json");
    assert.equal(
      JSON.parse(await readFile(authPath, "utf8")).OPENAI_API_KEY,
      "fixture-openai"
    );
    assert.equal((await stat(authPath)).mode & 0o777, 0o600);
    assert.equal(JSON.stringify(report).includes("fixture-openai"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
