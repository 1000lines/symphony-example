import yaml from "js-yaml";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CHECK_NAME,
  checkRequest,
  finishCheck,
  queueCheck,
  recoverCheck,
  startCheck,
} from "./cadence-review-check.mjs";

const appId = 42;
const head = "a".repeat(40);
const context = {
  repo: { owner: "owner", repo: "repo" },
  serverUrl: "https://github.com",
  runId: 10,
  runAttempt: 1,
};
const request = (runId = 10, sha = head) =>
  checkRequest({ ...context, runId }, 3, sha);
function fixture() {
  const checks = [],
    reviews = [],
    ready = [];
  const pr = {
    state: "open",
    draft: true,
    node_id: "PR_node",
    head: { sha: head },
  };
  const github = {
    rest: {
      checks: {
        listForRef: "checks",
        create: async (input) => {
          const check = { ...input, id: checks.length + 1, app: { id: appId } };
          checks.push(check);
          return { data: check };
        },
        update: async (input) => {
          const check = checks.find((item) => item.id === input.check_run_id);
          Object.assign(check, input);
          return { data: check };
        },
      },
      pulls: {
        get: async () => ({ data: structuredClone(pr) }),
        listReviews: "reviews",
      },
    },
    paginate: async (endpoint, input) =>
      endpoint === "reviews"
        ? reviews
        : checks.filter(
            (item) =>
              item.head_sha === input.ref &&
              item.app.id === input.app_id &&
              item.name === input.check_name
          ),
    graphql: async () => assert.fail("The Cadence App cannot ready drafts"),
  };
  const readyGraphql = async (_, input) => {
    ready.push(input);
    pr.draft = false;
    return {
      markPullRequestReadyForReview: { pullRequest: { isDraft: false } },
    };
  };
  const verdict = (state = "APPROVED", sha = head) =>
    reviews.push({
      id: reviews.length + 1,
      state,
      commit_id: sha,
      user: { login: "cadence" },
      html_url: "https://github.com/owner/repo/pull/3#pullrequestreview-1",
    });
  const finish = (req = request(), options = {}) =>
    finishCheck(github, req, appId, {
      result: "success",
      ranReview: "true",
      baseline: 0,
      reviewer: "cadence",
      readyGraphql,
      ...options,
    });
  return { github, checks, reviews, pr, ready, verdict, finish };
}

test("admission is yellow on the actual PR head; duplicate delivery and reruns stay distinct", async () => {
  const f = fixture();
  const check = await queueCheck(f.github, request(), appId);
  assert.equal(check.head_sha, head);
  assert.equal(check.status, "queued");
  assert.equal(check.name, CHECK_NAME);
  assert.match(check.details_url, /runs\/10\/attempts\/1$/);
  await queueCheck(f.github, request(), appId);
  assert.equal(f.checks.length, 1);
  assert.deepEqual(await startCheck(f.github, request(), appId), {
    active: true,
    baseline: 0,
  });
  assert.equal(check.status, "in_progress");
  f.verdict();
  await f.finish();
  assert.equal(check.conclusion, "success");
  assert.equal(check.details_url, f.reviews[0].html_url);
  assert.equal(f.ready.length, 1);
  await queueCheck(f.github, request(), appId);
  await f.finish();
  assert.equal(check.status, "completed");
  assert.equal(f.ready.length, 1);
  await queueCheck(
    f.github,
    checkRequest({ ...context, runAttempt: 2 }, 3, head),
    appId
  );
  assert.equal(f.checks.length, 2);
  assert.equal(f.checks[1].status, "queued");
});

test("same-head overlap cannot overwrite newer yellow or ready the draft", async () => {
  const f = fixture();
  await queueCheck(f.github, request(), appId);
  await startCheck(f.github, request(), appId);
  await queueCheck(f.github, request(11), appId);
  f.verdict();
  await f.finish();
  assert.equal(f.checks[0].conclusion, "cancelled");
  assert.equal(f.checks[1].status, "queued");
  assert.equal(f.ready.length, 0);
  const { baseline } = await startCheck(f.github, request(11), appId);
  await f.finish(request(11), { baseline });
  assert.equal(
    f.checks[1].conclusion,
    "failure",
    "old same-head approval cannot satisfy newer feedback"
  );
  assert.equal(f.ready.length, 0);
});

test("new heads and closure cancel obsolete work, including arrivals after closure", async () => {
  for (const closed of [false, true]) {
    const f = fixture();
    await queueCheck(f.github, request(), appId);
    f.pr.head.sha = "b".repeat(40);
    if (closed) f.pr.state = "closed";
    assert.deepEqual(await startCheck(f.github, request(), appId), {
      active: false,
    });
    assert.equal(f.checks[0].conclusion, "cancelled");
    if (!closed) {
      await queueCheck(f.github, request(11, f.pr.head.sha), appId);
      f.verdict("APPROVED", f.pr.head.sha);
      await f.finish(request(11, f.pr.head.sha));
      assert.equal(f.checks[1].conclusion, "success");
    }
  }
});

