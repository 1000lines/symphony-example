import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { classifyPrReviewState } from "./fetch-pr-review-state.mjs";

const codingActor = process.env.SYMPHONY_BOT_USER || "example-symphony-bot";
const reviewer = "example-cadence-bot";

const stateFor = (nodes, { pagedOut = false } = {}) =>
  classifyPrReviewState(
    {
      headRefOid: "head",
      isDraft: false,
      timelineItems: {
        pageInfo: { hasPreviousPage: pagedOut },
        nodes,
      },
    },
    reviewer
  );

const cadenceReview = (
  submittedAt = "2026-06-27T10:00:00Z",
  { state = "COMMENTED", oid = "base" } = {}
) => ({
  __typename: "PullRequestReview",
  author: { login: reviewer },
  submittedAt,
  state,
  commit: { oid },
});

const review = (actor, submittedAt = "2026-06-27T10:05:00Z") => ({
  __typename: "PullRequestReview",
  author: { login: actor },
  authority: { allowed: ["example-human", "example-reviewer"].includes(actor), contentTrust: ["example-human", "example-reviewer"].includes(actor) ? "verified-human-writer" : "untrusted" },
  submittedAt,
  state: "COMMENTED",
  commit: { oid: "head" },
});

const comment = (actor, createdAt = "2026-06-27T10:06:00Z") => ({
  __typename: "IssueComment",
  author: { login: actor },
  authority: { allowed: ["example-human", "example-reviewer"].includes(actor), contentTrust: ["example-human", "example-reviewer"].includes(actor) ? "verified-human-writer" : "untrusted" },
  createdAt,
});

const forcePush = (actor, createdAt = "2026-06-27T10:07:00Z") => ({
  __typename: "HeadRefForcePushedEvent",
  actor: { login: actor },
  createdAt,
  afterCommit: { oid: "rebased-head" },
});

const commit = (actor, committedDate = "2026-06-27T10:08:00Z") => ({
  __typename: "PullRequestCommit",
  commit: {
    oid: "commit-head",
    committedDate,
    author: { user: { login: actor } },
    committer: { user: { login: actor } },
  },
});

const ready = (actor, createdAt = "2026-06-27T10:09:00Z") => ({
  __typename: "ReadyForReviewEvent",
  actor: { login: actor },
  createdAt,
});

const draft = (actor, createdAt = "2026-06-27T10:10:00Z") => ({
  __typename: "ConvertToDraftEvent",
  actor: { login: actor },
  createdAt,
});

test("returns first-review when Cadence has not reviewed the PR", () => {
  const state = stateFor([comment("example-human")]);

  assert.equal(state.decision, "first-review");
  assert.equal(state.reviewStatus, "unreviewed");
  assert.equal(state.staleApproval, false);
  assert.equal(state.lastReview, null);
  assert.deepEqual(state.since, []);
  assert.deepEqual(state.workpadSince, []);
  assert.deepEqual(state.ignoredSince, []);
});

test("returns skip when nothing changed after Cadence's review", () => {
  const state = stateFor([
    comment("example-human"),
    cadenceReview("2026-06-27T10:00:00Z", { oid: "head" }),
  ]);

  assert.equal(state.decision, "skip");
  assert.equal(state.reviewStatus, "skipped-review");
  assert.equal(state.staleApproval, false);
  assert.equal(state.lastReview.oid, "head");
  assert.deepEqual(state.since, []);
});

test("distinguishes a fresh Cadence approval at the current head", () => {
  const state = stateFor([
    cadenceReview("2026-06-27T10:00:00Z", {
      state: "APPROVED",
      oid: "head",
    }),
  ]);

  assert.equal(state.decision, "skip");
  assert.equal(state.reviewStatus, "fresh-approval");
  assert.equal(state.staleApproval, false);
  assert.deepEqual(state.staleApprovalReasons, []);
});

test("human comments and review summaries after Cadence trigger incremental re-review", () => {
  const state = stateFor([cadenceReview(), comment("example-human"), review("example-reviewer")]);

  assert.equal(state.decision, "incremental");
  assert.equal(state.reviewStatus, "incremental-re-review");
  assert.deepEqual(
    state.since.map((activity) => activity.type),
    ["IssueComment", "PullRequestReview"]
  );
  assert.equal(state.humanGroundedSince.length, 2);
  assert.ok(state.since.every((activity) => activity.reviewRelevant));
  assert.ok(state.since.every((activity) => activity.humanGrounded));
});

test("example-cadence-bot self activity after its review does not trigger itself", () => {
  const state = stateFor([cadenceReview(), comment("example-cadence-bot")]);

  assert.equal(state.decision, "skip");
  assert.deepEqual(state.since, []);
  assert.equal(state.ignoredSince.length, 1);
  assert.equal(state.ignoredSince[0].isSelf, true);
  assert.equal(state.ignoredSince[0].routing, "ignore");
});

