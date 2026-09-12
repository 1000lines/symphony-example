import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("./host/install.d/35-docker.sh", import.meta.url)
);
const hashes = {
  x86_64: "7af95166a730b87e172d4fc9aefea8725d3c6c7327d59149267b452114ddb7d4",
  aarch64: "49082844b87f03cdcd5f5bbef1ba8c9c897b7a2dfb80cea18d61ec8ca6117e0c",
};

function fixture(t, arch = "x86_64") {
  const root = mkdtempSync(join(process.cwd(), ".compose-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, "bin");
  const plugins = join(root, "plugins");
  mkdirSync(bin);
  mkdirSync(plugins);
  const executable = (path, body) =>
    writeFileSync(path, `#!/bin/bash\nset -eu\n${body}\n`, { mode: 0o755 });
  const asset = join(root, "asset");
  executable(asset, '[[ "$*" == "compose version --short" ]]; echo 2.39.4');
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    SYMPHONY_RUNTIME_USER: "fixture-worker",
    SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
    SYMPHONY_SKIP_PACKAGES: "0",
    SYMPHONY_DOCKER_CLI_PLUGIN_DIR: plugins,
    SYMPHONY_BOOTSTRAP_STATE_DIR: join(root, "state"),
    DOCKER_TEST_ARCH: arch,
    DOCKER_TEST_ASSET: asset,
    DOCKER_TEST_HASH:
      hashes[arch === "arm64" ? "aarch64" : arch] || "unsupported",
    DOCKER_TEST_LOG: join(root, "calls"),
    DOCKER_TEST_REAL_SHA: spawnSync("which", ["sha256sum"], {
      encoding: "utf8",
    }).stdout.trim(),
  };
  executable(join(bin, "uname"), 'echo "$DOCKER_TEST_ARCH"');
  executable(
    join(bin, "runuser"),
    '[[ "$1" == -u && "$3" == -- ]]; export DOCKER_TEST_USER="$2"; shift 3; exec "$@"'
  );
  executable(
    join(bin, "curl"),
    `
printf 'download %s\\n' "$*" >> "$DOCKER_TEST_LOG"
[[ "$1" == -fsSL && "$2" == -o ]]
if [[ "\${DOCKER_TEST_RACE:-0}" == 1 ]]; then echo operator-owned > "$SYMPHONY_DOCKER_CLI_PLUGIN_DIR/docker-compose"; fi
if [[ "\${DOCKER_TEST_BAD_DOWNLOAD:-0}" == 1 ]]; then echo corrupt > "$3"; else cp "$DOCKER_TEST_ASSET" "$3"; fi`
  );
  // The network boundary supplies synthetic executable bytes. Map only those
  // bytes to the published digest; corrupted/conflicting files use real SHA-256.
  executable(
    join(bin, "sha256sum"),
    `
if cmp -s "$1" "$DOCKER_TEST_ASSET"; then printf '%s  %s\\n' "$DOCKER_TEST_HASH" "$1";
else exec "$DOCKER_TEST_REAL_SHA" "$@"; fi`
  );
  executable(
    join(bin, "docker"),
    `
printf '%s %s\\n' "\${DOCKER_TEST_USER:-installer}" "$*" >> "$DOCKER_TEST_LOG"
plugin="$SYMPHONY_DOCKER_CLI_PLUGIN_DIR/docker-compose"
if [[ "\${DOCKER_TEST_USER:-}" == fixture-worker && -n "\${DOCKER_TEST_OPERATOR_PLUGIN:-}" ]]; then plugin="$DOCKER_TEST_OPERATOR_PLUGIN"; fi
if [[ "$1" == info ]]; then
  [[ "$3" == *ClientInfo.Plugins* && "$3" == *ClientErrors* ]]
  if [[ -n "\${DOCKER_TEST_SHADOW_PLUGIN:-}" ]]; then
    jq -n --arg path "$DOCKER_TEST_ASSET" --arg shadow "$DOCKER_TEST_SHADOW_PLUGIN" '{plugins:[{Name:"compose",Path:$path,ShadowedPaths:[$shadow]}],errors:[]}'
    exit
  fi
  if [[ -e "$plugin" || -L "$plugin" ]]; then jq -n --arg path "$plugin" '{plugins:[{Name:"compose",Path:$path}],errors:[]}';
  else echo '{"plugins":[],"errors":[]}'; fi
else
  [[ "\${DOCKER_TEST_HIDE_WORKER:-0}" != 1 || "\${DOCKER_TEST_USER:-}" != fixture-worker ]]
  exec "$plugin" "$@"
fi`
  );
  executable(join(bin, "dockerd"), "exit 99");
  executable(join(bin, "systemctl"), "exit 99");
  return {
    root,
    plugins,
    env,
    asset,
    plugin: join(plugins, "docker-compose"),
    calls: () => readFileSync(env.DOCKER_TEST_LOG, "utf8"),
    run: () =>
      spawnSync(
        "bash",
        [
          "-c",
          'source "$1"; configure_docker() { echo configured >> "$DOCKER_TEST_LOG"; }; main',
          "fixture",
          script,
        ],
        { env, encoding: "utf8" }
      ),
  };
}

for (const arch of ["x86_64", "aarch64", "arm64"]) {
  test(`Compose ${arch}: verified install, worker discovery and idempotent rerun`, (t) => {
    const f = fixture(t, arch);
    const first = f.run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(readFileSync(f.plugin, "utf8"), readFileSync(f.asset, "utf8"));
    const installed = statSync(f.plugin);
    assert.equal(installed.mode & 0o777, 0o755);
    assert.match(
      f.calls(),
      new RegExp(
        `v2.39.4/docker-compose-linux-${arch === "arm64" ? "aarch64" : arch}`
      )
    );
    assert.match(
      f.calls(),
      /fixture-worker compose version --short\nconfigured/
    );
    const second = f.run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(statSync(f.plugin).ino, installed.ino);
    assert.equal(statSync(f.plugin).mtimeMs, installed.mtimeMs);
    assert.equal(f.calls().match(/download /g).length, 1);
    assert.deepEqual(readdirSync(f.plugins), ["docker-compose"]);
  });
}

for (const location of ["system", "worker", "dangling symlink"]) {
  test(`Compose refuses conflicting ${location} installation without overwriting`, (t) => {
    const f = fixture(t);
    const conflict =
      location === "worker" ? join(f.root, "operator-compose") : f.plugin;
    if (location === "dangling symlink")
      symlinkSync("missing-operator-target", conflict);
    else writeFileSync(conflict, "operator-owned", { mode: 0o755 });
    if (location === "worker") f.env.DOCKER_TEST_OPERATOR_PLUGIN = conflict;
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /conflicting Compose installation/);
    if (location !== "dangling symlink")
      assert.equal(readFileSync(conflict, "utf8"), "operator-owned");
    assert.doesNotMatch(f.calls(), /download|configured/);
  });
}

