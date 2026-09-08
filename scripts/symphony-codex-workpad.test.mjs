import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCodexWorkpadBody,
  CODEX_WORKPAD_HEADING,
  isCodexWorkpadBody,
  loadToken,
  readWorkpadBody,
  upsertCodexWorkpad,
} from "./symphony-codex-workpad.mjs";

const sampleBody = [
  CODEX_WORKPAD_HEADING,
  "Last run: 2026-06-28T18:05:00Z",
  "",
  "Status: implementation checkpoint complete.",
  "",
  "## Proof Of Work",
  "",
  "Target ref:",
  "- `symphony/sample-workpad/DEMO-112/example@abc1234`",
  "",
].join("\n");

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

const withTimestamps = (comments) =>
  comments.map((comment, index) => ({
    createdAt: `2026-06-27T22:${String(index).padStart(2, "0")}:00Z`,
    updatedAt: `2026-06-27T22:${String(index).padStart(2, "0")}:00Z`,
    ...comment,
  }));

const makeLinearFetch = ({
  comments = [],
  pages,
  failCreate,
  failUpdate,
} = {}) => {
  const issue = {
    id: "issue-1",
    identifier: "DEMO-112",
    pages: (pages || [comments]).map(withTimestamps),
  };
  const created = [];
  const updated = [];
  const allComments = () => issue.pages.flat();

  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    if (request.query.includes("query CodexWorkpadIssue")) {
      const pageIndex = request.variables.after
        ? Number(request.variables.after)
        : 0;
      const hasNextPage = pageIndex < issue.pages.length - 1;
      return jsonResponse({
        data: {
          issue: {
            id: issue.id,
            identifier: issue.identifier,
            comments: {
              nodes: issue.pages[pageIndex],
              pageInfo: {
                hasNextPage,
                endCursor: hasNextPage ? String(pageIndex + 1) : null,
              },
            },
          },
        },
      });
    }

    if (request.query.includes("mutation CreateCodexWorkpad")) {
      if (failCreate) {
        return jsonResponse({ errors: [{ message: failCreate }] });
      }
      const comment = {
        id: `created-${created.length + 1}`,
        body: request.variables.body,
        createdAt: "2026-06-27T23:00:00Z",
        updatedAt: "2026-06-27T23:00:00Z",
      };
      issue.pages[0].push(comment);
      created.push({ issueId: request.variables.issueId, body: comment.body });
      return jsonResponse({
        data: { commentCreate: { success: true, comment: { id: comment.id } } },
      });
    }

    if (request.query.includes("mutation UpdateCodexWorkpad")) {
      if (failUpdate) {
        return jsonResponse({ errors: [{ message: failUpdate }] });
      }
      const comment = allComments().find(
        (candidate) => candidate.id === request.variables.commentId
      );
      comment.body = request.variables.body;
      updated.push({ commentId: comment.id, body: comment.body });
      return jsonResponse({
        data: { commentUpdate: { success: true, comment: { id: comment.id } } },
      });
    }

    throw new Error("Unexpected Linear request");
  };

  return { comments: allComments, created, updated, fetchImpl };
};

test("Codex workpad heading detection is strict to the durable owner heading", () => {
  assert.equal(isCodexWorkpadBody(sampleBody), true);
  assert.equal(isCodexWorkpadBody(`\n\n${sampleBody}`), true);
  assert.equal(isCodexWorkpadBody("## Cadence Workpad\n\nStatus: old"), false);
  assert.equal(
    isCodexWorkpadBody("## Codex Workpad Archive\n\nStatus: old"),
    false
  );
  assert.equal(
    isCodexWorkpadBody(" ## Codex Workpad\n\nStatus: indented"),
    false
  );
  assert.throws(
    () => assertCodexWorkpadBody("Status: missing heading"),
    /first non-blank line must be exactly ## Codex Workpad/
  );
});

test("upsertCodexWorkpad ignores similar Codex headings instead of updating them", async () => {
  const linear = makeLinearFetch({
    comments: [
      { id: "archive", body: "## Codex Workpad Archive\n\nStatus: old" },
      { id: "indented", body: " ## Codex Workpad\n\nStatus: old" },
    ],
  });

  const result = await upsertCodexWorkpad({
    issueIdentifier: "DEMO-112",
    body: sampleBody,
    token: "linear-token",
    fetchImpl: linear.fetchImpl,
  });

  assert.equal(result.operation, "created");
  assert.equal(linear.created.length, 1);
  assert.equal(linear.updated.length, 0);
  assert.equal(
    linear.comments().filter((comment) => isCodexWorkpadBody(comment.body))
      .length,
    1
  );
});

