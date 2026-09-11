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

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const bundle = join(repoRoot, "scripts/symphony/runtime-bundle");
const workflowPath = join(bundle, "workflow/WORKFLOW.md");
const configStep = join(
  repoRoot,
  "scripts/symphony/host/install.d/80-config.sh"
);

test("host renderer selects source, staged release, then explicit override without root fallback", async () => {
  const root = await mkdtemp(join(tmpdir(), "symphony-workflow-source-"));
  const source = await readFile(workflowPath, "utf8");
  const staged = join(root, "current/workflow/WORKFLOW.md");
  const override = join(root, "operator workflow.md");
  const env = {
    ...process.env,
    SYMPHONY_LIB_SOURCED: "",
    SYMPHONY_BOOTSTRAP_STATE_DIR: join(root, "state"),
    SYMPHONY_CONFIG_DIR: join(root, "config"),
    SYMPHONY_RUNTIME_BUNDLE_SOURCE_DIR: bundle,
    SYMPHONY_RUNTIME_BUNDLE_CURRENT_LINK: join(root, "current"),
    SYMPHONY_WORKER_SLOTS: "7",
    SYMPHONY_WORKFLOW_SOURCE: "",
  };
  const render = (workflowSource = "") =>
    spawnSync(
      "bash",
      ["-c", 'source "$1"; render_workflow_config', "render", configStep],
      {
        encoding: "utf8",
        env: { ...env, SYMPHONY_WORKFLOW_SOURCE: workflowSource },
      }
    );
  const rendered = () => readFile(join(root, "config/WORKFLOW.md"), "utf8");
  try {
    await mkdir(env.SYMPHONY_BOOTSTRAP_STATE_DIR);
    await mkdir(env.SYMPHONY_CONFIG_DIR);
    const fallback = render();
    assert.equal(fallback.status, 0, fallback.stderr);
    const defaultWorkflow = await rendered();
    assert.match(defaultWorkflow, /^---\ntracker:/);
    assert.match(defaultWorkflow, /max_concurrent_agents: 7\n/);
    assert.match(
      defaultWorkflow,
      /codex-with-runtime-bundle\.sh --enable apps/
    );
    assert.match(defaultWorkflow, /installed `symphony-repository` skill/);
    assert.match(defaultWorkflow, /model="gpt-6-astra"/);

    await mkdir(dirname(staged), { recursive: true });
    await writeFile(staged, `${source}\nStaged release marker.\n`);
    const stagedResult = render();
    assert.equal(stagedResult.status, 0, stagedResult.stderr);
    assert.match(await rendered(), /Staged release marker/);

    await writeFile(override, `${source}\nOperator override marker.\n`);
    const overridden = render(override);
    assert.equal(overridden.status, 0, overridden.stderr);
    assert.match(await rendered(), /Operator override marker/);
    assert.doesNotMatch(await rendered(), /Staged release marker/);

    const missing = render(join(root, "removed-root/WORKFLOW.md"));
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /workflow source is missing/);
    assert.match(await rendered(), /Operator override marker/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("documented local command passes the nested workflow or an operator override to the runtime", async () => {
  const guide = await readFile(
    join(repoRoot, "docs/engineering/symphony/tooling-setup.md"),
    "utf8"
  );
  const command = guide.match(
    /<!-- local-workflow-invocation -->\s*```sh\n([\s\S]*?)```/
  )?.[1];
  assert.ok(command, "local invocation must remain documented and executable");
  const root = await mkdtemp(join(tmpdir(), "symphony-local-workflow-"));
  const runtime = join(root, "stub runtime");
  const override = join(root, "operator workflow.md");
  try {
    await writeFile(
      runtime,
      `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
const source = fs.readFileSync(args.at(-1), "utf8");
process.stdout.write(JSON.stringify({args, source, toolingRoot: process.env.SYMPHONY_TOOLING_ROOT}));
`
    );
    await chmod(runtime, 0o755);
    await writeFile(override, "---\noperator: true\n---\nLocal override.\n");
    for (const workflow of ["", override]) {
      const result = spawnSync("bash", ["-c", command], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          SYMPHONY_RUNTIME_BIN: runtime,
          SYMPHONY_TOOLING_ROOT: "",
          SYMPHONY_WORKFLOW_SOURCE: workflow,
        },
      });
      assert.equal(result.status, 0, result.stderr);
      const loaded = JSON.parse(result.stdout);
      assert.deepEqual(loaded.args, [
        "--i-understand-that-this-will-be-running-without-the-usual-guardrails",
        workflow || workflowPath,
      ]);
      assert.equal(loaded.toolingRoot, repoRoot);
      assert.match(
        loaded.source,
        workflow ? /Local override/ : /installed `symphony-repository` skill/
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
