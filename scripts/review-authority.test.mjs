import assert from "node:assert/strict";
import test from "node:test";
import yaml from "js-yaml";
import { readFileSync } from "node:fs";
import { routeReviewHandoff } from "./cadence-linear-rework.mjs";
import { routeCadenceReviewEvent } from "../.github/workflows/scripts/cadence-ai-review-route-event.mjs";
import { verifyGitHubHumanWriteAccess, verifyReviewEventAuthority } from "./github-actor-classification.mjs";
import { classifyPrReviewState, markFeedbackAuthority } from "./fetch-pr-review-state.mjs";

const repository = "example-org/example-repo";
const root = `https://api.github.com/repos/${repository}`;
const token = "ghs_secretFixture";
const author = { id: 42, login: "writer", type: "User" };
const surfaces = [
  ["pull_request_review", "submitted"], ["pull_request_review", "edited"],
  ["issue_comment", "created"], ["issue_comment", "edited"],
  ["pull_request_review_comment", "created"], ["pull_request_review_comment", "edited"],
];
const event = (eventName, action) => {
  const pr = { number: 7, state: "open", title: "[DEMO-7]: change design",
    labels: [{ name: "symphony" }], user: { login: "example-symphony-bot" },
    base: { repo: { full_name: repository } }, head: { sha: "head", ref: "DEMO-7" } };
  const feedback = { id: 9, body: "Change the design", state: "commented", user: { ...author },
    updated_at: "2026-09-10T01:00:00Z" };
  return { action, repository: { full_name: repository },
    sender: { id: 999, login: "admin-editor", type: "User" },
    ...(eventName === "issue_comment" ? { issue: { ...pr, pull_request: {} } } : { pull_request: pr }),
    [eventName === "pull_request_review" ? "review" : "comment"]: feedback };
};
const fixture = (payload, permission = { permission: "write", user: author }) => {
  const feedback = structuredClone(payload.review || payload.comment);
  const calls = [];
  const api = { calls, current: { ...feedback, issue_url: `${root}/issues/7`, pull_request_url: `${root}/pulls/7` }, permission };
  api.fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method || "GET" });
    assert.equal(options.headers.authorization, `Bearer ${token}`);
    assert.equal(options.redirect, "error");
    assert.equal(options.headers["cache-control"], "no-cache");
    if (url === `${root}/collaborators/writer/permission`) {
      if (api.permission instanceof Error) throw api.permission;
      if (api.permission instanceof Response) return api.permission.clone();
      return Response.json(api.permission);
    }
    assert.ok([`${root}/pulls/7/reviews/9`, `${root}/issues/comments/9`, `${root}/pulls/comments/9`].includes(url), url);
    return Response.json(api.current);
  };
  return api;
};

const denials = [
  ["outsider", { permission: "none", user: author }],
  ["read", { permission: "read", user: author }],
  ["triage", { permission: "read", role_name: "triage", user: author }],
  ["custom read role", { permission: "read", role_name: "admin", user: author }],
  ["missing", {}], ["malformed", { permission: true, user: author }],
  ["wrong author", { permission: "admin", user: { ...author, id: 999 } }],
  ["bot with write", { permission: "write", user: { ...author, type: "Bot" } }],
  ["contradictory", { permission: "write", user: { ...author, permissions: { push: false } } }],
  ...[401, 403, 404, 429, 500].map(status => [`HTTP ${status}`, new Response(token, { status })]),
  ["invalid JSON", new Response("not JSON")],
  ["network or timeout", new Error(`network leaked ${token}`)],
];

