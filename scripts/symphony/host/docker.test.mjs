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
import { fileURLToPath } from "node:url";

const script = join(
  dirname(fileURLToPath(import.meta.url)),
  "install.d/35-docker.sh"
);

test("Docker configuration uses workspace storage, survives reruns, and refuses relocation", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-docker-"));
  try {
    const bin = join(root, "bin");
    const configDir = join(root, "docker");
    const systemd = join(root, "systemd");
    await mkdir(bin);
    for (const command of ["docker", "dockerd", "systemctl"]) {
      const path = join(bin, command);
      await writeFile(
        path,
        '#!/bin/sh\nprintf "%s\\n" "$0 $*" >> "$DOCKER_TEST_LOG"\n'
      );
      await chmod(path, 0o755);
    }
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      SYMPHONY_ALLOW_NON_ROOT_INSTALL: "1",
      SYMPHONY_DOCKER_CONFIG_DIR: configDir,
      SYMPHONY_SYSTEMD_DIR: systemd,
      SYMPHONY_WORKSPACE_ROOT: join(root, "workspace"),
      SYMPHONY_RUNTIME_GROUP: "test-workers",
      DOCKER_TEST_LOG: join(root, "calls"),
    };
    const run = () => spawnSync("bash", [script], { env, encoding: "utf8" });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const configPath = join(configDir, "daemon.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    assert.equal(config["data-root"], join(root, "workspace/docker"));
    assert.equal(config.group, "test-workers");
    assert.equal(config.hosts, undefined);
    assert.match(
      await readFile(join(systemd, "docker.service.d/workspace.conf"), "utf8"),
      /RequiresMountsFor=/
    );
    config["max-concurrent-downloads"] = 2;
    await writeFile(configPath, JSON.stringify(config));
    const rerun = run();
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), config);
    const calls = await readFile(env.DOCKER_TEST_LOG, "utf8");
    assert.doesNotMatch(calls, /restart/);
    config["data-root"] = "/existing/operator-data";
    await writeFile(configPath, JSON.stringify(config));
    const rejected = run();
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /existing Docker configuration differs/);
    assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), config);
    assert.equal(await readFile(env.DOCKER_TEST_LOG, "utf8"), calls);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