test("known AI actor and dependency-bot comments are workpad-only by default", () => {
  const state = stateFor([
    cadenceReview(),
    comment("claude[bot]"),
    comment("dependabot[bot]"),
  ]);

  assert.equal(state.decision, "skip");
  assert.deepEqual(state.since, []);
  assert.deepEqual(
    state.workpadSince.map(
      (activity) => activity.actorClassification.classification
    ),
    ["ai_actor", "dependency_bot"]
  );
  assert.ok(state.workpadSince.every((activity) => !activity.humanGrounded));
  assert.ok(
    state.workpadSince.every((activity) => activity.routing === "workpad")
  );
});

test("unverified outside feedback stays untrusted and cannot reset the review loop", () => {
  const state = stateFor([cadenceReview(), comment("new-contributor")]);

  assert.equal(state.decision, "skip");
  assert.equal(state.since.length, 0);
  assert.equal(state.humanGroundedSince.length, 0);
  assert.equal(state.workpadSince[0].authority.contentTrust, "untrusted");
});

test("force-push after Cadence's review still forces a full re-review", () => {
  const state = stateFor([cadenceReview(), forcePush(codingActor)]);

  assert.equal(state.decision, "full-review-rebased");
  assert.equal(state.reviewStatus, "full-re-review");
  assert.equal(state.since.length, 1);
  assert.equal(state.since[0].type, "HeadRefForcePushedEvent");
  assert.equal(state.since[0].reviewRelevant, true);
  assert.equal(state.since[0].humanGrounded, false);
});

test("PR commits after Cadence's review are review-relevant even from non-human actors", () => {
  const state = stateFor([cadenceReview(), commit(codingActor)]);

  assert.equal(state.decision, "incremental");
  assert.equal(state.reviewStatus, "incremental-re-review");
  assert.equal(state.since.length, 1);
  assert.equal(state.since[0].type, "PullRequestCommit");
  assert.equal(state.since[0].actorClassification.classification, "ai_actor");
  assert.equal(state.since[0].actorClassification.actorKind, "coding");
  assert.equal(state.since[0].reviewRelevant, true);
  assert.equal(state.since[0].humanGrounded, false);
});

test("stale Cadence approval is visible after a new commit", () => {
  const state = stateFor([
    cadenceReview("2026-06-27T10:00:00Z", {
      state: "APPROVED",
      oid: "base",
    }),
    commit(codingActor),
  ]);

  assert.equal(state.decision, "incremental");
  assert.equal(state.reviewStatus, "stale-approval");
  assert.equal(state.staleApproval, true);
  assert.deepEqual(state.staleApprovalReasons, [
    "head-sha-changed",
    "review-relevant-activity",
  ]);
});

test("stale Cadence approval is visible after human feedback at the same head", () => {
  const state = stateFor([
    cadenceReview("2026-06-27T10:00:00Z", {
      state: "APPROVED",
      oid: "head",
    }),
    comment("example-human"),
  ]);

  assert.equal(state.decision, "incremental");
  assert.equal(state.reviewStatus, "stale-approval");
  assert.equal(state.staleApproval, true);
  assert.deepEqual(state.staleApprovalReasons, ["review-relevant-activity"]);
});

test("human draft and ready transitions are review-relevant", () => {
  const state = stateFor([cadenceReview(), ready("example-human"), draft("example-human")]);

  assert.equal(state.decision, "incremental");
  assert.deepEqual(
    state.since.map((activity) => activity.type),
    ["ReadyForReviewEvent", "ConvertToDraftEvent"]
  );
  assert.ok(state.since.every((activity) => activity.humanGrounded));
});

test("paged-out prior Cadence review remains a full review", () => {
  const state = stateFor([comment("example-human")], { pagedOut: true });

  assert.equal(state.decision, "full-review-paged-out");
  assert.equal(state.reviewStatus, "full-re-review");
  assert.equal(state.pagedOut, true);
  assert.deepEqual(state.since, []);
});

test("CLI reads the live timeline without a repository registry", () => {
  const cli = new URL("./fetch-pr-review-state.mjs", import.meta.url);
  const pr = { headRefOid: "a".repeat(40), isDraft: true,
    timelineItems: { nodes: [], pageInfo: { hasPreviousPage: false } } };
  const script = `process.argv = [process.execPath, ${JSON.stringify(fileURLToPath(cli))}, "6"];
    globalThis.fetch = async () => ({ ok: true, json: async () => (${JSON.stringify({ data: { repository: { pullRequest: pr } } })}) });
    await import(${JSON.stringify(cli.href)});`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8", env: { ...process.env, GH_TOKEN: "fixture", REPO_SLUG: "unseen-owner/repo" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).decision, "first-review");
});