for (const [eventName, action] of surfaces) {
  for (const [name, permission] of denials) {
    test(`${eventName}.${action}: ${name} cannot dispatch or wake`, async () => {
      const payload = event(eventName, action);
      // Neither a writer sender, association, nor prose is permission evidence.
      payload.author_association = "OWNER";
      (payload.review || payload.comment).author_association = "OWNER";
      payload.permissions = { admin: true };
      const api = fixture(payload, permission);
      const args = { payload, eventName, repository, token, githubToken: token, fetchImpl: api.fetchImpl,
        runUrl: "https://github.com/example-org/example-repo/actions/runs/1" };
      const cadence = await routeCadenceReviewEvent(args);
      assert.equal(cadence.shouldRequestReview, false);
      assert.equal(cadence.authority.contentTrust, "untrusted");
      assert.doesNotMatch(JSON.stringify(cadence), new RegExp(token));
      if (eventName !== "pull_request_review_comment") {
        const handoff = await routeReviewHandoff(args);
        assert.equal(handoff.operation, "skipped");
        assert.equal(handoff.shouldMove, false);
        assert.equal(handoff.authority.contentTrust, "untrusted");
        assert.doesNotMatch(JSON.stringify(handoff), new RegExp(token));
      }
      assert.ok(api.calls.every(call => call.method === "GET" && call.url.startsWith(root)));
      assert.ok(api.calls.some(call => call.url.endsWith("/collaborators/writer/permission")));
    });
  }
  for (const [permission, role_name] of [["write", "write"], ["write", "maintain"], ["admin", "admin"], ["write", "custom-developer"]]) {
    test(`${eventName}.${action}: verified ${role_name} can request rework review`, async () => {
      const payload = event(eventName, action);
      const api = fixture(payload, { permission, role_name, user: author });
      const result = await routeCadenceReviewEvent({ payload, eventName, repository, token, fetchImpl: api.fetchImpl });
      assert.equal(result.shouldRequestReview, true);
      assert.equal(result.triggerActor, "writer");
      assert.equal(result.authority.authorId, 42);
    });
  }
  test(`${eventName}.${action}: replay rechecks permission after revocation`, async () => {
    const payload = event(eventName, action);
    const api = fixture(payload);
    const args = { payload, eventName, repository, token, fetchImpl: api.fetchImpl };
    assert.equal((await routeCadenceReviewEvent(args)).shouldRequestReview, true);
    api.permission = { permission: "read", user: author };
    assert.equal((await routeCadenceReviewEvent(args)).shouldRequestReview, false);
    assert.equal(api.calls.filter(call => call.url.endsWith("/permission")).length, 2);
  });
}

for (const [name, mutate] of [
  ["wrong event repo", (p) => { p.repository.full_name = "elsewhere/repo"; }],
  ["fork evidence", (p) => { p.pull_request.base.repo.full_name = "elsewhere/repo"; }],
  ["sender fallback", (p) => { delete p.review.user; }],
  ["bot edit of writer content", (p) => { p.sender = { login: "some-app[bot]", type: "Bot" }; }],
  ["forged author", (_p, a) => { a.current.user = { ...author, id: 123 }; }],
  ["wrong current parent", (_p, a) => { a.current.pull_request_url = "https://api.github.com/repos/elsewhere/repo/pulls/7"; }],
  ["old content", (_p, a) => { a.current.body = "Edited content"; }],
  ["old edit timestamp", (_p, a) => { a.current.updated_at = "2026-09-11T01:00:00Z"; }],
  ["old review state", (_p, a) => { a.current.state = "dismissed"; }],
  ["deleted event", (p) => { p.action = "deleted"; }],
]) {
  test(`${name} fails before permission lookup`, async () => {
    const payload = event("pull_request_review", "edited");
    const api = fixture(payload);
    mutate(payload, api);
    const result = await verifyReviewEventAuthority({ payload, eventName: "pull_request_review", repository, token, fetchImpl: api.fetchImpl });
    assert.equal(result.allowed, false);
    assert.equal(result.contentTrust, "untrusted");
    assert.ok(api.calls.every(call => !call.url.endsWith("/permission")));
  });
}

test("redirected permission evidence, PATs, missing tokens, and bots never establish authority", async () => {
  const args = { author, repository, token, fetchImpl: async () => ({ ok: true,
    url: "https://api.github.com/repos/elsewhere/repo/collaborators/writer/permission",
    json: async () => ({ permission: "admin", user: author }) }) };
  assert.equal((await verifyGitHubHumanWriteAccess(args)).reason, "github-authority-url-mismatch");
  for (const deniedToken of [undefined, "", "ghp_pat", "github_pat_other"]) {
    assert.equal((await verifyGitHubHumanWriteAccess({ ...args, token: deniedToken,
      fetchImpl: () => assert.fail("must not fetch") })).allowed, false);
  }
  for (const user of [{ ...author, type: "Bot" }, { ...author, login: "some-app[bot]" },
    { ...author, login: "example-cadence-bot" }, { login: "writer" }]) {
    assert.equal((await verifyGitHubHumanWriteAccess({ ...args, author: user,
      fetchImpl: () => assert.fail("must not fetch") })).allowed, false);
  }
});

