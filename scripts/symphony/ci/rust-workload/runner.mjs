import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { arch, hostname } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const SOURCE = "99528c2e4da241ec2c9961d0a155357611f16a76";
export const BASE =
  "rust@sha256:7fa728f3678acf5980d5db70960cf8491aff9411976789086676bdf0c19db39e";
const here = dirname(fileURLToPath(import.meta.url));
const hour = 60 * 60 * 1000;
const sha = (data) => createHash("sha256").update(data).digest("hex");
const hash = (path) => sha(readFileSync(path));
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const git = (source, ...args) =>
  execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim();
function save(path, value) {
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2) + "\n");
  renameSync(`${path}.tmp`, path);
}

export const commands = [
  ["build", ["cargo", "build", "--release", "--locked"]],
  ...[3, 4, 5, 6].flatMap((n) => [
    [
      `test-${n}`,
      [
        "cargo",
        "test",
        "--release",
        "--locked",
        "--features",
        `ncolors_${n}`,
        "--verbose",
      ],
    ],
    [
      `doc-${n}`,
      [
        "cargo",
        "test",
        "--release",
        "--locked",
        "--doc",
        "--features",
        `ncolors_${n}`,
        "--verbose",
      ],
    ],
  ]),
  [
    "clippy",
    ["cargo", "clippy", "--locked", "--all-targets", "--", "-D", "warnings"],
  ],
  [
    "clippy-5",
    [
      "cargo",
      "clippy",
      "--locked",
      "--all-targets",
      "--features",
      "ncolors_5",
      "--",
      "-D",
      "warnings",
    ],
  ],
  ["fmt", ["cargo", "fmt", "--all", "--", "--check"]],
];

// Retain output even for spawn errors, timeout and cancellation. No shell/tee pipeline.
export async function processLog(argv, log, { signal, timeout = hour } = {}) {
  const started = new Date().toISOString();
  const fd = openSync(log, "wx");
  const stderrLog = `${log}.stderr`;
  const errFd = openSync(stderrLog, "wx");
  let timedOut = false;
  let canceled = Boolean(signal?.aborted);
  let timer, killer;
  let rawExit = null,
    rawSignal = null,
    error;
  try {
    if (!canceled) {
      await new Promise((done) => {
        const child = spawn(argv[0], argv.slice(1), {
          stdio: ["ignore", fd, errFd],
          detached: true,
        });
        const kill = () => {
          if (!child.pid) return;
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            /* already exited */
          }
          killer ??= setTimeout(() => {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch {
              /* already exited */
            }
          }, 1000);
        };
        const abort = () => {
          canceled = true;
          kill();
        };
        signal?.addEventListener("abort", abort, { once: true });
        timer = setTimeout(() => {
          timedOut = true;
          kill();
        }, timeout);
        child.on("error", (err) => {
          error = err.message;
        });
        child.on("close", (code, sig) => {
          rawExit = code;
          rawSignal = sig;
          signal?.removeEventListener("abort", abort);
          done();
        });
        if (signal?.aborted) abort();
      });
    }
  } finally {
    clearTimeout(timer);
    clearTimeout(killer);
    closeSync(fd);
    closeSync(errFd);
  }
  return {
    argv,
    started,
    ended: new Date().toISOString(),
    log,
    logSha256: hash(log),
    stderrLog,
    stderrSha256: hash(stderrLog),
    rawExit,
    rawSignal,
    exit: canceled ? 130 : timedOut ? 124 : error ? 127 : rawExit ?? 1,
    timedOut,
    canceled,
    error,
  };
}