test("upsertCodexWorkpad creates a Codex workpad when only unrelated comments exist", async () => {
  const linear = makeLinearFetch({
    comments: [
      { id: "c1", body: "Unrelated implementation note" },
      { id: "cadence", body: "## Cadence Workpad\n\nStatus: reviewed" },
    ],
  });

  const result = await upsertCodexWorkpad({
    issueIdentifier: "DEMO-112",
    body: sampleBody,
    token: "linear-token",
    fetchImpl: linear.fetchImpl,
  });

  assert.equal(result.operation, "created");
  assert.equal(linear.created.length, 1);
  assert.equal(linear.updated.length, 0);
  assert.equal(
    linear.comments().filter((comment) => isCodexWorkpadBody(comment.body))
      .length,
    1
  );
});

test("upsertCodexWorkpad updates an existing paginated Codex workpad instead of appending a duplicate", async () => {
  const linear = makeLinearFetch({
    pages: [
      [{ id: "c1", body: "Unrelated implementation note" }],
      [{ id: "codex", body: "## Codex Workpad\n\nStatus: old" }],
    ],
  });

  const result = await upsertCodexWorkpad({
    issueIdentifier: "DEMO-112",
    body: sampleBody,
    token: "linear-token",
    fetchImpl: linear.fetchImpl,
  });

  assert.equal(result.operation, "updated");
  assert.deepEqual(
    linear.updated.map((call) => call.commentId),
    ["codex"]
  );
  assert.equal(linear.created.length, 0);
  assert.equal(
    linear.comments().filter((comment) => isCodexWorkpadBody(comment.body))
      .length,
    1
  );
});

test("upsertCodexWorkpad warns when multiple Codex workpads already exist", async () => {
  const warnings = [];
  const linear = makeLinearFetch({
    comments: [
      { id: "codex-old", body: "## Codex Workpad\n\nStatus: old" },
      { id: "codex-new", body: "## Codex Workpad\n\nStatus: duplicate" },
    ],
  });

  const result = await upsertCodexWorkpad({
    issueIdentifier: "DEMO-112",
    body: sampleBody,
    token: "linear-token",
    fetchImpl: linear.fetchImpl,
    logger: { warn: (message) => warnings.push(message) },
  });

  assert.equal(result.operation, "updated");
  assert.deepEqual(
    linear.updated.map((call) => call.commentId),
    ["codex-old"]
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Found 2 Codex Workpad comments/);
});

test("upsertCodexWorkpad does not touch Cadence Workpad comments", async () => {
  const cadenceBody = "## Cadence Workpad\n\nStatus: reviewed";
  const linear = makeLinearFetch({
    comments: [
      { id: "cadence", body: cadenceBody },
      { id: "codex", body: "## Codex Workpad\n\nStatus: old" },
    ],
  });

  await upsertCodexWorkpad({
    issueIdentifier: "DEMO-112",
    body: sampleBody,
    token: "linear-token",
    fetchImpl: linear.fetchImpl,
  });

  assert.equal(
    linear.comments().find((comment) => comment.id === "cadence").body,
    cadenceBody
  );
  assert.deepEqual(
    linear.updated.map((call) => call.commentId),
    ["codex"]
  );
});

test("loadToken accepts either Linear token environment variable", () => {
  assert.equal(loadToken({ LINEAR_API_TOKEN: "token-a" }), "token-a");
  assert.equal(loadToken({ LINEAR_API_KEY: "token-b" }), "token-b");
});

test("loadToken fails clearly when no Linear token is configured", () => {
  assert.throws(() => loadToken({}), /Set LINEAR_API_TOKEN or LINEAR_API_KEY/);
});

test("readWorkpadBody reads Markdown from stdin when path is -", () => {
  const input = readWorkpadBody("-", {
    readFile: (path, encoding) => {
      assert.equal(path, 0);
      assert.equal(encoding, "utf8");
      return sampleBody;
    },
  });

  assert.equal(input, sampleBody);
});

test("Linear API write errors mention missing write access without exposing the token", async () => {
  const linear = makeLinearFetch({
    comments: [{ id: "codex", body: "## Codex Workpad\n\nStatus: old" }],
    failUpdate: "secret-token cannot update this comment",
  });

  await assert.rejects(
    () =>
      upsertCodexWorkpad({
        issueIdentifier: "DEMO-112",
        body: sampleBody,
        token: "secret-token",
        fetchImpl: linear.fetchImpl,
      }),
    (error) => {
      assert.match(
        error.message,
        /permission to create and update Linear comments/
      );
      assert.doesNotMatch(error.message, /secret-token/);
      assert.match(error.message, /\[redacted\] cannot update this comment/);
      return true;
    }
  );
});
