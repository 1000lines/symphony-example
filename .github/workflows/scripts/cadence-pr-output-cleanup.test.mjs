import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanupCadencePrOutput,
  isPermissionDeniedError,
  parseRepo,
  readCleanupInput,
  supersededBody,
} from "./cadence-pr-output-cleanup.mjs";

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

const makeGitHubFetch = ({ deniedPath = "", graphqlErrors } = {}) => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    requests.push({ path, method: options.method || "GET", body });

    if (deniedPath && path.includes(deniedPath)) {
      return jsonResponse(
        { message: "secret-token cannot update this resource" },
        403
      );
    }

    if (path === "/graphql") {
      if (graphqlErrors) {
        return jsonResponse({ errors: graphqlErrors });
      }
      if (body.query.includes("minimizeComment")) {
        return jsonResponse({
          data: {
            minimizeComment: { minimizedComment: { isMinimized: true } },
          },
        });
      }
      if (body.query.includes("resolveReviewThread")) {
        return jsonResponse({
          data: { resolveReviewThread: { thread: { isResolved: true } } },
        });
      }
    }

    return jsonResponse({ ok: true });
  };
  return { requests, fetchImpl };
};

test("cleanupCadencePrOutput performs supported update, supersede, minimize, and resolve cleanup", async () => {
  const github = makeGitHubFetch();
  const result = await cleanupCadencePrOutput({
    token: "secret-token",
    owner: "example-org",
    repo: "example-repo",
    prNumber: 123,
    currentHeadSha: "abc1234",
    currentOutputUrl:
      "https://github.com/example-org/example-repo/pull/123#pullrequestreview-current",
    workpadUrl: "https://linear.app/example-workspace/issue/DEMO-123#comment-workpad",
    fetchImpl: github.fetchImpl,
    targets: [
      {
        kind: "issue-comment",
        action: "update",
        id: 101,
        body: "Current Cadence output is elsewhere.",
      },
      { kind: "pull-request-review", action: "supersede", id: 202 },
      { kind: "review-comment", action: "supersede", id: 303 },
      {
        kind: "minimizable-comment",
        action: "minimize",
        nodeId: "PRRC_node",
      },
      { kind: "review-thread", action: "resolve", nodeId: "PRRT_node" },
    ],
  });

  assert.equal(result.cleanedCount, 5);
  assert.equal(result.limitationCount, 0);
  assert.deepEqual(
    github.requests.map((request) => [request.method, request.path]),
    [
      ["PATCH", "/repos/example-org/example-repo/issues/comments/101"],
      ["PUT", "/repos/example-org/example-repo/pulls/123/reviews/202"],
      ["PATCH", "/repos/example-org/example-repo/pulls/comments/303"],
      ["POST", "/graphql"],
      ["POST", "/graphql"],
    ]
  );
  assert.equal(
    github.requests[0].body.body,
    "Current Cadence output is elsewhere."
  );
  assert.match(github.requests[1].body.body, /current head `abc1234`/);
  assert.match(
    github.requests[1].body.body,
    /pull\/123#pullrequestreview-current/
  );
  assert.match(github.requests[1].body.body, /#comment-workpad/);
  assert.equal(github.requests[3].body.variables.subjectId, "PRRC_node");
  assert.equal(github.requests[3].body.variables.classifier, "OUTDATED");
  assert.equal(github.requests[4].body.variables.threadId, "PRRT_node");
  assert.equal(github.requests[4].body.variables.resolutionReason, "ADDRESSED");
});

test("permission denial is recorded as a cleanup limitation without leaking the token", async () => {
  const github = makeGitHubFetch({ deniedPath: "/issues/comments/101" });
  const result = await cleanupCadencePrOutput({
    token: "secret-token",
    owner: "example-org",
    repo: "example-repo",
    prNumber: 123,
    currentHeadSha: "abc1234",
    fetchImpl: github.fetchImpl,
    targets: [{ kind: "issue-comment", action: "update", id: 101 }],
  });

  assert.equal(result.cleanedCount, 0);
  assert.equal(result.limitationCount, 1);
  assert.equal(result.results[0].status, "limitation");
  assert.equal(result.results[0].reason, "permission-denied");
  assert.doesNotMatch(result.results[0].message, /secret-token/);
  assert.match(result.results[0].message, /\[redacted\] cannot update/);
});

test("unsupported cleanup is recorded as a limitation without making an API call", async () => {
  const github = makeGitHubFetch();
  const result = await cleanupCadencePrOutput({
    token: "secret-token",
    owner: "example-org",
    repo: "example-repo",
    prNumber: 123,
    currentHeadSha: "abc1234",
    fetchImpl: github.fetchImpl,
    targets: [
      { kind: "minimizable-comment", action: "minimize" },
      { kind: "unknown", action: "supersede", id: 9 },
      { kind: "review-thread", action: "archive", nodeId: "PRRT_node" },
    ],
  });

  assert.equal(result.cleanedCount, 0);
  assert.equal(result.limitationCount, 3);
  assert.deepEqual(
    result.results.map((entry) => entry.reason),
    ["missing-node-id", "unsupported-target-kind", "unsupported-cleanup-action"]
  );
  assert.equal(github.requests.length, 0);
});

test("dry-run cleanup plans supported requests without requiring a token", async () => {
  const github = makeGitHubFetch();
  const result = await cleanupCadencePrOutput({
    owner: "example-org",
    repo: "example-repo",
    prNumber: 123,
    currentHeadSha: "abc1234",
    fetchImpl: github.fetchImpl,
    dryRun: true,
    targets: [{ kind: "issue-comment", action: "update", id: 101 }],
  });

  assert.equal(result.plannedCount, 1);
  assert.equal(result.cleanedCount, 0);
  assert.equal(github.requests.length, 0);
});

test("cleanup input helpers parse repo and target JSON", () => {
  assert.deepEqual(parseRepo("example-org/example-repo"), {
    owner: "example-org",
    repo: "example-repo",
  });
  assert.throws(() => parseRepo("missing-owner"), /owner\/name/);

  const arrayInput = readCleanupInput("-", {
    readFile: () => '[{"kind":"issue-comment","id":1}]',
  });
  assert.deepEqual(arrayInput, {
    targets: [{ kind: "issue-comment", id: 1 }],
  });

  const objectInput = readCleanupInput("-", {
    readFile: () => '{"dryRun":true,"targets":[]}',
  });
  assert.deepEqual(objectInput, { dryRun: true, targets: [] });
});

test("supersededBody keeps current head and output pointers concise", () => {
  const body = supersededBody({
    currentHeadSha: "abc1234",
    currentOutputUrl: "https://github.com/example/pr#review",
    workpadUrl: "https://linear.app/example#comment",
  });

  assert.match(
    body,
    /^Superseded by Cadence output for current head `abc1234`/
  );
  assert.match(body, /Current output:/);
  assert.match(body, /Detailed state:/);
});

test("isPermissionDeniedError recognizes GitHub permission failures", () => {
  assert.equal(
    isPermissionDeniedError({
      status: 403,
      message: "Resource not accessible",
    }),
    true
  );
  assert.equal(
    isPermissionDeniedError({ status: 404, message: "Not Found" }),
    false
  );
});
