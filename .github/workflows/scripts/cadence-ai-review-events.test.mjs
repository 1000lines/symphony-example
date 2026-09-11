import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../cadence-ai-review-events.yml", import.meta.url),
  "utf8"
);

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

test("route job serializes duplicate review contexts with workflow concurrency", () => {
  assert.match(workflow, /concurrency:/);
  assert.match(
    workflow,
    /github\.event\.review\.id \|\| github\.event\.comment\.pull_request_review_id \|\| github\.event\.comment\.id \|\| 'head'/
  );
  assert.match(workflow, /cancel-in-progress: false/);
});

test("event route fetches current head and last reviewed SHA for workpad evidence", () => {
  assert.match(workflow, /Fetch current PR review state for event/);
  assert.match(workflow, /node scripts\/fetch-pr-review-state\.mjs/);
  assert.match(workflow, /printf 'current_head_sha=%s\\n'/);
  assert.match(workflow, /printf 'last_reviewed_sha=%s\\n'/);
});

test("event route relies on workflow concurrency instead of a Linear coalescing lock", () => {
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
  assert.match(workflow, /mechanism: "github-actions-concurrency"/);
  assert.doesNotMatch(workflow, /eventUpdate:/);
});