test("a newer clean result survives late completion and already-ready PRs are not transitioned again", async () => {
  const f = fixture();
  f.pr.draft = false;
  await queueCheck(f.github, request(), appId);
  await queueCheck(f.github, request(11), appId);
  f.verdict();
  await f.finish(request(11));
  await f.finish();
  assert.equal(f.checks[1].conclusion, "success");
  assert.equal(f.checks[0].conclusion, "cancelled");
  assert.equal(f.ready.length, 0);
});

test("findings, cap, missing/stale verdicts and execution failures never ready drafts", async () => {
  for (const [state, sha, options, conclusion] of [
    ["COMMENTED", head, {}, "action_required"],
    ["APPROVED", head, { result: "failure" }, "failure"],
    ["APPROVED", head, { result: "cancelled" }, "cancelled"],
    ["APPROVED", head, { ranReview: "false" }, "action_required"],
    ["APPROVED", "b".repeat(40), {}, "failure"],
    ["APPROVED", head, { reviewer: "another-bot" }, "failure"],
    ["APPROVED", head, { baseline: 1 }, "failure"],
    ["APPROVED", head, { baseline: undefined }, "failure"],
    ["CHANGES_REQUESTED", head, {}, "failure"],
    [null, head, {}, "failure"],
  ]) {
    const f = fixture();
    await queueCheck(f.github, request(), appId);
    if (state) f.verdict(state, sha);
    await f.finish(request(), options);
    assert.equal(f.checks[0].conclusion, conclusion);
    assert.doesNotMatch(f.checks[0].output.summary, /Review approved/);
    assert.equal(f.ready.length, 0);
  }
});

test("a push/closure during review or immediately before ready cancels publication", async () => {
  for (const late of [false, true]) {
    const f = fixture();
    await queueCheck(f.github, request(), appId);
    f.verdict();
    let reads = 0;
    f.github.rest.pulls.get = async () => {
      if (!late || ++reads === 2) f.pr.head.sha = "b".repeat(40);
      return { data: structuredClone(f.pr) };
    };
    await f.finish();
    assert.equal(f.checks[0].conclusion, "cancelled");
    assert.equal(f.ready.length, 0);
  }
});

test("denied readiness completes a failed advisory check and reports the exact operator handoff", async () => {
  // GraphQL permission errors can use HTTP 200; REST-style status alone is insufficient.
  for (const error of [
    Object.assign(new Error("Resource not accessible by integration"), {
      errors: [{ type: "FORBIDDEN" }],
    }),
    { status: 403, message: "readiness denied" },
  ]) {
    const f = fixture();
    await queueCheck(f.github, request(), appId);
    f.verdict();
    const outcome = await f.finish(request(), {
      readyGraphql: async () => {
        throw error;
      },
    });
    assert.equal(f.checks[0].status, "completed");
    assert.equal(f.checks[0].conclusion, "failure");
    assert.equal(f.checks[0].details_url, f.reviews[0].html_url);
    const check = f.checks[0];
    assert.match(check.output.summary, /Review approved; marking ready failed/);
    assert.ok(check.output.summary.includes(error.message));
    assert.ok(
      check.output.summary.includes(`[Review](${f.reviews[0].html_url})`)
    );
    assert.ok(
      check.output.summary.includes(
        `[Failed operation: markPullRequestReadyForReview](${request().runUrl})`
      )
    );
    assert.doesNotMatch(
      check.output.summary,
      /No clean verdict|Ready for human review/
    );
    assert.match(
      outcome.handoffError,
      /markPullRequestReadyForReview was denied for owner\/repo#3 using repository GITHUB_TOKEN/
    );
    assert.match(
      outcome.handoffError,
      /contents:write and pull-requests:write/
    );
    assert.match(f.checks[0].output.summary, /rerun all jobs/);
    assert.match(
      f.checks[0].output.summary,
      /shared Cadence App grants unchanged/
    );
    assert.equal(f.pr.draft, true);
    const published = structuredClone(check);
    await recoverCheck(f.github, context, request(), appId, {
      id: 10,
      run_attempt: 1,
      conclusion: "failure",
    });
    assert.deepEqual(check, published);
    assert.equal(f.checks[0].conclusion, "failure");
    assert.match(f.checks[0].output.summary, /was denied/);
  }
});

