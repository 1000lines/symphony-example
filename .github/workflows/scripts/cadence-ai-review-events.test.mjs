import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";
import yaml from "js-yaml";

const require = createRequire(import.meta.url);
const verifyCadenceAiReview = require("./verify-cadence-ai-review.cjs");

const workflow = readFileSync(
  new URL("../cadence-ai-review-events.yml", import.meta.url),
  "utf8"
);
const trigger = readFileSync(new URL("../cadence-ai-review-trigger.yml", import.meta.url), "utf8");
const triggerWorkflow = yaml.load(trigger);

test("trusted event calls allow their verified trigger actor without changing publishing identity", () => {
  assert.deepEqual(Object.keys(triggerWorkflow.on), [
    "pull_request_target", "workflow_dispatch", "workflow_call",
  ]);
  const steps = triggerWorkflow.jobs.review.steps;
  const review = steps.find((step) => step.id === "cadence_review");
  assert.equal(review.uses, "anthropics/claude-code-action@30544b674398ee15c84819bd87caf8a87e8c7b55");

  assert.match(triggerWorkflow.jobs.review.if, /github.ref == 'refs\/heads\/main'/);
  assert.equal(review.with.github_token, '${{ secrets.CADENCE_BOT_GITHUB_TOKEN }}');
  assert.equal(review.with.allowed_non_write_users, undefined);
  assert.equal(review["continue-on-error"], undefined);
  assert.equal(triggerWorkflow.jobs.review.environment, "cadence-controller");
  assert.equal(steps.find((step) => step.id === "plan").env.TRIGGER_ACTOR, "${{ github.actor }}");
});

