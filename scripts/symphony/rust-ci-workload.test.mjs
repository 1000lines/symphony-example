import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  commands,
  containerArgs,
  containerStep,
  executeWorkload,
  processLog,
  testCounts,
} from "./ci/rust-workload/runner.mjs";

test("the twelve commands preserve the pinned workflow's complete selections", () => {
  assert.equal(commands.length, 12);
  assert.deepEqual(commands[0][1], ["cargo", "build", "--release", "--locked"]);
  for (const n of [3, 4, 5, 6]) {
    assert.deepEqual(commands.find(([id]) => id === `test-${n}`)[1], [
      "cargo",
      "test",
      "--release",
      "--locked",
      "--features",
      `ncolors_${n}`,
      "--verbose",
    ]);
    assert.deepEqual(commands.find(([id]) => id === `doc-${n}`)[1], [
      "cargo",
      "test",
      "--release",
      "--locked",
      "--doc",
      "--features",
      `ncolors_${n}`,
      "--verbose",
    ]);
  }
  assert.deepEqual(
    commands.slice(-3).map(([, argv]) => argv),
    [
      ["cargo", "clippy", "--locked", "--all-targets", "--", "-D", "warnings"],
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
      ["cargo", "fmt", "--all", "--", "--check"],
    ]
  );
});

test("each failure is retained even when all following commands pass", async () => {
  for (const [failure] of commands) {
    const result = await executeWorkload(async (id) => ({
      id,
      exit: id === failure ? 42 : 0,
    }));
    assert.equal(result.exit, 42);
    assert.equal(result.executed.length, 12);
    assert.deepEqual(result.missing, []);
  }
});

test("cancellation inventories all commands that never started", async () => {
  const controller = new AbortController();
  const result = await executeWorkload(async (id) => {
    controller.abort();
    return { id, exit: 130 };
  }, controller.signal);
  assert.equal(result.exit, 130);
  assert.equal(result.executed.length, 1);
  assert.equal(result.missing.length, 11);
});

test("real process output and exits survive failure, timeout, cancel and spawn error", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "rust-workload-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const run = (id, code, opts) =>
    processLog(
      [process.execPath, "-e", code],
      join(directory, `${id}.log`),
      opts
    );
  const failed = await run(
    "failed",
    "console.log('before'); console.error('error'); process.exit(23)"
  );
  assert.equal(failed.exit, 23);
  assert.match(readFileSync(failed.log, "utf8"), /before/);
  assert.match(readFileSync(failed.stderrLog, "utf8"), /error/);
  const timeout = await run(
    "timeout",
    "console.log('started'); setInterval(() => {}, 10)",
    { timeout: 3000 }
  );
  assert.equal(timeout.exit, 124);
  assert.equal(timeout.timedOut, true);
  assert.match(readFileSync(timeout.log, "utf8"), /started/);
  const controller = new AbortController();
  const pending = run(
    "cancel",
    "console.log('started'); setInterval(() => {}, 10)",
    { signal: controller.signal }
  );
  setTimeout(() => controller.abort(), 3000);
  const canceled = await pending;
  assert.equal(canceled.exit, 130);
  assert.equal(canceled.canceled, true);
  assert.match(readFileSync(canceled.log, "utf8"), /started/);
  const missing = await processLog(
    [join(directory, "missing")],
    join(directory, "missing.log")
  );
  assert.equal(missing.exit, 127);
  assert.match(missing.error, /ENOENT/);
  await assert.rejects(() => run("failed", "process.exit(0)"), /EEXIST/);
});

test("replay has one workspace mount, bounded worker identity and offline caches", () => {
  const args = containerArgs(
    {
      name: "drc-100-89-test-rust",
      state: "/issue/run/workspace",
      cpus: "2",
      memory: "4g",
      pids: "256",
    },
    "sha256:abc",
    commands[1][1],
    true
  );
  const option = (key) => args[args.indexOf(key) + 1];
  assert.equal(args.filter((arg) => arg === "--mount").length, 1);
  assert.equal(
    option("--mount"),
    "type=bind,src=/issue/run/workspace,dst=/work"
  );
  assert.equal(option("--user"), `${process.getuid()}:${process.getgid()}`);
  assert.equal(option("--network"), "none");
  assert.equal(option("--cpus"), "2");
  assert.equal(option("--memory"), "4g");
  assert.equal(option("--memory-swap"), "4g");
  assert.equal(option("--pids-limit"), "256");
  assert.equal(option("--tmpfs"), "/tmp:rw,exec,nosuid,nodev,size=128m");
  assert(args.includes("CARGO_HOME=/work/cargo"));
  assert(args.includes("CARGO_TARGET_DIR=/work/target/ncolors_3"));
  assert(args.includes("RUSTUP_TOOLCHAIN=1.90.0"));
  assert(args.includes("CARGO_NET_OFFLINE=true"));
  assert(!args.some((arg) => /RUSTUP_HOME|docker.sock|TOKEN|SECRET/.test(arg)));
});

test("zero doc tests and ignored tests are observations, not invented coverage", () => {
  assert.deepEqual(
    testCounts(
      "test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out"
    ),
    [{ passed: 0, failed: 0, ignored: 0, measured: 0, filtered: 0 }]
  );
  assert.deepEqual(testCounts("compilation failed"), []);
  assert.equal(
    testCounts(
      "test result: FAILED. 7 passed; 1 failed; 2 ignored; 0 measured; 3 filtered out"
    )[0].ignored,
    2
  );
});

test("container cleanup preserves original failure on timeout, OOM, partial create and cleanup error", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "rust-cleanup-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const scenario of [
    "timeout",
    "oom",
    "partial",
    "collision",
    "inspect",
    "cleanup",
  ]) {
    const calls = [];
    const cid = "a".repeat(64);
    const fakeDocker = async (argv, log) => {
      calls.push(argv);
      let exit = 0,
        output = "";
      if (argv[1] === "create") {
        if (scenario !== "collision")
          writeFileSync(argv[argv.indexOf("--cidfile") + 1], cid);
        if (["partial", "collision"].includes(scenario)) exit = 125;
      } else if (argv[1] === "start") {
        exit = scenario === "timeout" ? 124 : 0;
      } else if (argv[1] === "inspect") {
        output =
          scenario === "inspect"
            ? "invalid"
            : JSON.stringify([
                { State: { ExitCode: 0, OOMKilled: scenario === "oom" } },
              ]);
      } else if (argv[1] === "rm" && scenario === "cleanup") exit = 1;
      writeFileSync(log, output);
      return { exit, log };
    };
    const result = await containerStep(
      {
        output: directory,
        state: directory,
        name: "drc-100-89-fixture-rust",
        cpus: "1",
        memory: "1g",
        pids: "64",
      },
      "sha256:abc",
      scenario,
      ["cargo", "test"],
      true,
      undefined,
      fakeDocker
    );
    const expected = {
      timeout: 124,
      oom: 137,
      partial: 125,
      collision: 125,
      inspect: 1,
      cleanup: 1,
    };
    assert.equal(result.exit, expected[scenario]);
    if (scenario === "collision")
      assert(!calls.some((argv) => argv[1] === "rm"));
    else {
      assert.deepEqual(
        calls.find((argv) => argv[1] === "rm"),
        ["docker", "rm", "--force", cid]
      );
      assert(calls.some((argv) => argv[1] === "ps"));
    }
  }
});