test("later review context preserves untrusted content and rechecks access", async () => {
  const payload = event("pull_request_review", "submitted");
  const api = fixture(payload);
  const nodes = [{ id: "comment", body: "Please implement this", author: { login: "writer", __typename: "User", databaseId: 42 } }];
  const args = { repository, token, fetchImpl: api.fetchImpl };
  assert.equal((await markFeedbackAuthority(nodes, args))[0].authority.allowed, true);
  api.permission = { permission: "read", user: author };
  const [denied] = await markFeedbackAuthority(nodes, args);
  assert.equal(denied.body, nodes[0].body);
  assert.equal(denied.authority.contentTrust, "untrusted");
  assert.equal((await markFeedbackAuthority(nodes, { repository }))[0].authority.allowed, false);
});

test("current App-authorized writer feedback starts incremental review and resets human activity", async () => {
  const api = fixture(event("pull_request_review", "submitted"));
  const nodes = [
    { __typename: "PullRequestReview", author: { login: "example-cadence-bot" },
      state: "APPROVED", submittedAt: "2026-09-10T00:00:00Z", commit: { oid: "head" } },
    { __typename: "IssueComment", author: { login: "writer", __typename: "User", databaseId: 42 },
      createdAt: "2026-09-10T01:00:00Z" },
  ];
  for (const [credential, decision, count] of [[token, "incremental", 1], ["ghp_legacy", "skip", 0]]) {
    const result = classifyPrReviewState({ headRefOid: "head", isDraft: false,
      timelineItems: { pageInfo: { hasPreviousPage: false }, nodes: await markFeedbackAuthority(nodes, {
        repository, token: credential, fetchImpl: api.fetchImpl,
      }) } }, "example-cadence-bot");
    assert.equal(result.decision, decision);
    assert.equal(result.humanGroundedSince.length, count);
  }
});

test("timeline permission reads share identical authors only within one acquisition", async () => {
  const api = fixture(event("pull_request_review", "submitted"));
  const nodes = Array.from({ length: 60 }, () => ({ author: { login: "writer", __typename: "User", databaseId: 42 } }));
  const args = { repository, token, fetchImpl: api.fetchImpl };
  assert.ok((await markFeedbackAuthority(nodes, args)).every(node => node.authority.allowed));
  assert.equal(api.calls.length, 1);
  const changedId = { author: { ...nodes[0].author, databaseId: 999 } };
  assert.equal((await markFeedbackAuthority([nodes[0], changedId], args))[1].authority.allowed, false);
  assert.equal(api.calls.length, 3);
  api.permission = { permission: "read", user: author };
  assert.ok((await markFeedbackAuthority(nodes, args)).every(node => !node.authority.allowed));
  assert.equal(api.calls.length, 4);
});

test("bodyless changes-requested reviews accept GitHub null bodies but reject malformed bodies", async () => {
  for (const [body, currentBody, allowed] of [[null, null, true], ["", null, true], [null, "", true],
    ["Change design", null, false], [undefined, null, false], [null, {}, false]]) {
    const payload = event("pull_request_review", "submitted");
    payload.review.body = body;
    payload.review.state = "changes_requested";
    const api = fixture(payload);
    api.current.body = currentBody;
    const result = await routeCadenceReviewEvent({ payload, eventName: "pull_request_review", repository, token, fetchImpl: api.fetchImpl });
    assert.equal(result.shouldRequestReview, allowed);
  }
});

test("feedback routing jobs use trusted checkout and the existing App without a PAT fallback", () => {
  for (const name of ["cadence-linear-rework", "cadence-ai-review-events"]) {
    const workflow = readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8");
    assert.match(workflow, /ref: main/);
    assert.match(workflow, /persist-credentials: false/);
    assert.match(workflow, /environment: cadence-controller/);
    assert.match(workflow, /app-id: \$\{\{ vars.CADENCE_APP_ID \}\}/);
    assert.match(workflow, /permission-metadata: read/);
    const routeJob = yaml.load(workflow).jobs[name === 'cadence-ai-review-events' ? 'route' : 'review-handoff'];
    assert.doesNotMatch(JSON.stringify(routeJob), /CADENCE_BOT_GITHUB_TOKEN|permission-administration|permission-members|permission-issues/);
    assert.match(workflow, /GH_TOKEN: \$\{\{ steps.app-token.outputs.token \}\}/);
  }
});
