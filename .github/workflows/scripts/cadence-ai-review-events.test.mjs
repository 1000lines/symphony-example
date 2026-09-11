import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const workflow = readFileSync(
  new URL("../cadence-ai-review-events.yml", import.meta.url),
  "utf8"
);
const trigger = readFileSync(new URL("../cadence-ai-review-trigger.yml", import.meta.url), "utf8");

test("the review trigger uses the existing App for feedback permission reads", () => {
  const stateStep = trigger.match(/- name: Fetch PR review state\n[\s\S]*?(?=\n      - name:)/)?.[0];
  assert.match(stateStep, /GH_TOKEN: \$\{\{ steps.app-token.outputs.token \}\}/);
  assert.match(trigger, /environment: cadence-controller/);
  assert.match(trigger, /app-id: \$\{\{ vars.CADENCE_APP_ID \}\}/);
  assert.match(trigger, /permission-pull-requests: read/);
});

test("App review requests reach the trigger and only the minted App identity passes its bot guard", () => {
  assert.match(trigger, /github.event.sender.type == 'Bot'/);
  const guard = trigger.match(/- name: Verify App review requester\n[\s\S]*?(?=\n      - name:)/)?.[0];
  assert.ok(guard, "review-request bot guard must precede review work");
  assert.ok(trigger.indexOf(guard) < trigger.indexOf("- name: Fetch PR review state"));
  assert.match(guard, /if: github.event_name == 'pull_request_target'/);
  assert.match(guard, /APP_SLUG: \$\{\{ steps.app-token.outputs.app-slug \}\}/);
  const script = guard.split("run: |\n")[1].replace(/^          /gm, "");
  for (const [actor, type, slug, passes] of [
    ["existing-cadence[bot]", "Bot", "existing-cadence", true],
    ["unrelated[bot]", "Bot", "existing-cadence", false],
    ["existing-cadence[bot]", "Bot", "", false],
    ["writer", "User", "existing-cadence", true],
    ["example-cadence-bot", "User", "existing-cadence", true],
  ]) {
    const result = spawnSync("bash", ["-e", "-c", script], {
      env: { REQUEST_ACTOR: actor, REQUEST_ACTOR_TYPE: type, APP_SLUG: slug }, encoding: "utf8",
    });
    assert.equal(result.status === 0, passes, `${actor}: ${result.stdout} ${result.stderr}`);
  }
});

test("request-review failure path preserves request-pr-reviewer failure status", () => {
  assert.match(
    workflow,
    /if output="\$\(node \.github\/workflows\/scripts\/request-pr-reviewer\.mjs 2>&1\)"; then[\s\S]*?\n {10}else\n {12}request_status=\$\?\n {10}fi/
  );
  assert.doesNotMatch(workflow, /\n {10}fi\n\n {10}request_status=\$\?\n/);
});

test("request-review uses workflow token for delete and bot token for post", () => {
  assert.match(workflow, /pull-requests: write/);
  assert.match(
    workflow,
    /GH_TOKEN: \$\{\{ steps\.app-token\.outputs\.token \}\}/
  );
  assert.match(workflow, /DELETE_GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /REVIEW_REQUEST_ACTOR: \$\{\{ format\('\{0\}\[bot\]', steps.app-token.outputs.app-slug\) \}\}/);
});

test("request-review failure path does not dispatch workflow and names manual remedy", () => {
  assert.match(
    workflow,
    /Manual remedy: re-request \$\{REVIEWER_LOGIN\} on PR #\$\{PR_NUMBER\}, or dispatch the Cadence AI Review workflow with pr_number=\$\{PR_NUMBER\}\./
  );
  assert.doesNotMatch(
    workflow,
    /gh workflow run cadence-ai-review-trigger\.yml/
  );
  assert.doesNotMatch(workflow, /WORKFLOW_REF/);
});

test("route job serializes all receipt checks and mutations for a PR", () => {
  assert.match(workflow, /concurrency:/);
  assert.match(
    workflow,
    /group: >-\n +cadence-ai-review-events-\$\{\{ github.repository \}\}-\$\{\{ github.event.pull_request.number \|\| github.event.issue.number \|\| 'no-pr' \}\}\n/
  );
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /queue: max/);
});

test("receipt writes do not enqueue more event-router jobs", () => {
  assert.match(
    workflow,
    /github.event_name == 'issue_comment' &&\s+github.actor == \(vars.CADENCE_REVIEWER \|\| 'example-cadence-bot'\) &&\s+startsWith\(github.event.comment.body, '<!-- cadence-review-request-receipts:v1'\)/
  );
});

test("event route fetches current head and last reviewed SHA for workpad evidence", () => {
  assert.match(workflow, /Fetch current PR review state for event/);
  assert.match(workflow, /node scripts\/fetch-pr-review-state\.mjs/);
  assert.match(workflow, /printf 'current_head_sha=%s\\n'/);
  assert.match(workflow, /printf 'last_reviewed_sha=%s\\n'/);
});

test("event requests opt into durable receipts without a Linear lock", () => {
  assert.match(workflow, /COALESCE_REVIEW_EVENT: "true"/);
  assert.doesNotMatch(workflow, /Coalesce duplicate trigger context/);
  assert.doesNotMatch(workflow, /planTriggerCoalescing/);
  assert.match(
    workflow,
    /should_request_review: \$\{\{ steps\.route\.outputs\.should_request_review \}\}/
  );
  assert.match(
    workflow,
    /if: steps\.route\.outputs\.should_request_review == 'true'/
  );
});

test("event route records trigger context evidence in the Cadence workpad update", () => {
  assert.match(workflow, /triggerCoalescing:/);
  assert.match(workflow, /coalescingKey: \$coalescingKey/);
  assert.match(workflow, /mechanism: "github-receipt-and-pr-concurrency"/);
  assert.ok(
    workflow.indexOf("Write Cadence workpad trigger decision") >
      workflow.indexOf("Request or re-request Cadence review")
  );
  assert.match(
    workflow,
    /REQUESTED_REVIEW: \$\{\{ steps.request_cadence_review.outputs.requested \}\}/
  );
  assert.match(
    workflow,
    /SKIP_REASON: \$\{\{ steps.request_cadence_review.outputs.skip_reason \|\| steps.route.outputs.skip_reason \}\}/
  );
  assert.doesNotMatch(workflow, /eventUpdate:/);
});
