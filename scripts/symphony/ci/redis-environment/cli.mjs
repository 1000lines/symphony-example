#!/usr/bin/env node
import yaml from "js-yaml";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { arch, hostname } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
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
} from "./topology.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const json = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");

export async function lifecycle(operation, options, execute) {
  const project = identity(options.issue, options.run, options.cell);
  const workspace = realpathSync(options.workspace);
  const owner = statSync(workspace);
  assert.equal(owner.uid, process.getuid(), "Run as the workspace owner");
  assert.equal(owner.gid, process.getgid(), "Run with the workspace group");
  const output = within(workspace, options.output);
  const source = within(
    workspace,
    operation === "down"
      ? resolve(options.source)
      : realpathSync(options.source)
  );
  mkdirSync(output, { recursive: true });
  assert.equal(realpathSync(output), output, "Symlinked output is forbidden");
  const stateFile = resolve(output, "state.json");
  const composeFile = resolve(output, "compose.json");
  let state = existsSync(stateFile)
    ? readJson(stateFile)
    : {
        project,
        output,
        uid: process.getuid(),
        gid: process.getgid(),
        resourceIds: [],
        commands: [],
      };
  assert.equal(state.project, project, "Output belongs to another identity");
  assert.equal(
    state.output,
    output,
    "Output was relocated while resources may exist"
  );
  const save = () => json(stateFile, state);
  let cleaning = operation === "down";
  let cleanupOnFailure = false;
  const command = async (program, args, check = true, timeout = 180000) => {
    if (!cleaning) assert.ok(!options.cancelled?.(), "Operation cancelled");
    const index = state.commands.length;
    const record = {
      program,
      args,
      started: new Date().toISOString(),
      log: `command-${index}.log`,
    };
    state.commands.push(record);
    save();
    const result = await execute(program, args, {
      output,
      log: record.log,
      timeout,
    });
    Object.assign(record, {
      exit: result.code,
      signal: result.signal || null,
      timedOut: result.timedOut || false,
      ended: new Date().toISOString(),
    });
    save();
    if (!cleaning) assert.ok(!options.cancelled?.(), "Operation cancelled");
    if (check && result.code !== 0)
      throw new Error(
        `${program} ${args[0]} exited ${result.code}; see ${record.log}`
      );
    return result;
  };
  const docker = (args, check = true, timeout) =>
    command("docker", args, check, timeout);
  const compose = (args, check = true) =>
    command(
      options.compose || "docker",
      [
        ...(options.compose ? [] : ["compose"]),
        "--project-name",
        project,
        "--file",
        composeFile,
        "--profile",
        "*",
        ...args,
      ],
      check
    );
  const inspect = async (id) => {
    const result = await docker(["inspect", id], false);
    return result.code === 0 ? JSON.parse(result.stdout)[0] : null;
  };
  const ownedIds = async () => {
    const result = await docker([
      "ps",
      "-aq",
      "--no-trunc",
      "--filter",
      `label=drc.owner=${project}`,
    ]);
    return result.stdout.trim().split(/\s+/).filter(Boolean);
  };
  const remove = async (id) => {
    const resource = await inspect(id);
    if (!resource) return 0;
    assert.equal(
      resource.Config.Labels?.["drc.owner"],
      project,
      "Refusing unrelated resource removal"
    );
    return (await docker(["rm", "-f", "-v", id], false)).code;
  };
  const down = async () => {
    cleaning = true;
    state.cleanup = { started: new Date().toISOString(), exit: 0 };
    save();
    state.resourceIds = [
      ...new Set([...state.resourceIds, ...(await ownedIds())]),
    ];
    save();
    for (const id of state.resourceIds) {
      const item = await inspect(id);
      if (item) {
        assert.equal(item.Config.Labels?.["drc.owner"], project);
        await docker(["logs", id], false);
      }
    }
    if (
      existsSync(composeFile) &&
      sha256(readFileSync(composeFile)) === state.composeHash
    )
      state.cleanup.composeExit = (
        await compose(["down", "--volumes", "--remove-orphans"], false)
      ).code;
    else {
      state.cleanup.composeExit = null;
      state.cleanup.composeSkipped =
        "Missing or changed rendered Compose; using recorded IDs";
    }
    for (const id of state.resourceIds) {
      const exit = await remove(id);
      state.cleanup.exit ||= exit;
    }
    state.cleanup.remaining = await ownedIds();
    const networks = await docker([
      "network",
      "ls",
      "-q",
      "--filter",
      `label=com.docker.compose.project=${project}`,
    ]);
    const volumes = await docker([
      "volume",
      "ls",
      "-q",
      "--filter",
      `label=com.docker.compose.project=${project}`,
    ]);
    state.cleanup.networks = networks.stdout.trim();
    state.cleanup.volumes = volumes.stdout.trim();
    state.cleanup.exit ||=
      state.cleanup.remaining.length ||
      state.cleanup.networks ||
      state.cleanup.volumes
        ? 1
        : 0;
    state.cleanup.ended = new Date().toISOString();
    save();
    return state.cleanup.exit;
  };
  const container = async (
    image,
    args,
    network,
    name = `${project}-runner`
  ) => {
    const created = await docker([
      "create",
      "--name",
      name,
      "--label",
      `drc.owner=${project}`,
      "--user",
      `${state.uid}:${state.gid}`,
      "--cpus",
      "2",
      "--memory",
      "2g",
      "--pids-limit",
      "256",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--network",
      network,
      "--mount",
      `type=bind,source=${output},target=/work`,
      "--workdir",
      "/work/source",
      "--env",
      "HOME=/work/home",
      "--env",
      "PIP_CONFIG_FILE=/dev/null",
      "--env",
      "PIP_DISABLE_PIP_VERSION_CHECK=1",
      "--entrypoint",
      args[0],
      image,
      ...args.slice(1),
    ]);
    const id = created.stdout.trim();
    assert.match(id, /^[a-f0-9]{64}$/);
    state.resourceIds.push(id);
    save();
    await docker(["start", "--attach", id], false, 3600000);
    const result = await inspect(id);
    assert.ok(result && !result.State.Running, "Container did not finish");
    state.lastContainer = {
      id,
      exit: result.State.ExitCode,
      oom: result.State.OOMKilled,
    };
    save();
    assert.equal(await remove(id), 0, "Runner cleanup failed");
    assert.equal(result.State.ExitCode, 0, `Container failed: ${id}`);
  };

  try {
    if (operation === "down") return await down();
    const lock = validateLock(readJson(options.lock));
    if (operation === "prepare") {
      assert.ok(
        !state.prepared && !state.anchor,
        "Use a fresh output for each attempt"
      );
      assert.deepEqual(
        await ownedIds(),
        [],
        "Clean recorded orphan resources before reusing an identity"
      );
      if (options.compose)
        assert.equal(
          sha256(readFileSync(options.compose)),
          inputs.compose.sha256,
          "Compose checksum mismatch"
        );
      const version = await command(options.compose || "docker", [
        ...(options.compose ? [] : ["compose"]),
        "version",
        "--short",
      ]);
      assert.equal(
        version.stdout.trim(),
        inputs.compose.version,
        "Compose version mismatch"
      );
      for (const [path, hash] of Object.entries(inputs.sources))
        assert.equal(
          sha256(readFileSync(resolve(source, path))),
          hash,
          `Source drift: ${path}`
        );
      const head = await command("git", ["-C", source, "rev-parse", "HEAD"]);
      assert.equal(head.stdout.trim(), inputs.source);
      const dirty = await command("git", [
        "-C",
        source,
        "status",
        "--porcelain",
        "--untracked-files=no",
      ]);
      assert.equal(dirty.stdout.trim(), "", "Source has tracked changes");
      const selected = selections(
        options.redis,
        options.python,
        options.parser
      );
      for (const tag of new Set(Object.values(selected))) {
        await docker(
          ["pull", "--platform", inputs.platform, lock.images[tag].ref],
          true,
          600000
        );
        const inspected = await docker([
          "image",
          "inspect",
          lock.images[tag].ref,
        ]);
        const image = JSON.parse(inspected.stdout)[0];
        assert.equal(image.Architecture, "amd64");
        assert.deepEqual(
          Object.keys(image.Config.Volumes || {}),
          inputs.images[tag].dataVolume ? ["/data"] : [],
          `Unexpected image volumes: ${tag}`
        );
        if (lock.images[tag].id)
          assert.equal(lock.images[tag].id, image.Id, "Image ID drift");
        lock.images[tag].id = image.Id;
      }
      mkdirSync(resolve(output, "source"));
      await command("git", [
        "-C",
        source,
        "archive",
        "--format=tar",
        "--output",
        resolve(output, "source.tar"),
        inputs.source,
      ]);
      await command("tar", [
        "-xf",
        resolve(output, "source.tar"),
        "-C",
        resolve(output, "source"),
      ]);
      const config = sentinelConfig(source);
      writeFileSync(resolve(output, "source/dockers/sentinel.conf"), config);
      state.provenance = {
        target: inputs.source,
        platform: inputs.platform,
        worker: hostname(),
        architecture: arch(),
        sourceArchiveHash: sha256(readFileSync(resolve(output, "source.tar"))),
        sentinelHash: sha256(config),
        adapterHashes: Object.fromEntries(
          [
            "cli.mjs",
            "topology.mjs",
            "prepare-python.py",
            "check.py",
            "inputs.json",
          ].map((file) => [
            file,
            sha256(readFileSync(resolve(directory, file))),
          ])
        ),
      };
      await docker(["version"]);
      for (const service of services)
        if (service !== "resp-proxy")
          mkdirSync(
            resolve(
              output,
              "source/dockers",
              service === "redis" ? "standalone" : service,
              "data"
            ),
            { recursive: true }
          );
      for (const file of ["prepare-python.py", "check.py"])
        copyFileSync(resolve(directory, file), resolve(output, file));
      mkdirSync(resolve(output, "home"), { recursive: true });
      if (lock.artifacts) {
        const base = dirname(realpathSync(options.lock));
        for (const [file, hash] of Object.entries(lock.artifacts)) {
          const from = within(base, resolve(base, file));
          assert.equal(
            sha256(readFileSync(from)),
            hash,
            `Replay artifact drift: ${file}`
          );
          const target = within(output, resolve(output, file));
          mkdirSync(dirname(target), { recursive: true });
          copyFileSync(from, target);
        }
      }
      state.selected = selected;
      state.images = Object.fromEntries(
        Object.entries(selected).map(([role, tag]) => [
          role,
          lock.images[tag].id,
        ])
      );
      state.selection = {
        redis: options.redis,
        python: options.python,
        parser: options.parser,
      };
      if (lock.selection) {
        for (const axis of ["python", "parser"])
          assert.equal(
            state.selection[axis],
            lock.selection[axis],
            "Replay interpreter/parser changed"
          );
      }
      cleanupOnFailure = true;
      await container(
        lock.images[selected.interpreter].id,
        ["python", "/work/prepare-python.py", options.parser],
        lock.artifacts ? "none" : "bridge"
      );
      lock.selection = state.selection;
      lock.python = readJson(resolve(output, "python.json"));
      lock.artifacts = {};
      for (const file of [
        "constraints.txt",
        "requirements.lock",
        "wheels.json",
        ...Object.keys(readJson(resolve(output, "wheels.json"))).map(
          (name) => `wheels/${name}`
        ),
      ])
        lock.artifacts[file] = sha256(readFileSync(resolve(output, file)));
      json(resolve(output, "environment-lock.json"), lock);
      state.lockHash = sha256(
        readFileSync(resolve(output, "environment-lock.json"))
      );
      state.prepared = true;
      state.runner = {
        image: lock.images[selected.interpreter].id,
        mount: `${output}:/work`,
        workingDirectory: "/work/source",
        environment: {
          HOME: "/work/home",
          PATH: "/work/venv/bin:/usr/local/bin:/usr/bin:/bin",
          COVERAGE_CORE: "sysmon",
          PIP_CONFIG_FILE: "/dev/null",
          PIP_DISABLE_PIP_VERSION_CHECK: "1",
          PIP_NO_INDEX: "1",
          PIP_FIND_LINKS: "/work/wheels",
          PIP_CONSTRAINT: "/work/constraints.txt",
          PIP_BUILD_CONSTRAINT: "/work/constraints.txt",
        },
      };
      json(
        composeFile,
        render(resolve(output, "source"), {
          lock,
          selected,
          anchor: `${project}-anchor`,
          project,
          uid: state.uid,
          gid: state.gid,
        })
      );
      state.composeHash = sha256(readFileSync(composeFile));
      writeFileSync(
        resolve(output, "compose.yaml"),
        yaml.dump(readJson(composeFile))
      );
      await command(
        "diff",
        [
          "-u",
          resolve(source, "docker-compose.yml"),
          resolve(output, "compose.yaml"),
        ],
        false
      );
      await command(
        "diff",
        [
          "-u",
          resolve(source, "dockers/sentinel.conf"),
          resolve(output, "source/dockers/sentinel.conf"),
        ],
        false
      );
      save();
      await compose(["config", "--format", "json"]);
    } else {
      assert.ok(state.prepared, "prepare must pass before startup");
      assert.equal(
        sha256(readFileSync(options.lock)),
        state.lockHash,
        "Wrong immutable lock"
      );
      assert.equal(
        sha256(readFileSync(composeFile)),
        state.composeHash,
        "Rendered Compose drift"
      );
      if (operation === "up") {
        assert.ok(
          !state.anchor,
          "Use a fresh identity/output for the next startup"
        );
        cleanupOnFailure = true;
        const result = await docker([
          "create",
          "--name",
          `${project}-anchor`,
          "--label",
          `drc.owner=${project}`,
          "--user",
          `${state.uid}:${state.gid}`,
          "--cpus",
          "0.1",
          "--memory",
          "32m",
          "--pids-limit",
          "16",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          "--entrypoint",
          "sleep",
          lock.images[state.selected.interpreter].id,
          "infinity",
        ]);
        state.anchor = result.stdout.trim();
        assert.match(state.anchor, /^[a-f0-9]{64}$/);
        state.resourceIds.push(state.anchor);
        save();
        await docker(["start", state.anchor]);
        json(
          composeFile,
          render(resolve(output, "source"), {
            lock,
            selected: state.selected,
            anchor: state.anchor,
            project,
            uid: state.uid,
            gid: state.gid,
          })
        );
        state.composeHash = sha256(readFileSync(composeFile));
        save();
        await compose([
          "up",
          "-d",
          "--wait",
          "--wait-timeout",
          "120",
          "--pull",
          "never",
        ]);
        state.resourceIds = [
          ...new Set([...state.resourceIds, ...(await ownedIds())]),
        ];
        save();
      } else if (operation === "check") {
        assert.ok(state.anchor, "No recorded namespace anchor");
        cleanupOnFailure = true;
        const resources = await ownedIds();
        const found = [];
        for (const id of resources) {
          const item = await inspect(id);
          assert.equal(item.Config.User, `${state.uid}:${state.gid}`);
          assert.ok(
            !item.HostConfig.Privileged &&
              !Object.keys(item.HostConfig.PortBindings || {}).length,
            "Unsafe container"
          );
          for (const mount of item.Mounts) within(output, mount.Source);
          const service = item.Config.Labels?.["com.docker.compose.service"];
          if (service) {
            found.push(service);
            const role =
              service === "redis-stack"
                ? "stack"
                : service === "resp-proxy"
                ? "proxy"
                : "redis";
            assert.equal(
              item.Image,
              lock.images[state.selected[role]].id,
              `${service} image changed`
            );
            assert.equal(
              item.HostConfig.NetworkMode,
              `container:${state.anchor}`
            );
            assert.equal(item.State.Running, true, `${service} is not running`);
          }
        }
        assert.deepEqual(
          found.sort(),
          [...services].sort(),
          "Incomplete topology"
        );
        await container(
          lock.images[state.selected.interpreter].id,
          ["/work/venv/bin/python", "/work/check.py"],
          `container:${state.anchor}`
        );
        state.checked = new Date().toISOString();
        save();
      } else throw new Error("Expected prepare, up, check or down");
    }
    return 0;
  } catch (error) {
    state.failure = {
      operation,
      message: error.message,
      time: new Date().toISOString(),
    };
    save();
    if (!cleaning && cleanupOnFailure) {
      try {
        await down();
      } catch (cleanupError) {
        state.cleanupError = cleanupError.message;
        save();
      }
    }
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let interrupted = false;
  let child;
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      interrupted = true;
      // docker start --attach can absorb SIGTERM; cleanup owns container shutdown.
      child?.kill("SIGKILL");
    });
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: Object.fromEntries(
        [
          "source",
          "lock",
          "issue",
          "run",
          "cell",
          "output",
          "workspace",
          "compose",
          "redis",
          "python",
          "parser",
        ].map((key) => [key, { type: "string" }])
      ),
    });
    for (const key of [
      "source",
      "lock",
      "issue",
      "run",
      "cell",
      "output",
      "workspace",
    ])
      assert.ok(values[key], `Missing --${key}`);
    const execute = (program, args, { output, log, timeout }) =>
      new Promise((done) => {
        let stdout = "";
        let combined = "";
        child = spawn(program, args, {
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            COMPOSE_ENV_FILES: "",
            COMPOSE_DISABLE_ENV_FILE: "true",
          },
        });
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
          combined += chunk;
          writeFileSync(resolve(output, log), combined);
        });
        child.stderr.on("data", (chunk) => {
          combined += chunk;
          writeFileSync(resolve(output, log), combined);
        });
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child?.kill("SIGKILL");
        }, timeout);
        child.on("error", (error) => {
          combined += error.message;
        });
        child.on("close", (code, signal) => {
          clearTimeout(timer);
          writeFileSync(resolve(output, log), combined);
          done({ code: code ?? 1, stdout, signal, timedOut });
        });
      });
    process.exitCode = await lifecycle(
      positionals[0],
      { ...values, cancelled: () => interrupted },
      execute
    );
    if (interrupted) process.exitCode = 130;
  } catch (error) {
    console.error(error.message);
    process.exitCode = interrupted ? 130 : 1;
  }
}
