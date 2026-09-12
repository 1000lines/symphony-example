import yaml from "js-yaml";
import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { lifecycle } from "./ci/redis-environment/cli.mjs";
import {
  identity,
  inputs,
  readJson,
  render,
  selections,
  sentinelConfig,
  services,
  sha256,
  validateLock,
  within,
} from "./ci/redis-environment/topology.mjs";

function fixture(t) {
  const workspace = mkdtempSync(resolve(tmpdir(), "redis-environment-"));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const source = resolve(workspace, "source");
  mkdirSync(resolve(source, "dockers"), { recursive: true });
  copyFileSync(
    new URL("ci/redis-environment/upstream-compose.yml", import.meta.url),
    resolve(source, "docker-compose.yml")
  );
  copyFileSync(
    new URL("ci/redis-environment/upstream-sentinel.conf", import.meta.url),
    resolve(source, "dockers/sentinel.conf")
  );
  return { workspace, source };
}

test("complete pinned topology retains every profile, healthcheck, TLS setting and mount", (t) => {
  const { source } = fixture(t);
  const original = yaml.load(
    readFileSync(resolve(source, "docker-compose.yml"), "utf8")
  );
  const selected = selections("7.4.9", "3.10", "plain");
  const result = render(source, {
    lock: inputs,
    selected,
    anchor: "abc123",
    project: "drc-100-88-test-cell",
    uid: 993,
    gid: 993,
  });
  assert.deepEqual(Object.keys(result.services).sort(), [...services].sort());
  for (const [name, service] of Object.entries(result.services)) {
    assert.deepEqual(service.profiles, original.services[name].profiles);
    assert.deepEqual(service.healthcheck, original.services[name].healthcheck);
    assert.deepEqual(service.depends_on, original.services[name].depends_on);
    assert.equal(service.network_mode, "container:abc123");
    assert.equal(service.user, "993:993");
    assert.ok(service.cpus && service.mem_limit && service.pids_limit);
    assert.ok(
      !service.ports &&
        !service.networks &&
        !service.container_name &&
        !service.extra_hosts
    );
    assert.ok(!JSON.stringify(service).includes("${"));
    for (const mount of service.volumes) {
      within(source, mount.source);
      assert.ok(!/socket|\.sock|credential/.test(mount.target));
    }
    for (const setting of Array.isArray(original.services[name].environment)
      ? original.services[name].environment
      : []) {
      const [key, value] = setting.split("=");
      if (key.startsWith("TLS_")) assert.equal(service.environment[key], value);
    }
  }
  assert.equal(result.services["redis-stack"].environment.PORT, "6479");
  assert.equal(
    result.services["resp-proxy"].environment.TARGET_HOST,
    "127.0.0.1"
  );
  assert.match(
    result.services.replica.command,
    /--replicaof 127\.0\.0\.1 6379/
  );
  assert.match(
    sentinelConfig(source),
    /monitor redis-py-test 127\.0\.0\.1 6379 2/
  );
  assert.equal(
    result.services["redis-stack"].image,
    inputs.images["redislabs/client-libs-test:rs-7.4.0-v8"].ref
  );
});

test("rejects changed source, floating images, missing inventory, unknown axes and path escapes", (t) => {
  const { source } = fixture(t);
  assert.equal(Object.keys(inputs.images).length, 18);
  for (const mutate of [
    (lock) => {
      lock.source = "main";
    },
    (lock) => {
      delete lock.images["library/python:3.14-bookworm"];
    },
    (lock) => {
      lock.images["library/python:3.10-bookworm"].ref = "python:latest";
    },
  ]) {
    const lock = structuredClone(inputs);
    mutate(lock);
    assert.throws(() => validateLock(lock));
  }
  assert.throws(() => selections("8.6.1", "3.10", "plain"));
  assert.throws(() => selections("8.8.0", "3.14", "skip-old-hiredis"));
  assert.throws(() => identity("100-88", "../shared", "cell"));
  assert.throws(() => within(source, resolve(source, "../outside")));
  writeFileSync(resolve(source, "docker-compose.yml"), "services: {}\n");
  assert.throws(
    () => render(source, { lock: inputs, anchor: "abc123" }),
    /Compose source drift/
  );
});

