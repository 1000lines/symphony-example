import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runtimeBundleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(dirname(runtimeBundleDir)));
const codexAgentsPath = join(runtimeBundleDir, "codex", "AGENTS.md");
const workflowPath = join(runtimeBundleDir, "workflow", "WORKFLOW.md");
const codexHeading = "## Codex Workpad";
const symphonyHeading = "## Symphony Workpad";
const hostedCodexCommandPattern =
  /codex --enable apps --config shell_environment_policy\.inherit=all --config 'model="gpt-6-astra"' --config model_reasoning_effort=xhigh app-server/;

const commonAbsentSkillNames = [
  "symphony-finalize-project",
  "symphony-google-docs",
  "symphony-linear-api",
  "symphony-proof-of-work",
];

const requiredContractPhrases = [
  "after fetching the Linear issue,\nstate, and comments but before planning, prerequisite checks, repository work,\nblocker handling, or state classification",
  "Find the active comment whose first non-blank line is exactly\n   `## Codex Workpad`",
  "immediately create a minimal `## Codex Workpad` comment",
  "Persist that comment ID for the turn and write all plans, progress,\n   failures, questions, and handoffs only to that pinned ID",
  "Never select or update `## Symphony Workpad`",
  "fail closed. Do not fall\n   back to the Symphony workpad, similarly named headings, or another arbitrary\n   comment",
];

const firstNonBlankLine = (body) =>
  body.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";

const hasExactCodexHeading = (comment) =>
  firstNonBlankLine(comment.body) === codexHeading;

const pathExists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

const cloneComments = (comments) =>
  comments.map((comment) => ({
    ...comment,
  }));

const bootstrapCodexWorkpad = (
  comments,
  { createFails = false, updateFails = false } = {}
) => {
  const mutableComments = cloneComments(comments);
  const events = ["fetch-issue-state-comments"];
  let pinnedComment = mutableComments.find(hasExactCodexHeading);

  if (pinnedComment) {
    events.push(`reuse:${pinnedComment.id}`);
  } else {
    events.push("create-codex-workpad");
    if (createFails) {
      events.push("fail-closed:create");
      return {
        comments: mutableComments,
        error: "create failed",
        events,
        pinnedCommentId: null,
      };
    }
    pinnedComment = {
      body: `${codexHeading}\n\nInitialized before hosted task execution.`,
      id: "created-codex-workpad",
    };
    mutableComments.push(pinnedComment);
    events.push(`reuse:${pinnedComment.id}`);
  }

  const writePinnedWorkpad = (body) => {
    events.push(`update:${pinnedComment.id}`);
    if (updateFails) {
      events.push("fail-closed:update");
      throw new Error("update failed");
    }
    pinnedComment.body = body;
  };

  return {
    comments: mutableComments,
    events,
    pinnedCommentId: pinnedComment.id,
    writePinnedWorkpad,
  };
};

test("personal and workflow instructions contain the ordered Codex workpad startup contract", async () => {
  const [agents, workflow] = await Promise.all([
    readFile(codexAgentsPath, "utf8"),
    readFile(workflowPath, "utf8"),
  ]);

  assert.match(agents, /## Codex Workpad Startup/);
  for (const phrase of requiredContractPhrases) {
    assert.ok(agents.includes(phrase), `AGENTS.md missing: ${phrase}`);
  }

  assert.ok(
    workflow.includes(
      "after fetching the Linear issue,\n  state, and comments but before planning, prerequisite checks, repository work,\n  blocker handling, or state classification"
    )
  );
  assert.ok(
    workflow.includes(
      "Find the active comment whose first non-blank line is exactly\n     `## Codex Workpad`"
    )
  );
  assert.match(workflow, /Never select or update `## Symphony Workpad`/);
  assert.match(workflow, /fail closed\. Do not\n     fall back/);

  const executionRules = workflow.indexOf("## Execution Rules");
  const injectedLinear = workflow.indexOf(
    "- Use Symphony's injected `linear_graphql` tool",
    executionRules
  );
  const startup = workflow.indexOf(
    "- At the beginning of every hosted issue turn",
    executionRules
  );
  const stateClassification = workflow.indexOf(
    "- Only after the Codex workpad ID is pinned",
    executionRules
  );
  const assumptions = workflow.indexOf(
    "- State assumptions and success criteria before coding.",
    executionRules
  );

  assert.ok(injectedLinear > executionRules);
  assert.ok(startup > injectedLinear);
  assert.ok(stateClassification > startup);
  assert.ok(assumptions > stateClassification);
});

test("hosted workflow requests GPT-6 Astra with xhigh reasoning", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, hostedCodexCommandPattern);
  assert.doesNotMatch(workflow, /model="gpt-5\.5"/);
});