test("non-Error readiness failures preserve a readable diagnostic", async () => {
  for (const error of ["readiness denied", null]) {
    const f = fixture();
    await queueCheck(f.github, request(), appId);
    f.verdict();
    const outcome = await f.finish(request(), {
      readyGraphql: async () => {
        throw error;
      },
    });
    assert.ok(outcome.handoffError);
    assert.equal(f.checks[0].conclusion, "failure");
    assert.ok(f.checks[0].output.summary.includes(`\n\n${String(error)}\n\n`));
    assert.equal(f.pr.draft, true);
  }
});

test("missing readiness identity or an unconfirmed mutation never claims success or uses the App", async () => {
  for (const readyGraphql of [
    undefined,
    async () => undefined,
    async () => ({
      markPullRequestReadyForReview: { pullRequest: { isDraft: true } },
    }),
    async () => {
      throw new Error("connection lost");
    },
  ]) {
    const f = fixture();
    await queueCheck(f.github, request(), appId);
    f.verdict();
    const outcome = await f.finish(request(), { readyGraphql });
    assert.equal(f.checks[0].status, "completed");
    assert.equal(outcome.conclusion, "failure");
    assert.match(outcome.handoffError, /was not confirmed/);
    assert.equal(f.pr.draft, true);
    assert.equal(f.ready.length, 0);
  }
});

test("recovery without verified publication never infers approval from reviews", async () => {
  for (const state of [null, "APPROVED"]) {
    const f = fixture();
    if (state) f.verdict(state);
    await queueCheck(f.github, request(), appId);
    await recoverCheck(f.github, context, request(), appId, {
      id: 10,
      run_attempt: 1,
      conclusion: "failure",
    });
    assert.equal(f.checks[0].conclusion, "failure");
    assert.match(f.checks[0].output.summary, /No clean verdict is claimed/);
    assert.doesNotMatch(
      f.checks[0].output.summary,
      /Review approved|\[Review\]/
    );
    assert.equal(f.ready.length, 0);
  }
});

test("completion recovery handles queued cancellation, timeout and lost finalization on force-pushed heads", async () => {
  for (const conclusion of ["cancelled", "timed_out", "failure", "success"]) {
    const f = fixture();
    await queueCheck(f.github, request(), appId);
    await queueCheck(f.github, request(11), appId);
    f.pr.head.sha = "b".repeat(40);
    f.pr.state = "closed";
    await recoverCheck(f.github, context, request(), appId, {
      id: 10,
      run_attempt: 1,
      conclusion,
    });
    assert.equal(
      f.checks[0].conclusion,
      conclusion === "success" ? "failure" : conclusion
    );
    assert.equal(f.checks[1].status, "queued");
    await recoverCheck(f.github, context, request(), appId, {
      id: 10,
      run_attempt: 1,
      conclusion: "failure",
    });
    assert.equal(
      f.checks[0].conclusion,
      conclusion === "success" ? "failure" : conclusion
    );
    await assert.rejects(
      recoverCheck(f.github, context, request(11), appId, {
        id: 10,
        run_attempt: 1,
      }),
      /does not belong/
    );
  }
});

test("review and recovery delegate to the same revision and stay outside required application CI", () => {
  const load = (name) =>
    yaml.load(readFileSync(new URL(`../${name}.yml`, import.meta.url), "utf8"));
  const review = load("cadence-ai-review-trigger");
  const cleanup = load("cadence-review-check-cleanup");
  assert.equal(review.jobs.review.concurrency, undefined);
  assert.equal(review.concurrency, undefined);
  assert.equal(cleanup.jobs.cleanup.with["helpers-ref"], review.jobs.review.with["helpers-ref"]);
  assert.equal(cleanup.jobs.cleanup.uses.split("@")[1], review.jobs.review.uses.split("@")[1]);
  assert.deepEqual(cleanup.on.workflow_run.types, ["completed"]);
  assert.deepEqual(cleanup.on.workflow_run.workflows, ["Cadence AI Review Events", "Cadence AI Review Trigger", "Cadence AI Review"]);
  for (const name of ["cadence-ai-review-trigger", "cadence-ai-review-events", "cadence-ai-review"]) {
    const caller = load(name);
    assert.equal(caller.permissions.contents, "write");
    assert.equal(caller.permissions["pull-requests"], "write");
    assert.equal(caller.jobs.review.steps, undefined);
  }
  const ci = load("ci");
  assert.deepEqual(ci.jobs.required.needs, [
    "build",
    "lint",
    "test",
    "markdown",
  ]);
  const config = JSON.parse(
    readFileSync(
      new URL("../../../.symphony.cfg.json", import.meta.url),
      "utf8"
    )
  );
  assert.deepEqual(
    config.ci.requiredChecks.map((check) => check.name),
    ["CI Required", "Client template tests"]
  );
});