test("partial startup, health failure and cancellation retain original failure and remove only owned IDs", async (t) => {
  for (const failure of ["up", "check", "cancel"])
    await t.test(failure, async (t) => {
      const { workspace, source } = fixture(t);
      const output = resolve(workspace, "output");
      mkdirSync(output);
      const project = identity("100-88", "test", failure);
      const lockFile = resolve(output, "environment-lock.json");
      writeFileSync(lockFile, JSON.stringify(inputs));
      const composeFile = resolve(output, "compose.json");
      writeFileSync(composeFile, "{}");
      const state = {
        project,
        output,
        prepared: true,
        uid: 993,
        gid: 993,
        selected: selections("8.8.0", "3.10", "plain"),
        resourceIds: [],
        commands: [],
        lockHash: sha256(readFileSync(lockFile)),
        composeHash: sha256(readFileSync(composeFile)),
      };
      if (failure === "check") state.anchor = "a".repeat(64);
      writeFileSync(resolve(output, "state.json"), JSON.stringify(state));
      const owned = new Set();
      const unrelated = "c".repeat(64);
      let canceled = false;
      let logs = 0;
      const execute = async (program, args) => {
        if (args[0] === "create") {
          owned.add("a".repeat(64));
          return { code: 0, stdout: "a".repeat(64) };
        }
        if (args[0] === "ps") return { code: 0, stdout: [...owned].join("\n") };
        if (args[0] === "inspect")
          return {
            code: owned.has(args[1]) ? 0 : 1,
            stdout: JSON.stringify([
              { Config: { Labels: { "drc.owner": project } } },
            ]),
          };
        if (args[0] === "logs") logs++;
        if (args[0] === "rm") {
          assert.notEqual(args.at(-1), unrelated);
          assert.ok(logs > 0);
          owned.delete(args.at(-1));
        }
        if (args.includes("up")) {
          owned.add("b".repeat(64));
          canceled = failure === "cancel";
          return { code: 23, stdout: "failed startup" };
        }
        return { code: 0, stdout: "" };
      };
      await assert.rejects(
        lifecycle(
          failure === "check" ? "check" : "up",
          {
            source,
            workspace,
            output,
            issue: "100-88",
            run: "test",
            cell: failure,
            lock: lockFile,
            cancelled: () => canceled,
          },
          execute
        )
      );
      const recorded = readJson(resolve(output, "state.json"));
      assert.ok(recorded.failure.message);
      assert.equal(recorded.cleanup.exit, 0);
      assert.deepEqual(recorded.cleanup.remaining, []);
      assert.equal(owned.size, 0);
    });
});

test("cleanup continues after one removal fails and reports remaining resources", async (t) => {
  const { workspace, source } = fixture(t);
  const output = resolve(workspace, "output");
  mkdirSync(output);
  const project = identity("100-88", "test", "cleanup");
  const ids = ["a".repeat(64), "b".repeat(64)];
  const remaining = new Set(ids);
  writeFileSync(
    resolve(output, "state.json"),
    JSON.stringify({ project, output, resourceIds: ids, commands: [] })
  );
  const removed = [];
  const execute = async (_program, args) => {
    if (args[0] === "ps") return { code: 0, stdout: [...remaining].join("\n") };
    if (args[0] === "inspect")
      return {
        code: 0,
        stdout: JSON.stringify([
          { Config: { Labels: { "drc.owner": project } } },
        ]),
      };
    if (args[0] === "rm") {
      const id = args.at(-1);
      removed.push(id);
      if (id === ids[0]) return { code: 7, stdout: "" };
      remaining.delete(id);
    }
    return { code: 0, stdout: "" };
  };
  assert.equal(
    await lifecycle(
      "down",
      {
        workspace,
        source,
        output,
        issue: "100-88",
        run: "test",
        cell: "cleanup",
      },
      execute
    ),
    7
  );
  assert.deepEqual(removed, ids);
  assert.deepEqual(readJson(resolve(output, "state.json")).cleanup.remaining, [
    ids[0],
  ]);
});

test("a colliding identity fails preparation without deleting the existing environment", async (t) => {
  const { workspace, source } = fixture(t);
  const output = resolve(workspace, "collision");
  const lock = resolve(workspace, "inputs.json");
  writeFileSync(lock, JSON.stringify(inputs));
  const calls = [];
  const execute = async (_program, args) => {
    calls.push(args);
    assert.equal(args[0], "ps", "Preflight must not mutate existing resources");
    return { code: 0, stdout: "a".repeat(64) };
  };
  await assert.rejects(
    lifecycle(
      "prepare",
      {
        workspace,
        source,
        output,
        lock,
        issue: "100-88",
        run: "test",
        cell: "collision",
      },
      execute
    ),
    /orphan resources/
  );
  assert.equal(calls.length, 1);
  assert.equal(readJson(resolve(output, "state.json")).cleanup, undefined);
});
