import yaml from "js-yaml";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  copyFileSync,
  cpSync,
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
    attempt: randomUUID(),
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
    if (!["redis-stack", "resp-proxy"].includes(name)) {
      const data = service.volumes.find((mount) => mount.target === "/data");
      assert.ok(
        data,
        `${name} must override the older image's anonymous volume`
      );
      assert.equal(data.type, "bind");
      assert.ok(data.source.startsWith(source + "/dockers/"));
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
    () =>
      render(source, { lock: inputs, anchor: "abc123", attempt: randomUUID() }),
    /Compose source drift/
  );
});

test("partial startup, health failure and cancellation retain original failure and remove only owned IDs", async (t) => {
  for (const failure of ["up", "check", "cancel"])
    await t.test(failure, async (t) => {
      const { workspace, source } = fixture(t);
      const output = resolve(workspace, "output");
      mkdirSync(output);
      cpSync(source, resolve(output, "source"), { recursive: true });
      const project = identity("100-88", "test", failure);
      const lockFile = resolve(output, "environment-lock.json");
      writeFileSync(lockFile, JSON.stringify(inputs));
      const composeFile = resolve(output, "compose.json");
      writeFileSync(composeFile, "{}");
      const state = {
        project,
        attempt: randomUUID(),
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
      const owned = new Set(state.anchor ? [state.anchor] : []);
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
              {
                Config: {
                  Labels: {
                    "drc.owner": project,
                    "drc.attempt": state.attempt,
                  },
                  User: `${state.uid}:${state.gid}`,
                },
                HostConfig: {},
                Mounts: [],
              },
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
      if (failure === "check")
        assert.match(recorded.failure.message, /Incomplete topology/);
      if (failure === "up") assert.match(recorded.failure.message, /exited 23/);
      if (failure === "cancel")
        assert.equal(recorded.failure.message, "Operation cancelled");
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
  const attempt = randomUUID();
  const ids = ["a".repeat(64), "b".repeat(64)];
  const remaining = new Set(ids);
  writeFileSync(
    resolve(output, "state.json"),
    JSON.stringify({ project, attempt, output, resourceIds: ids, commands: [] })
  );
  const removed = [];
  const execute = async (_program, args) => {
    if (args[0] === "ps") return { code: 0, stdout: [...remaining].join("\n") };
    if (args[0] === "inspect")
      return {
        code: 0,
        stdout: JSON.stringify([
          {
            Config: {
              Labels: { "drc.owner": project, "drc.attempt": attempt },
            },
          },
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

function preparedOutput(workspace, source, name) {
  const output = resolve(workspace, name);
  mkdirSync(output);
  cpSync(source, resolve(output, "source"), { recursive: true });
  const lock = resolve(output, "environment-lock.json");
  writeFileSync(lock, JSON.stringify(inputs));
  writeFileSync(resolve(output, "compose.json"), "{}");
  const state = {
    project: identity("100-88", "test", "startup-collision"),
    attempt: randomUUID(),
    output,
    prepared: true,
    uid: process.getuid(),
    gid: process.getgid(),
    selected: selections("8.8.0", "3.10", "plain"),
    resourceIds: [],
    commands: [],
    lockHash: sha256(readFileSync(lock)),
    composeHash: sha256("{}"),
  };
  writeFileSync(resolve(output, "state.json"), JSON.stringify(state));
  return {
    workspace,
    source,
    output,
    lock,
    issue: "100-88",
    run: "test",
    cell: "startup-collision",
  };
}

function dockerFixture() {
  const containers = new Map();
  const calls = [];
  let sequence = 0;
  const add = (name, labels) => {
    const id = (++sequence).toString(16).padStart(64, "0");
    containers.set(id, {
      Name: name,
      Config: { Labels: labels },
      data: "retained",
    });
    return id;
  };
  const execute = async (_program, args) => {
    calls.push(args);
    if (args[0] === "create") {
      const name = args[args.indexOf("--name") + 1];
      if ([...containers.values()].some((item) => item.Name === name))
        return { code: 1, stdout: "", stderr: "container name conflict" };
      const labels = Object.fromEntries(
        args.flatMap((arg, i) =>
          arg === "--label" ? [args[i + 1].split("=")] : []
        )
      );
      return { code: 0, stdout: add(name, labels) };
    }
    if (args[0] === "inspect")
      return {
        code: containers.has(args[1]) ? 0 : 1,
        stdout: JSON.stringify([containers.get(args[1])]),
      };
    if (args[0] === "ps") {
      const filters = args
        .filter((arg) => arg.startsWith("label="))
        .map((arg) => arg.slice(6).split("="));
      return {
        code: 0,
        stdout: [...containers]
          .filter(([, item]) =>
            filters.every(([key, value]) => item.Config.Labels[key] === value)
          )
          .map(([id]) => id)
          .join("\n"),
      };
    }
    if (args.includes("up")) {
      const topology = readJson(args[args.indexOf("--file") + 1]);
      for (const [name, service] of Object.entries(topology.services))
        add(`${topology.name}-${name}`, {
          ...service.labels,
          "com.docker.compose.project": topology.name,
        });
    }
    if (args.includes("down")) {
      const project = args[args.indexOf("--project-name") + 1];
      for (const [id, item] of containers)
        if (item.Config.Labels["com.docker.compose.project"] === project)
          containers.delete(id);
    }
    if (args[0] === "rm") containers.delete(args.at(-1));
    return { code: 0, stdout: "" };
  };
  return { containers, calls, add, execute };
}

test("duplicate prepared outputs cannot clean another attempt after a startup conflict or stale down", async (t) => {
  const { workspace, source } = fixture(t);
  const first = preparedOutput(workspace, source, "first");
  const second = preparedOutput(workspace, source, "second");
  const docker = dockerFixture();
  await lifecycle("up", first, docker.execute);
  const original = structuredClone(docker.containers);
  await assert.rejects(
    lifecycle("up", second, docker.execute),
    /create exited 1/
  );
  assert.equal(
    readJson(resolve(second.output, "state.json")).cleanup,
    undefined
  );
  await lifecycle("down", second, docker.execute);
  assert.deepEqual(docker.containers, original);
  assert.ok(!docker.calls.some((args) => args.includes("down")));
  await lifecycle("down", first, docker.execute);
  assert.equal(docker.containers.size, 0);
  await lifecycle("up", second, docker.execute);
  const replacement = structuredClone(docker.containers);
  await lifecycle("down", first, docker.execute);
  assert.deepEqual(docker.containers, replacement);
  await lifecycle("down", second, docker.execute);
  assert.equal(docker.containers.size, 0);
});

test("cleanup refuses project-wide down when a foreign attempt shares its Compose label", async (t) => {
  const { workspace, source } = fixture(t);
  const options = preparedOutput(workspace, source, "foreign-project-member");
  const docker = dockerFixture();
  await lifecycle("up", options, docker.execute);
  const state = readJson(resolve(options.output, "state.json"));
  const foreign = docker.add("foreign", {
    "drc.owner": state.project,
    "drc.attempt": randomUUID(),
    "com.docker.compose.project": state.project,
  });
  await lifecycle("down", options, docker.execute);
  assert.deepEqual([...docker.containers.keys()], [foreign]);
  assert.ok(!docker.calls.some((args) => args.includes("down")));
});

test("cancellation immediately after anchor creation retains its ID and cleans it", async (t) => {
  const { workspace, source } = fixture(t);
  const options = preparedOutput(workspace, source, "cancel-create");
  const docker = dockerFixture();
  let canceled = false;
  await assert.rejects(
    lifecycle(
      "up",
      { ...options, cancelled: () => canceled },
      async (program, args) => {
        const result = await docker.execute(program, args);
        if (args[0] === "create") canceled = true;
        return result;
      }
    ),
    /Operation cancelled/
  );
  const state = readJson(resolve(options.output, "state.json"));
  assert.ok(state.anchor);
  assert.equal(state.cleanup.exit, 0);
  assert.equal(docker.containers.size, 0);
});
