import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import yaml from "js-yaml";

const require = createRequire(import.meta.url);
const verifyCadenceAiReview = require("./verify-cadence-ai-review.cjs");
const readWorkflow = name => yaml.load(readFileSync(new URL(`../${name}.yml`, import.meta.url), "utf8"));

test("review callers delegate to matching shared workflow/helper revisions with explicit secrets", () => {
  const reviewSecrets = ["CADENCE_APP_PRIVATE_KEY", "CADENCE_OPENAI_API_KEY", "CADENCE_AI_REVIEW_ANTHROPIC_API_KEY", "CADENCE_LINEAR_API_TOKEN"];
  const mappings = [
    ["cadence-ai-review-events", "review", reviewSecrets],
    ["cadence-ai-review-trigger", "review", reviewSecrets],
    ["cadence-ai-review", "review", reviewSecrets],
    ["cadence-linear-rework", "handoff", ["CADENCE_APP_PRIVATE_KEY", "CADENCE_LINEAR_API_TOKEN"]],
    // Template main pins ddc9eb0: cleanup only accepts the App key at that revision.
    ["cadence-review-check-cleanup", "cleanup", ["CADENCE_APP_PRIVATE_KEY"]],
  ];
  const refs = new Set();
  for (const [name, jobName, secrets] of mappings) {
    const workflow = readWorkflow(name);
    const job = workflow.jobs[jobName];
    const [source, ref] = job.uses.split("@");
    assert.equal(source, `1000lines/symphony-client-workflows/.github/workflows/${name}.yml`);
    assert.match(ref, /^[a-f0-9]{40}$/);
    refs.add(ref);
    assert.equal(job.with["helpers-ref"], ref);
    assert.deepEqual(Object.keys(job.secrets).sort(), [...secrets].sort());
    for (const secret of secrets) assert.equal(job.secrets[secret], "${{ secrets." + secret + " }}");
    assert.equal(job.steps, undefined);
    assert.doesNotMatch(JSON.stringify(workflow), /CADENCE_BOT_GITHUB_TOKEN|team_reviewers|CADENCE_HUMAN_REVIEW_TEAM/);
  }
  assert.equal(refs.size, 1);
});

test("native events and manual inputs reach the shared review workflows", () => {
  const trigger = readWorkflow("cadence-ai-review-trigger");
  assert.deepEqual(trigger.on.pull_request_target.types, ["review_requested", "closed"]);
  assert.equal(trigger.on.workflow_dispatch.inputs.pr_number.required, true);
  assert.equal(trigger.jobs.review.with.pr_number, "${{ inputs.pr_number || format('{0}', github.event.pull_request.number) }}");
  for (const name of ["cadence-ai-review-events", "cadence-linear-rework"]) {
    assert.deepEqual(readWorkflow(name).on.workflow_run, { workflows: ["Cadence Review Ingress"], types: ["completed"] });
  }
  const manual = readWorkflow("cadence-ai-review");
  for (const input of ["pr_numbers", "review_label"]) assert.equal(manual.jobs.review.with[input], "${{ inputs." + input + " }}");
  assert.deepEqual(readWorkflow("cadence-review-check-cleanup").on.workflow_run, {
    workflows: ["Cadence AI Review Events", "Cadence AI Review Trigger", "Cadence AI Review"], types: ["completed"],
  });
});

test("legacy users and unrelated Apps cannot satisfy App review verification", async (t) => {
  const previousPr = process.env.PR_NUMBER;
  process.env.PR_NUMBER = "33";
  t.after(() => {
    if (previousPr === undefined) delete process.env.PR_NUMBER;
    else process.env.PR_NUMBER = previousPr;
  });
  for (const [reviewer, author] of [
    ["cadence[bot]", "legacy-cadence-user"],
    ["cadence[bot]", "unrelated[bot]"],
    ["", "cadence[bot]"],
    ["legacy-cadence-user", "legacy-cadence-user"],
  ]) {
    const errors = [];
    await verifyCadenceAiReview({
      reviewer,
      reviewOutcome: "success",
      context: { repo: { owner: "owner", repo: "repo" } },
      core: { setFailed: (message) => errors.push(message) },
      github: {
        rest: {
          pulls: {
            get: async () => ({ data: { head: { sha: "head" } } }),
            listReviews: "reviews",
          },
        },
        paginate: async () => [
          { user: { login: author }, state: "APPROVED", commit_id: "head" },
        ],
      },
    });
    assert.equal(errors.length, 1);
    assert.match(
      errors[0],
      reviewer.endsWith("[bot]")
        ? /No Cadence review at current head/
        : /trusted Cadence App reviewer login/
    );
  }
});