export function testCounts(output) {
  return [
    ...output.matchAll(
      /test result: (?:ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out/g
    ),
  ].map((m) =>
    Object.fromEntries(
      ["passed", "failed", "ignored", "measured", "filtered"].map((key, i) => [
        key,
        Number(m[i + 1]),
      ])
    )
  );
}

export async function executeWorkload(
  step,
  signal,
  checkpoint = () => {
    /* optional observer */
  }
) {
  const results = [];
  for (const [id, argv] of commands) {
    if (signal?.aborted) break;
    results.push(await step(id, argv));
    checkpoint(results);
  }
  const missing = commands
    .map(([id]) => id)
    .filter((id) => !results.some((r) => r.id === id));
  return {
    results,
    expected: commands.map(([id]) => id),
    executed: results.map((r) => r.id),
    missing,
    exit: signal?.aborted
      ? 130
      : results.find((r) => r.exit !== 0)?.exit || (missing.length ? 1 : 0),
  };
}

export function containerArgs(o, image, argv, offline) {
  const feature = argv.find((arg) => /^ncolors_[3-6]$/.test(arg)) || "default";
  return [
    "docker",
    "create",
    "--name",
    o.name,
    "--label",
    `drc.owner=${o.name}`,
    "--platform",
    "linux/amd64",
    "--user",
    `${process.getuid()}:${process.getgid()}`,
    "--cpus",
    o.cpus,
    "--memory",
    o.memory,
    "--memory-swap",
    o.memory,
    "--pids-limit",
    o.pids,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,exec,nosuid,nodev,size=128m",
    "--network",
    offline ? "none" : "bridge",
    "--mount",
    `type=bind,src=${o.state},dst=/work`,
    "--workdir",
    "/work/source",
    ...[
      "HOME=/work/home",
      "CARGO_HOME=/work/cargo",
      `CARGO_TARGET_DIR=/work/target/${feature}`,
      "RUSTUP_TOOLCHAIN=1.90.0",
      "CARGO_TERM_COLOR=never",
      "RUST_BACKTRACE=1",
      ...(offline ? ["CARGO_NET_OFFLINE=true"] : []),
    ].flatMap((env) => ["--env", env]),
    image,
    ...argv,
  ];
}

export async function containerStep(
  o,
  image,
  id,
  argv,
  offline,
  signal,
  run = processLog
) {
  const call = (suffix, args, options) =>
    run(args, join(o.output, `${id}.${suffix}.log`), options);
  const cidFile = join(o.output, `${id}.cid`);
  const createArgs = containerArgs(o, image, argv, offline);
  createArgs.splice(2, 0, "--cidfile", cidFile);
  const created = await call("create", createArgs, { signal, timeout: 60000 });
  const result = { id, argv, created, exit: created.exit };
  // --cidfile survives interruption between container creation and CLI return.
  // A failed name collision must never authorize removal of an existing container.
  if (!existsSync(cidFile)) {
    result.exit ||= 1;
    save(join(o.output, `${id}.json`), result);
    return result;
  }
  const cid = readFileSync(cidFile, "utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(cid))
    throw new Error(`Invalid created container ID; inspect ${created.log}`);
  save(join(o.output, "active-container.json"), { id: cid, name: o.name });
  try {
    if (!created.exit) {
      result.execution = await call(
        "output",
        ["docker", "start", "--attach", cid],
        { signal }
      );
      result.exit = result.execution.exit;
      result.counts = testCounts(readFileSync(result.execution.log, "utf8"));
    }
  } finally {
    result.inspect = await call("inspect", ["docker", "inspect", cid], {
      timeout: 60000,
    });
    if (!result.inspect.exit) {
      try {
        result.state = json(result.inspect.log)[0].State;
      } catch (error) {
        result.inspectError = error.message;
      }
    }
    result.cleanup = await call("cleanup", ["docker", "rm", "--force", cid], {
      timeout: 60000,
    });
    result.readback = await call(
      "readback",
      ["docker", "ps", "--all", "--quiet", "--filter", `id=${cid}`],
      { timeout: 60000 }
    );
    result.remaining = readFileSync(result.readback.log, "utf8").trim();
    result.exit ||=
      (result.state?.OOMKilled ? 137 : result.state?.ExitCode) ||
      result.inspect.exit ||
      result.cleanup.exit ||
      result.readback.exit ||
      (result.remaining || result.inspectError || result.state?.Running
        ? 1
        : 0);
    save(join(o.output, `${id}.json`), result);
  }
  return result;
}

function within(workspace, path) {
  const rel = relative(workspace, path);
  if (!rel || rel === ".." || rel.startsWith("../") || isAbsolute(rel))
    throw new Error(`Path must be beneath workspace: ${path}`);
  return path;
}

function options(args) {
  const keys = [
    "workspace",
    "source",
    "output",
    "lock",
    "bundle",
    "issue",
    "run",
    "cpus",
    "memory",
    "pids",
    "provenance",
  ];
  const { values } = parseArgs({
    args,
    options: Object.fromEntries(keys.map((key) => [key, { type: "string" }])),
  });
  for (const key of keys.filter(
    (key) => !["bundle", "provenance"].includes(key)
  )) {
    if (!values[key]) throw new Error(`Missing --${key}`);
  }
  if (
    !/^\d+-\d+$/.test(values.issue) ||
    !/^[a-z0-9][a-z0-9-]{0,35}$/.test(values.run)
  )
    throw new Error("Invalid issue/run identity");
  if (
    !/^\d+(\.\d+)?$/.test(values.cpus) ||
    Number(values.cpus) <= 0 ||
    !/^[1-9]\d*[mg]$/.test(values.memory) ||
    !/^[1-9]\d*$/.test(values.pids)
  )
    throw new Error("Explicit positive CPU/memory/PID limits required");
  const o = {
    ...values,
    workspace: realpathSync(values.workspace),
    name: `drc-${values.issue}-${values.run}-rust`,
  };
  for (const key of ["source", "bundle", "provenance"]) {
    if (o[key]) o[key] = within(o.workspace, realpathSync(o[key]));
  }
  for (const key of ["output", "lock"]) {
    o[key] = within(o.workspace, resolve(o[key]));
    const parent = realpathSync(dirname(o[key]));
    if (parent !== o.workspace) within(o.workspace, parent);
    if (existsSync(o[key]) && realpathSync(o[key]) !== o[key])
      throw new Error(`Symlink ${key} forbidden`);
  }
  if (o.output.includes(",")) throw new Error("Comma in Docker mount path");
  if (
    git(o.source, "rev-parse", "HEAD") !== SOURCE ||
    git(o.source, "status", "--porcelain")
  )
    throw new Error("Require clean pinned upstream checkout");
  o.state = join(o.output, "workspace");
  mkdirSync(o.output); // Exclusive attempt; never overwrite prior evidence.
  for (const directory of ["source", "cargo", "target", "home"])
    mkdirSync(join(o.state, directory), { recursive: true });
  execFileSync("git", [
    "-C",
    o.source,
    "archive",
    "--format=tar",
    `--output=${o.output}/source.tar`,
    SOURCE,
  ]);
  execFileSync("tar", [
    "-xf",
    join(o.output, "source.tar"),
    "-C",
    join(o.state, "source"),
  ]);
  return o;
}

export async function main(mode, args) {
  if (!["prepare", "run"].includes(mode))
    throw new Error(
      "Use prepare or run; see rust-ci-workload.md for required arguments"
    );
  const o = options(args);
  const control = new AbortController();
  const abort = () => control.abort();
  process.on("SIGINT", abort);
  process.on("SIGTERM", abort);
  const index = {
    issue: o.issue,
    run: o.run,
    cell: "rust",
    mode,
    started: new Date().toISOString(),
    target: {
      repository: "jeremycarroll/venn-search-rs",
      sha: SOURCE,
      workflowSha: SOURCE,
      workflowHash: hash(join(o.state, "source/.github/workflows/ci.yml")),
      sourceArchiveHash: hash(join(o.output, "source.tar")),
      patch: "Cargo.lock only",
    },
    adapter: {
      baseSha: git(here, "rev-parse", "HEAD"),
      trackedPatchHash: sha(git(here, "diff", "HEAD")),
      runnerHash: hash(fileURLToPath(import.meta.url)),
      dockerfileHash: hash(join(here, "Dockerfile")),
    },
    worker: {
      hostname: hostname(),
      uid: process.getuid(),
      gid: process.getgid(),
      architecture: arch(),
    },
    provenance: o.provenance
      ? json(o.provenance)
      : {
          limitation:
            "Development run; installed bootstrap/runtime/bundle/workflow refs unverified. DEPLOY owns readback.",
        },
    base: BASE,
    limits: {
      cpus: o.cpus,
      memory: o.memory,
      pids: o.pids,
      commandTimeoutMs: hour,
    },
    paths: o,
    steps: [],
    workload: {
      expected: commands.map(([id]) => id),
      executed: [],
      missing: commands.map(([id]) => id),
      results: [],
    },
    exit: 1,
    result: "unrun",
    nextOwner: "Jeremy Carroll; DEPLOY/V1/V2 after acceptance",
  };
  const checkpoint = () => save(join(o.output, "index.json"), index);
  const host = async (id, argv, timeout = hour) => {
    const r = await processLog(argv, join(o.output, `${id}.log`), {
      signal: control.signal,
      timeout,
    });
    index.steps.push({ id, ...r });
    checkpoint();
    if (r.exit) throw new Error(`${id} exited ${r.exit}`);
    return r;
  };
  const step = async (image, id, argv, offline = false) => {
    const r = await containerStep(o, image, id, argv, offline, control.signal);
    index.steps.push(r);
    checkpoint();
    return r;
  };
  try {
    copyFileSync(fileURLToPath(import.meta.url), join(o.output, "runner.mjs"));
    copyFileSync(join(here, "Dockerfile"), join(o.output, "Dockerfile"));
    checkpoint();
    await host("docker-version", ["docker", "version"], 60000);
    const compose = await processLog(
      ["docker", "compose", "version"],
      join(o.output, "compose-version.log"),
      { timeout: 60000 }
    );
    index.compose = compose; // Compose is evidence only; the Rust runner does not use it.
    if (mode === "prepare") {
      await host("image-build", [
        "docker",
        "build",
        "--platform",
        "linux/amd64",
        "--label",
        `drc.owner=${o.name}`,
        "--iidfile",
        join(o.output, "image.id"),
        here,
      ]);
      index.image = readFileSync(join(o.output, "image.id"), "utf8").trim();
    } else {
      if (!o.bundle) throw new Error("run requires --bundle from prepare");
      const bundle = json(join(o.bundle, "bundle.json"));
      if (
        Object.keys(bundle.files).sort().join() !==
        ["Cargo.lock", "cargo.tar.gz", "image.tar.gz"].join()
      )
        throw new Error("Incomplete replay bundle manifest");
      for (const [file, digest] of Object.entries(bundle.files)) {
        if (
          !["image.tar.gz", "cargo.tar.gz", "Cargo.lock"].includes(file) ||
          hash(join(o.bundle, file)) !== digest
        )
          throw new Error(`Bundle hash mismatch: ${file}`);
      }
      if (
        bundle.source !== SOURCE ||
        bundle.base !== BASE ||
        hash(o.lock) !== bundle.files["Cargo.lock"]
      )
        throw new Error("Replay pin/lock mismatch");
      index.image = bundle.image;
      await host("image-load", [
        "docker",
        "load",
        "--input",
        join(o.bundle, "image.tar.gz"),
      ]);
      await host("cache-restore", [
        "tar",
        "-xzf",
        join(o.bundle, "cargo.tar.gz"),
        "-C",
        join(o.state, "cargo"),
      ]);
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(index.image))
      throw new Error("Immutable image ID required");
    await host(
      "image-inspect",
      ["docker", "image", "inspect", index.image],
      60000
    );
    for (const [id, argv] of [
      ["rustc-version", ["rustc", "--version"]],
      ["cargo-version", ["cargo", "--version"]],
      ["clippy-version", ["cargo", "clippy", "--version"]],
      ["fmt-version", ["cargo", "fmt", "--version"]],
      ["components", ["rustup", "component", "list", "--installed"]],
    ]) {
      if ((await step(index.image, id, argv, mode === "run")).exit)
        throw new Error(`${id} failed under worker UID`);
    }
    const sourceLock = join(o.state, "source/Cargo.lock");
    if (existsSync(o.lock)) copyFileSync(o.lock, sourceLock);
    else {
      if (mode !== "prepare") throw new Error("Replay requires retained lock");
      if (
        (
          await step(index.image, "generate-lock", [
            "cargo",
            "generate-lockfile",
          ])
        ).exit
      )
        throw new Error("Lock generation failed");
      copyFileSync(sourceLock, o.lock, 1);
    }
    copyFileSync(sourceLock, join(o.output, "Cargo.lock"));
    index.lockHash = hash(sourceLock);
    if (mode === "prepare") {
      if (
        (
          await step(index.image, "fetch-locked", [
            "cargo",
            "fetch",
            "--locked",
          ])
        ).exit
      )
        throw new Error("Dependency fetch failed");
      await host("cache-save", [
        "tar",
        "-czf",
        join(o.output, "cargo.tar.gz"),
        "-C",
        join(o.state, "cargo"),
        ".",
      ]);
      await host("image-save", [
        "docker",
        "save",
        "--output",
        join(o.output, "image.tar"),
        index.image,
      ]);
      await host("image-compress", ["gzip", join(o.output, "image.tar")]);
      save(join(o.output, "bundle.json"), {
        source: SOURCE,
        base: BASE,
        image: index.image,
        files: Object.fromEntries(
          ["image.tar.gz", "cargo.tar.gz", "Cargo.lock"].map((file) => [
            file,
            hash(join(o.output, file)),
          ])
        ),
      });
      index.exit = 0;
    } else {
      index.workload = await executeWorkload(
        (id, argv) => step(index.image, id, argv, true),
        control.signal,
        (results) => {
          index.workload = {
            results,
            expected: commands.map(([id]) => id),
            executed: results.map((r) => r.id),
            missing: commands
              .map(([id]) => id)
              .filter((id) => !results.some((r) => r.id === id)),
            result: "in-progress",
          };
          checkpoint();
        }
      );
      index.exit = index.workload.exit;
    }
    if (hash(sourceLock) !== index.lockHash)
      throw new Error("Workload modified retained lock");
    index.result = index.exit ? "fail" : "pass";
  } catch (error) {
    index.error = error.message;
    index.exit = control.signal.aborted ? 130 : 1;
    index.result = "fail";
  } finally {
    index.ended = new Date().toISOString();
    checkpoint();
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
  }
  console.info(`${mode}: ${index.result}; evidence: ${o.output}/index.json`);
  return index.exit;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv[2], process.argv.slice(3))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