test("outcome verification preserves startup failure, current-head checks and review cleanup", async (t) => {
  const step = triggerWorkflow.jobs.review.steps.find((entry) => entry.name.startsWith("Verify review outcomes"));
  assert.equal(step.if, "always() && steps.plan.outputs.run_claude == 'true'");
  assert.equal(step.env.CADENCE_REVIEW_OUTCOME, "${{ steps.cadence_review.outcome }}");
  const AsyncFunction = Object.getPrototypeOf(async function () { return undefined; }).constructor;
  const run = new AsyncFunction("require", "github", "context", "core", "process", step.with.script);
  const previousPr = process.env.PR_NUMBER;
  process.env.PR_NUMBER = "33";
  t.after(() => {
    if (previousPr === undefined) delete process.env.PR_NUMBER;
    else process.env.PR_NUMBER = previousPr;
  });

  for (const [outcome, state, sha, fails, dismisses] of [
    ["success", "APPROVED", "head", false, false],
    ["success", "COMMENTED", "head", false, false],
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
        users: { getAuthenticated: async () => ({ data: { login: "cadence" } }) },
        pulls: {
          get: async () => ({ data: { head: { sha: "head" } } }),
          listReviews: "reviews",
          dismissReview: async (input) => dismissed.push(input.review_id),
        },
      },
      paginate: async () => state ? [{ id: 1, user: { login: "cadence" }, state, commit_id: sha }] : [],
    };
    await run(
      () => verifyCadenceAiReview, github, { repo: { owner: "owner", repo: "repo" } },
      { setFailed: (message) => errors.push(message) },
      { env: { CADENCE_REVIEW_OUTCOME: outcome } },
    );
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

test("events call review only after the existing author-permission router succeeds", () => {
  const { route, review } = yaml.load(workflow).jobs;
  assert.equal(review.needs, 'route');
  assert.equal(review.if, "needs.route.outputs.should_request_review == 'true'");
  assert.equal(review.uses, './.github/workflows/cadence-ai-review-trigger.yml');
  assert.equal(review.secrets, 'inherit');
  assert.equal(review.with.pr_number, '${{ needs.route.outputs.pr_number }}');
  assert.equal(route.outputs.should_request_review, '${{ steps.route.outputs.should_request_review }}');
  assert.equal(route.steps.find(step => step.id === 'route').run,
    'node .github/workflows/scripts/cadence-ai-review-route-event.mjs');
  assert.equal(route.permissions['pull-requests'], 'read');
  assert.doesNotMatch(workflow, /request-pr-reviewer|cadence-linear-workpad|fetch-pr-review-state/);
});

test("manual matrix and events reuse the same reviewer with sufficient inherited permissions", () => {
  const manual = yaml.load(readFileSync(new URL('../cadence-ai-review.yml', import.meta.url), 'utf8'));
  const events = yaml.load(workflow);
  assert.equal(manual.jobs.review.uses, events.jobs.review.uses);
  assert.equal(manual.jobs.review.with.pr_number, '${{ matrix.pr_number }}');
  assert.deepEqual(manual.jobs.review.secrets, events.jobs.review.secrets);
  // Named/empty mappings lose environment secrets in reusable jobs (runner#4453).
  assert.equal(manual.jobs.review.secrets, 'inherit');
  assert.equal(triggerWorkflow.jobs.review.environment, "cadence-controller");
  assert.equal(triggerWorkflow.jobs.review.steps.find(step => step.id === "app-token").with["private-key"],
    "${{ secrets.CADENCE_APP_PRIVATE_KEY }}");
  assert.equal(triggerWorkflow.jobs.review.concurrency.queue, 'max');
  assert.equal(triggerWorkflow.jobs.review.concurrency['cancel-in-progress'], false);
  assert.equal(manual.jobs.resolve.if, "github.ref == 'refs/heads/main'");
  for (const caller of [manual, events]) assert.deepEqual(caller.permissions, triggerWorkflow.permissions);
  assert.equal(triggerWorkflow.jobs.review.concurrency.group,
    'cadence-ai-review-${{ github.repository }}-pr-${{ inputs.pr_number || github.event.pull_request.number }}');
});

test("closing a PR cancels only its review group; late arrivals skip review planning", () => {
  const { review, 'cancel-closed': cancel } = triggerWorkflow.jobs;
  assert.ok(triggerWorkflow.on.pull_request_target.types.includes('closed'));
  assert.equal(cancel.if, "github.event_name == 'pull_request_target' && github.event.action == 'closed'");
  assert.equal(cancel.concurrency['cancel-in-progress'], true);
  assert.equal(cancel.concurrency.queue, 'single');
  assert.deepEqual(cancel.permissions, {});
  assert.equal(cancel.environment, undefined);
  const group = (job, number, inputs = {}) => job.concurrency.group.replace(/\$\{\{(.*?)\}\}/g,
    (_, expression) => new Function('github', 'inputs', `return ${expression}`)(
      { repository: 'owner/repo', event: { pull_request: { number } } }, inputs));
  assert.equal(group(cancel, 18), group(review, 18));
  assert.equal(group(cancel, 18), group(review, undefined, { pr_number: '18' }));
  assert.notEqual(group(cancel, 18), group(review, 20));
  const metadata = review.steps.find(step => step.id === 'pr');
  assert.match(metadata.run, /--json state,/);
  assert.match(metadata.run, /printf 'state=%s/);
  assert.equal(review.steps.find(step => step.id === 'plan').if, "steps.pr.outputs.state == 'OPEN'");
  assert.equal(review.steps.find(step => step.id === 'cadence_review').if, "steps.plan.outputs.run_claude == 'true'");
});

test("bot allowance never substitutes a human initiator for the Action's write check", () => {
  const expression = triggerWorkflow.jobs.review.steps.find(step => step.id === 'cadence_review')
    .with.allowed_bots.slice(3, -2).replace('steps.app-token.outputs.app-slug', "steps['app-token'].outputs['app-slug']");
  const evaluate = new Function('github', 'steps', `return ${expression}`);
  const steps = { 'app-token': { outputs: { 'app-slug': 'configured-app' } } };
  // Both low-permission and writer accounts follow the provider's normal user check.
  for (const login of ['stranger', 'writer', 'custom-developer']) {
    assert.equal(evaluate({ event_name: 'workflow_run', actor: login,
      event: { workflow_run: { actor: { type: 'User', login } } } }, steps), 'configured-app');
  }
  assert.equal(evaluate({ event_name: 'workflow_run', actor: 'different-human',
    event: { workflow_run: { actor: { type: 'Bot', login: 'installation[bot]' } } } }, steps), 'installation[bot]');
  assert.equal(evaluate({ event_name: 'workflow_dispatch', actor: 'manual-caller', event: {} }, steps), 'configured-app');
});