test("App verdicts reach handoff while legacy and unrelated bots remain non-human", async () => {
  const { classifyCadenceLinearReworkEvent } = await import(
    "../../../scripts/cadence-linear-rework.mjs"
  );
  for (const [author, state, body, reason] of [
    [
      "cadence[bot]",
      "APPROVED",
      "Assessment: Approve",
      "cadence-review-approved",
    ],
    [
      "cadence[bot]",
      "COMMENTED",
      "Assessment: Blocked",
      "cadence-review-actionable-content",
    ],
    [
      "cadence[bot]",
      "COMMENTED",
      "Assessment: Human input needed",
      "cadence-review-human-input-needed",
    ],
    [
      "example-cadence-bot",
      "APPROVED",
      "Assessment: Approve",
      "non-human-review",
    ],
    ["unrelated[bot]", "APPROVED", "Assessment: Approve", "non-human-review"],
  ]) {
    const result = classifyCadenceLinearReworkEvent({
      cadenceReviewerLogin: "cadence[bot]",
      payload: {
        action: "submitted",
        pull_request: {
          number: 33,
          state: "open",
          title: "[100-49]: example",
          user: { login: "example-symphony-bot" },
          labels: [{ name: "symphony" }],
        },
        review: { user: { login: author }, state, body },
      },
    });
    assert.equal(result.reason, reason);
  }
});


test("outcome verification preserves startup failure, current-head checks and review cleanup", async (t) => {
  const previousPr = process.env.PR_NUMBER;
  process.env.PR_NUMBER = "33";
  t.after(() => {
    if (previousPr === undefined) delete process.env.PR_NUMBER;
    else process.env.PR_NUMBER = previousPr;
  });

  for (const [outcome, state, sha, fails, dismisses] of [
    ["success", "APPROVED", "head", false, false],
    ["success", "COMMENTED", "head", false, false],
    ["success", "PENDING", "head", true, false],
    ["success", "DISMISSED", "head", true, false],
    ["success", "APPROVED", "stale", true, false],
    ["failure", "APPROVED", "head", true, false],
    ["failure", null, null, true, false],
    ["skipped", null, null, true, false],
    ["cancelled", null, null, true, false],
    ["", null, null, true, false],
    ["success", "CHANGES_REQUESTED", "head", true, true],
    ["failure", "CHANGES_REQUESTED", "head", true, true],
  ]) {
    const errors = [];
    const dismissed = [];
    const github = {
      rest: {
        users: { getAuthenticated: async () => assert.fail("Installation tokens cannot read /user") },
        pulls: {
          get: async () => ({ data: { head: { sha: "head" } } }),
          listReviews: "reviews",
          dismissReview: async (input) => dismissed.push(input.review_id),
        },
      },
      paginate: async () => state ? [{ id: 1, user: { login: "cadence[bot]" }, state, commit_id: sha }] : [],
    };
    await verifyCadenceAiReview({
      github,
      context: { repo: { owner: "owner", repo: "repo" } },
      core: { setFailed: (message) => errors.push(message) },
      reviewer: "cadence[bot]",
      reviewOutcome: outcome,
    });
    assert.equal(errors.length > 0, fails, `${outcome}: ${state} at ${sha}`);
    assert.equal(dismissed.length > 0, dismisses);
    if (outcome !== "success") {
      assert.match(errors.join(" "), /Review execution did not succeed/);
      assert.doesNotMatch(errors.join(" "), /reported success/);
    }
    if (state === null || sha === "stale") {
      assert.match(errors.join(" "), /No Cadence review at current head/);
    }
  }
});
