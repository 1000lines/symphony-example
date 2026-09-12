import yaml from "js-yaml";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

export const inputs = JSON.parse(
  readFileSync(new URL("inputs.json", import.meta.url))
);
export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
export const services = [
  "redis",
  "replica",
  "cluster",
  "cluster2",
  "sentinel",
  "redis-stack",
  "redis-proxied",
  "resp-proxy",
];

export function identity(issue, run, cell) {
  for (const value of [issue, run, cell])
    assert.match(value, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const name = `drc-${issue}-${run}-${cell}`;
  assert.ok(name.length <= 100, "Resource identity too long");
  return name;
}

export function within(root, path) {
  const tail = relative(resolve(root), resolve(path));
  assert.ok(
    tail && tail !== ".." && !tail.startsWith("../") && !tail.startsWith("/"),
    "Path must be inside the issue workspace"
  );
  return resolve(path);
}

export function validateLock(lock) {
  for (const key of ["schema", "source", "platform", "compose", "sources"])
    assert.deepEqual(lock[key], inputs[key], `Changed input: ${key}`);
  assert.deepEqual(
    Object.keys(lock.images).sort(),
    Object.keys(inputs.images).sort()
  );
  for (const [tag, image] of Object.entries(inputs.images)) {
    assert.equal(lock.images[tag].ref, image.ref, `Unapproved image: ${tag}`);
    if (lock.images[tag].id)
      assert.match(lock.images[tag].id, /^sha256:[a-f0-9]{64}$/);
  }
  return lock;
}

export function selections(redis, python, parser) {
  const stack =
    { "7.4.9": "rs-7.4.0-v8", "7.2.14": "rs-7.2.0-v20" }[redis] || redis;
  const interpreter = python.startsWith("pypy-")
    ? `library/pypy:${python.slice(5)}-bookworm`
    : `library/python:${python}-bookworm`;
  const selected = {
    redis: `redislabs/client-libs-test:${redis}`,
    stack: `redislabs/client-libs-test:${stack}`,
    proxy: "redislabs/client-resp-proxy:latest",
    interpreter,
  };
  for (const tag of Object.values(selected))
    assert.ok(inputs.images[tag], `Unsupported axis: ${tag}`);
  assert.ok(
    ["plain", "hiredis-old", "hiredis-new"].includes(parser),
    "Unsupported parser"
  );
  if (parser !== "plain")
    assert.ok(["3.10", "3.14"].includes(python), "Unplanned hiredis axis");
  return selected;
}

export function render(source, { lock, selected, anchor, project, uid, gid }) {
  validateLock(lock);
  assert.match(anchor, /^[a-z0-9-]+$/);
  const original = readFileSync(resolve(source, "docker-compose.yml"), "utf8");
  assert.equal(
    sha256(original),
    inputs.sources["docker-compose.yml"],
    "Compose source drift"
  );
  // Expand only the pinned defaults; never interpolate the worker environment.
  const expanded = original.replace(/\$\{[A-Z_]+:-(.*?)\}/g, "$1");
  assert.ok(!expanded.includes("${"), "Unexpected Compose interpolation");
  const compose = yaml.load(expanded);
  assert.deepEqual(Object.keys(compose.services).sort(), [...services].sort());
  delete compose.networks;
  for (const key of Object.keys(compose))
    if (key.startsWith("x-")) delete compose[key];
  compose.name = project;
  for (const [name, service] of Object.entries(compose.services)) {
    delete service.container_name;
    delete service.ports;
    delete service.networks;
    service.network_mode = `container:${anchor}`;
    const role =
      name === "redis-stack"
        ? "stack"
        : name === "resp-proxy"
        ? "proxy"
        : "redis";
    const image = lock.images[selected[role]];
    service.image = image.id || image.ref;
    service.user = `${uid}:${gid}`;
    service.labels = { "drc.owner": project };
    service.cpus = name.startsWith("cluster") ? 1 : 0.5;
    service.mem_limit = name.startsWith("cluster") ? "768m" : "256m";
    service.pids_limit = 256;
    service.security_opt = ["no-new-privileges:true"];
    service.cap_drop = ["ALL"];
    service.environment = Array.isArray(service.environment)
      ? Object.fromEntries(
          service.environment.map((entry) => {
            const index = entry.indexOf("=");
            return [entry.slice(0, index), entry.slice(index + 1)];
          })
        )
      : service.environment || {};
    for (const key of Object.keys(service.environment))
      service.environment[key] = String(service.environment[key]);
    if (name === "replica")
      service.command = service.command.replace(
        "--replicaof redis 6379",
        "--replicaof 127.0.0.1 6379"
      );
    if (name === "resp-proxy") service.environment.TARGET_HOST = "127.0.0.1";
    if (name === "redis-stack") service.environment.PORT = "6479";
    service.volumes = (service.volumes || []).map((volume) => {
      const [path, target] = volume.split(":");
      assert.ok(path.startsWith("./dockers/"), "Unexpected upstream mount");
      return {
        type: "bind",
        source: within(source, resolve(source, path)),
        target,
      };
    });
    if (name === "redis-proxied")
      service.volumes.push({
        type: "bind",
        source: resolve(source, "dockers/redis-proxied"),
        target: "/redis/work",
      });
    if (inputs.images[selected[role]].dataVolume)
      service.volumes.push({
        type: "bind",
        source: resolve(
          source,
          "dockers",
          name === "redis" ? "standalone" : name,
          "data"
        ),
        target: "/data",
      });
  }
  return compose;
}

export function sentinelConfig(source) {
  const original = readFileSync(
    resolve(source, "dockers/sentinel.conf"),
    "utf8"
  );
  assert.equal(
    sha256(original),
    inputs.sources["dockers/sentinel.conf"],
    "Sentinel source drift"
  );
  return original.replace(
    "sentinel monitor redis-py-test redis 6379 2",
    "sentinel monitor redis-py-test 127.0.0.1 6379 2"
  );
}
