import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

const step = new URL("./install.d/37-caddy.sh", import.meta.url).pathname;
const caddyInstaller = await readFile(step, "utf8");

const runBash = (command, env = {}) =>
  spawnSync("bash", ["-c", command], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

test("writes a TLS-ALPN-only Caddy endpoint that preserves the ALB method policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-caddy-"));
  const metadataDir = join(root, "metadata");
  const configDir = join(root, "etc", "caddy");
  const systemdDir = join(root, "systemd");
  const workspaceRoot = join(root, "workspace");
  const tagPath = join(
    metadataDir,
    "latest",
    "meta-data",
    "tags",
    "instance",
    "symphony:public-hostname"
  );

  try {
    await mkdir(join(metadataDir, "latest", "meta-data", "tags", "instance"), {
      recursive: true,
    });
    await mkdir(systemdDir, { recursive: true });
    await writeFile(tagPath, "symphony.1000lines.dev\n");

    const result = runBash(
      `source "${step}"; hostname="$(public_hostname)"; write_caddy_config "$hostname"; write_caddy_unit`,
      {
        SYMPHONY_METADATA_DIR: metadataDir,
        SYMPHONY_CADDY_CONFIG_DIR: configDir,
        SYMPHONY_CADDY_DATA_DIR: join(workspaceRoot, "caddy"),
        SYMPHONY_SYSTEMD_DIR: systemdDir,
        SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
      }
    );

    assert.equal(result.status, 0, result.stderr);
    const config = await readFile(join(configDir, "Caddyfile"), "utf8");
    assert.match(config, /symphony\.1000lines\.dev/);
    assert.match(config, /disable_http_challenge/);
    assert.match(config, /@safe method GET HEAD/);
    assert.match(config, /reverse_proxy 127\.0\.0\.1:4000/);
    assert.match(config, /Method Not Allowed" 405/);

    const unit = await readFile(join(systemdDir, "caddy.service"), "utf8");
    assert.match(unit, /RequiresMountsFor=.*workspace\/caddy/);
    assert.match(unit, /XDG_DATA_HOME=.*workspace\/caddy\/data/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pins a SHA-256 checksum for the Caddy archive", () => {
  assert.match(caddyInstaller, /caddy_archive_sha256="[0-9a-f]{64}"/);
});
