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

const filesDir = dirname(fileURLToPath(import.meta.url));
const userDataScript = join(filesDir, "user-data.sh");

const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

const runBash = (command, env = {}) =>
  spawnSync("bash", ["-c", `source "${userDataScript}"; ${command}`], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

const writeExecutable = async (path, contents) => {
  await writeFile(path, contents);
  await chmod(path, 0o755);
};

test("resolves a desired GitHub ref to an immutable SHA", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-user-data-ref-"));
  const binDir = join(root, "bin");
  const curlLog = join(root, "curl.log");
  const sha = "0123456789abcdef0123456789abcdef01234567";

  try {
    await mkdir(binDir);
    await writeExecutable(
      join(binDir, "curl"),
      `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >"${curlLog}"\nprintf '{"sha":"${sha}"}\\n'\n`
    );

    const result = runBash(
      `resolve_github_ref example-org/example-repo 'feature/test' token-value`,
      { PATH: `${binDir}:${process.env.PATH}` }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), sha);
    assert.match(await readFile(curlLog, "utf8"), /commits\/feature%2Ftest/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a ref that does not resolve to a 40-hex SHA", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-user-data-badref-"));
  const binDir = join(root, "bin");

  try {
    await mkdir(binDir);
    await writeExecutable(
      join(binDir, "curl"),
      `#!/usr/bin/env bash\nprintf '{"sha":"not-a-sha"}\\n'\n`
    );

    const result = runBash(
      `resolve_github_ref example-org/example-repo main token-value`,
      { PATH: `${binDir}:${process.env.PATH}` }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /resolved to invalid SHA/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("base tool install does not request the conflicting curl package", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-user-data-deps-"));
  const binDir = join(root, "bin");
  const dnfLog = join(root, "dnf.log");

  try {
    await mkdir(binDir);
    await writeExecutable(
      join(binDir, "dnf"),
      `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >"${dnfLog}"\n`
    );

    const result = runBash(`install_base_tools`, {
      PATH: `${binDir}:/usr/bin:/bin`,
    });

    assert.equal(result.status, 0, result.stderr);
    const dnfArgs = await readFile(dnfLog, "utf8");
    assert.match(dnfArgs, /awscli/);
    assert.match(dnfArgs, /jq/);
    assert.doesNotMatch(dnfArgs, /(^| )curl( |$)/m);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("retries stage-2 bootstrap and succeeds after a transient failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-user-data-retry-"));
  const bootstrapRoot = join(root, "bootstrap");
  const attemptFile = join(root, "attempts");
  const envLog = join(root, "env.log");
  const sha = "89abcdef0123456789abcdef0123456789abcdef";

  try {
    await mkdir(bootstrapRoot);
    await writeExecutable(
      join(bootstrapRoot, "bootstrap.sh"),
      `#!/usr/bin/env bash
attempt=0
if [[ -f "$ATTEMPT_FILE" ]]; then
  attempt="$(cat "$ATTEMPT_FILE")"
fi
attempt=$((attempt + 1))
printf '%s\\n' "$attempt" >"$ATTEMPT_FILE"
printf '%s|%s|%s|%s\\n' "$SYMPHONY_AWS_REGION" "$SYMPHONY_BOOTSTRAP_REF" "$SYMPHONY_BOOTSTRAP_SHA" "$SYMPHONY_RUNTIME_REF" >>"$ENV_LOG"
if [[ "$attempt" -eq 1 ]]; then
  exit 42
fi
exit 0
`
    );

    const result = runBash(
      [
        `bootstrap_dir=${shellQuote(bootstrapRoot)}`,
        "bootstrap_retry_backoff_seconds=0",
        `run_bootstrap_with_retries ${[
          "us-west-2",
          "main",
          sha,
          "runtime-main",
          "token-value",
        ]
          .map(shellQuote)
          .join(" ")}`,
      ].join("; "),
      { ATTEMPT_FILE: attemptFile, ENV_LOG: envLog }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal((await readFile(attemptFile, "utf8")).trim(), "2");
    assert.deepEqual((await readFile(envLog, "utf8")).trim().split("\n"), [
      `us-west-2|main|${sha}|runtime-main`,
      `us-west-2|main|${sha}|runtime-main`,
    ]);
    assert.match(
      result.stdout,
      /root bootstrap attempt 1\/3 failed with exit status 42/
    );
    assert.match(result.stdout, /sleeping 0s before retrying root bootstrap/);
    assert.match(result.stdout, /root bootstrap attempt 2\/3 completed/);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /token-value/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("preserves the final non-zero bootstrap exit after retries are exhausted", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-user-data-retry-fail-"));
  const bootstrapRoot = join(root, "bootstrap");
  const attemptFile = join(root, "attempts");
  const envLog = join(root, "env.log");
  const sha = "fedcba9876543210fedcba9876543210fedcba98";

  try {
    await mkdir(bootstrapRoot);
    await writeExecutable(
      join(bootstrapRoot, "bootstrap.sh"),
      `#!/usr/bin/env bash
attempt=0
if [[ -f "$ATTEMPT_FILE" ]]; then
  attempt="$(cat "$ATTEMPT_FILE")"
fi
attempt=$((attempt + 1))
printf '%s\\n' "$attempt" >"$ATTEMPT_FILE"
printf '%s|%s|%s|%s\\n' "$SYMPHONY_AWS_REGION" "$SYMPHONY_BOOTSTRAP_REF" "$SYMPHONY_BOOTSTRAP_SHA" "$SYMPHONY_RUNTIME_REF" >>"$ENV_LOG"
exit 37
`
    );

    const result = runBash(
      [
        `bootstrap_dir=${shellQuote(bootstrapRoot)}`,
        "bootstrap_retry_backoff_seconds=0",
        `run_bootstrap_with_retries ${[
          "us-west-2",
          "main",
          sha,
          "runtime-main",
          "token-value",
        ]
          .map(shellQuote)
          .join(" ")}`,
      ].join("; "),
      { ATTEMPT_FILE: attemptFile, ENV_LOG: envLog }
    );

    assert.equal(result.status, 37);
    assert.equal((await readFile(attemptFile, "utf8")).trim(), "3");
    assert.deepEqual((await readFile(envLog, "utf8")).trim().split("\n"), [
      `us-west-2|main|${sha}|runtime-main`,
      `us-west-2|main|${sha}|runtime-main`,
      `us-west-2|main|${sha}|runtime-main`,
    ]);
    assert.match(
      result.stdout,
      /root bootstrap attempt 3\/3 failed with exit status 37/
    );
    assert.match(
      result.stdout,
      /root bootstrap exhausted 3 attempts; preserving exit status 37/
    );
    assert.equal(
      [...result.stdout.matchAll(/sleeping 0s before retrying root bootstrap/g)]
        .length,
      2
    );
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /token-value/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