test("Compose checksum failure cleans staging and never publishes", (t) => {
  const f = fixture(t);
  f.env.DOCKER_TEST_BAD_DOWNLOAD = "1";
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checksum mismatch/);
  assert.deepEqual(readdirSync(f.plugins), []);
  assert.doesNotMatch(f.calls(), /configured/);
});

test("Compose refuses to shadow an operator plugin", (t) => {
  const f = fixture(t);
  const shadow = join(f.root, "shadowed-compose");
  writeFileSync(shadow, "operator-owned", { mode: 0o755 });
  f.env.DOCKER_TEST_SHADOW_PLUGIN = shadow;
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /conflicting Compose installation/);
  assert.equal(readFileSync(shadow, "utf8"), "operator-owned");
  assert.doesNotMatch(f.calls(), /download|configured/);
});

test("Compose refuses a destination created during download", (t) => {
  const f = fixture(t);
  f.env.DOCKER_TEST_RACE = "1";
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Compose destination changed/);
  assert.equal(readFileSync(f.plugin, "utf8"), "operator-owned\n");
  assert.deepEqual(readdirSync(f.plugins), ["docker-compose"]);
  assert.doesNotMatch(f.calls(), /configured/);
});

test("package skip still skips Compose and daemon setup", (t) => {
  const f = fixture(t);
  f.env.SYMPHONY_SKIP_PACKAGES = "1";
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /skipping Docker setup/);
  assert.deepEqual(readdirSync(f.plugins), []);
});

test("Compose rejects unsupported architecture before download or configuration", (t) => {
  const f = fixture(t, "s390x");
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsupported Compose architecture: s390x/);
  assert.deepEqual(readdirSync(f.plugins), []);
});

test("Compose fails when the runtime user cannot discover the installed plugin", (t) => {
  const f = fixture(t);
  f.env.DOCKER_TEST_HIDE_WORKER = "1";
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not discoverable for fixture-worker/);
  assert.doesNotMatch(f.calls(), /configured/);
});