test("canonical and hosted workflows share the required PR label publishing contract", async () => {
  const [canonical, hosted] = await Promise.all([
    readFile(join(repoRoot, "WORKFLOW.md"), "utf8"),
    readFile(workflowPath, "utf8"),
  ]);
  const labelContract = (text) =>
    text.slice(
      text.indexOf("- Every Symphony-managed PR requires"),
      text.indexOf("- Assign the PR to the project")
    );
  const contract = labelContract(hosted);
  assert.equal(labelContract(canonical), contract);
  for (const phrase of [
    "both `symphony` and the owning Linear",
    "project's `project-color` GitHub label",
    "additional project-required",
    "Do not infer it from a branch name, issue label, or a default",
    "ensure-pr-labels.mjs --issue TEAM-123 --repo OWNER/REPO",
    "gh api --method POST repos/OWNER/REPO/issues/PR_NUMBER/labels",
    "labels --paginate --jq '.[].name'",
    "actual API/readback failure",
    "Hook failures are logged and ignored by Symphony",
    "Automatic repair is not\n  evidence that labeling succeeded",
  ]) {
    assert.ok(
      contract.includes(phrase),
      `Missing PR label guidance: ${phrase}`
    );
  }
  assert.match(
    hosted,
    /  before_run: \|\n    node scripts\/symphony\/route-misc-project-on-ticket-start\.mjs/
  );
  assert.match(
    hosted,
    /  after_run: \|\n    node scripts\/symphony\/ensure-pr-labels\.mjs/
  );
  assert.match(hosted, /  after_create: \|/);
  assert.match(hosted, /  before_remove: \|\n    true/);
});

test("supported common discovery has no private runtime skill bodies", async () => {
  for (const name of commonAbsentSkillNames) {
    assert.equal(
      await pathExists(join(repoRoot, ".codex", "skills", name, "SKILL.md")),
      false,
      `${name} must not be loadable from the old common Codex skill path`
    );
  }
});

test("first-run startup creates Codex workpad before prerequisite failure and keeps blocker separate from Symphony last-run updates", () => {
  const startup = bootstrapCodexWorkpad([
    {
      body: `${symphonyHeading}\nLast run 2026-09-03T13:15:31Z`,
      id: "engine-workpad",
    },
  ]);

  startup.events.push("simulated-prerequisite-failure");
  startup.writePinnedWorkpad(
    `${codexHeading}\n\nBlocker: authentication failed.`
  );
  const symphonyWorkpad = startup.comments.find(
    (comment) => comment.id === "engine-workpad"
  );
  symphonyWorkpad.body = `${symphonyHeading}\nLast run 2026-09-03T13:20:00Z`;

  assert.deepEqual(startup.events.slice(0, 3), [
    "fetch-issue-state-comments",
    "create-codex-workpad",
    "reuse:created-codex-workpad",
  ]);
  assert.ok(
    startup.events.indexOf("create-codex-workpad") <
      startup.events.indexOf("simulated-prerequisite-failure")
  );
  assert.equal(startup.pinnedCommentId, "created-codex-workpad");
  assert.match(
    startup.comments.find((comment) => comment.id === startup.pinnedCommentId)
      .body,
    /Blocker: authentication failed\./
  );
  assert.doesNotMatch(symphonyWorkpad.body, /authentication failed/);
});

test("existing exact Codex workpad is reused without creating a duplicate", () => {
  const startup = bootstrapCodexWorkpad([
    { body: `${symphonyHeading}\nLast run`, id: "engine-workpad" },
    { body: `${codexHeading}\n\nExisting notes.`, id: "codex-workpad" },
  ]);

  assert.equal(startup.pinnedCommentId, "codex-workpad");
  assert.equal(startup.events.includes("create-codex-workpad"), false);
  assert.equal(startup.comments.filter(hasExactCodexHeading).length, 1);
});

test("Symphony workpad, similar headings, and arbitrary comments are never selected", () => {
  const startup = bootstrapCodexWorkpad([
    { body: `${symphonyHeading}\nLast run`, id: "engine-workpad" },
    { body: "## Codex Workpad Archive\nOld notes.", id: "archive" },
    { body: "### Codex Workpad\nWrong depth.", id: "wrong-depth" },
    { body: " ## Codex Workpad\nIndented heading.", id: "indented" },
    { body: "Plain comment.", id: "plain-comment" },
  ]);

  assert.equal(startup.pinnedCommentId, "created-codex-workpad");
  assert.equal(
    startup.comments.find((comment) => comment.id === "engine-workpad").body,
    `${symphonyHeading}\nLast run`
  );
  assert.equal(startup.comments.filter(hasExactCodexHeading).length, 1);
});

test("create or update failures fail closed without falling back to another comment", () => {
  const createFailure = bootstrapCodexWorkpad(
    [{ body: `${symphonyHeading}\nLast run`, id: "engine-workpad" }],
    { createFails: true }
  );

  assert.equal(createFailure.pinnedCommentId, null);
  assert.equal(createFailure.error, "create failed");
  assert.deepEqual(createFailure.events, [
    "fetch-issue-state-comments",
    "create-codex-workpad",
    "fail-closed:create",
  ]);
  assert.equal(createFailure.comments.filter(hasExactCodexHeading).length, 0);

  const updateFailure = bootstrapCodexWorkpad(
    [
      { body: `${symphonyHeading}\nLast run`, id: "engine-workpad" },
      { body: `${codexHeading}\n\nExisting notes.`, id: "codex-workpad" },
    ],
    { updateFails: true }
  );

  assert.throws(
    () => updateFailure.writePinnedWorkpad(`${codexHeading}\n\nQuestion?`),
    /update failed/
  );
  assert.equal(updateFailure.pinnedCommentId, "codex-workpad");
  assert.deepEqual(updateFailure.events, [
    "fetch-issue-state-comments",
    "reuse:codex-workpad",
    "update:codex-workpad",
    "fail-closed:update",
  ]);
  assert.equal(
    updateFailure.comments.find((comment) => comment.id === "engine-workpad")
      .body,
    `${symphonyHeading}\nLast run`
  );
});
