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
    graphql: async (_, input) => {
      ready.push(input);
      pr.draft = false;
    },
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
    ["CHANGES_REQUESTED", head, {}, "failure"],
    [null, head, {}, "failure"],
  ]) {
    const f = fixture();
    await queueCheck(f.github, request(), appId);
    if (state) f.verdict(state, sha);
    await f.finish(request(), options);
    assert.equal(f.checks[0].conclusion, conclusion);
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

test("failed draft readiness cannot leave a green check", async () => {
  const f = fixture();
  await queueCheck(f.github, request(), appId);
  f.verdict();
  f.github.graphql = async () => {
    throw new Error("readiness denied");
  };
  await assert.rejects(f.finish(), /readiness denied/);
  assert.notEqual(f.checks[0].conclusion, "success");
  await recoverCheck(f.github, context, request(), appId, {
    id: 10,
    run_attempt: 1,
    conclusion: "failure",
  });
  assert.equal(f.checks[0].conclusion, "failure");
  assert.equal(f.pr.draft, true);
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

test("workflow puts recoverable admission before review queue and serializes only publication", () => {
  const load = (name) =>
    yaml.load(readFileSync(new URL(`../${name}.yml`, import.meta.url), "utf8"));
  const { accept, review, finish } = load("cadence-ai-review-trigger").jobs;
  assert.equal(review.needs, "accept");
  assert.deepEqual(finish.needs, ["accept", "review"]);
  assert.equal(accept.concurrency.group, finish.concurrency.group);
  assert.notEqual(accept.concurrency.group, review.concurrency.group);
  assert.equal(accept.concurrency.queue, "max");
  assert.ok(
    accept.steps.findIndex(
      (step) => step.name === "Save check recovery pointer"
    ) < accept.steps.findIndex((step) => step.id === "queued")
  );
  for (const job of [accept, review, finish])
    assert.equal(
      job.steps.find((step) => step.id === "app-token").with[
        "permission-checks"
      ],
      "write"
    );
  assert.match(accept.if, /github.ref == 'refs\/heads\/main'/);
  const cleanup = load("cadence-review-check-cleanup");
  assert.deepEqual(cleanup.on.workflow_run.types, ["completed"]);
  assert.equal(
    cleanup.jobs.cleanup.steps.find(
      (step) => step.name === "Download recovery pointers as data"
    ).with["run-id"],
    "${{ github.event.workflow_run.id }}"
  );
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
    ["CI Required"]
  );
});
