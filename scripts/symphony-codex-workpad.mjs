#!/usr/bin/env node
// Create or update Symphony's single Linear issue workpad comment.
//
// Auth:   LINEAR_API_TOKEN or LINEAR_API_KEY with comment create/update access.
// Usage:  node scripts/symphony-codex-workpad.mjs <issue-identifier> <workpad-md-file>
//         node scripts/symphony-codex-workpad.mjs DEMO-112 -

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const API_URL = "https://api.linear.app/graphql";

export const CODEX_WORKPAD_HEADING = "## Codex Workpad";

const ISSUE_COMMENTS_QUERY = `query CodexWorkpadIssue($id: String!, $after: String) {
  issue(id: $id) {
    id
    identifier
    comments(first: 100, after: $after) {
      nodes { id body createdAt updatedAt }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

const CREATE_COMMENT_MUTATION = `mutation CreateCodexWorkpad($issueId: String!, $body: String!) {
  commentCreate(input: { issueId: $issueId, body: $body }) {
    success
    comment { id }
  }
}`;

const UPDATE_COMMENT_MUTATION = `mutation UpdateCodexWorkpad($commentId: String!, $body: String!) {
  commentUpdate(id: $commentId, input: { body: $body }) {
    success
    comment { id }
  }
}`;

const inline = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const firstNonBlankLine = (body) =>
  typeof body === "string"
    ? body.split(/\r?\n/).find((line) => line.trim() !== "") || ""
    : "";

export const isCodexWorkpadBody = (body) =>
  firstNonBlankLine(body) === CODEX_WORKPAD_HEADING;

export const assertCodexWorkpadBody = (body) => {
  if (!isCodexWorkpadBody(body)) {
    throw new Error(
      "Codex workpad body's first non-blank line must be exactly ## Codex Workpad."
    );
  }
  return body;
};

export const findCodexWorkpadComments = (comments = []) =>
  comments
    .filter((comment) => isCodexWorkpadBody(comment.body))
    .sort(
      (a, b) =>
        inline(a.createdAt).localeCompare(inline(b.createdAt)) ||
        inline(a.id).localeCompare(inline(b.id))
    );

export const findCodexWorkpadComment = (comments = []) =>
  findCodexWorkpadComments(comments)[0];

export const loadToken = (env = process.env) => {
  const token = env.LINEAR_API_TOKEN || env.LINEAR_API_KEY;
  if (!token) {
    throw new Error(
      "Set LINEAR_API_TOKEN or LINEAR_API_KEY to a Linear API token with permission to create and update Linear comments."
    );
  }
  return token;
};

const redact = (text, token) =>
  token ? String(text).split(token).join("[redacted]") : String(text);

const linearError = ({ operation, response, payload, token }) => {
  const detail = payload
    ? JSON.stringify(payload.errors || payload)
    : `HTTP ${response.status}`;
  const writeHint = /create|update/.test(operation)
    ? " Confirm LINEAR_API_TOKEN or LINEAR_API_KEY has permission to create and update Linear comments."
    : "";
  return new Error(
    `Linear API rejected ${operation}.${writeHint} Details: ${redact(
      detail,
      token
    )}`
  );
};

const linearRequest = async ({
  query,
  variables,
  token,
  operation,
  fetchImpl = fetch,
}) => {
  const response = await fetchImpl(API_URL, {
    method: "POST",
    headers: { authorization: token, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok || payload?.errors?.length) {
    throw linearError({ operation, response, payload, token });
  }
  if (!payload) {
    throw linearError({
      operation,
      response,
      payload: { error: "Response body was not valid JSON." },
      token,
    });
  }
  return payload.data;
};

export const fetchIssueComments = async (
  issueIdentifier,
  token,
  { fetchImpl = fetch } = {}
) => {
  const comments = [];
  let issue;
  let after;

  do {
    const data = await linearRequest({
      query: ISSUE_COMMENTS_QUERY,
      variables: { id: issueIdentifier, after },
      token,
      operation: "read issue comments",
      fetchImpl,
    });
    if (!data.issue) {
      throw new Error(`Linear issue "${issueIdentifier}" was not found.`);
    }
    issue = data.issue;
    comments.push(...(issue.comments?.nodes || []));
    after = issue.comments?.pageInfo?.hasNextPage
      ? issue.comments.pageInfo.endCursor
      : undefined;
  } while (after);

  return { id: issue.id, identifier: issue.identifier, comments };
};

const createComment = async (
  issueId,
  body,
  token,
  { fetchImpl = fetch } = {}
) => {
  const data = await linearRequest({
    query: CREATE_COMMENT_MUTATION,
    variables: { issueId, body },
    token,
    operation: "create Codex workpad comment",
    fetchImpl,
  });
  const result = data.commentCreate;
  if (!result?.success || !result.comment?.id) {
    throw new Error(
      "Linear API did not create the Codex workpad comment. Confirm LINEAR_API_TOKEN or LINEAR_API_KEY has permission to create Linear comments."
    );
  }
  return result.comment;
};

const updateComment = async (
  commentId,
  body,
  token,
  { fetchImpl = fetch } = {}
) => {
  const data = await linearRequest({
    query: UPDATE_COMMENT_MUTATION,
    variables: { commentId, body },
    token,
    operation: "update Codex workpad comment",
    fetchImpl,
  });
  const result = data.commentUpdate;
  if (!result?.success || !result.comment?.id) {
    throw new Error(
      "Linear API did not update the Codex workpad comment. Confirm LINEAR_API_TOKEN or LINEAR_API_KEY has permission to update Linear comments."
    );
  }
  return result.comment;
};

export const upsertCodexWorkpad = async ({
  issueIdentifier,
  body,
  token,
  fetchImpl = fetch,
  logger = console,
}) => {
  if (!issueIdentifier) {
    throw new Error("A Linear issue identifier is required.");
  }

  assertCodexWorkpadBody(body);

  const issue = await fetchIssueComments(issueIdentifier, token, { fetchImpl });
  const codexWorkpads = findCodexWorkpadComments(issue.comments);
  const existing = codexWorkpads[0];
  if (codexWorkpads.length > 1) {
    logger?.warn?.(
      `Found ${codexWorkpads.length} Codex Workpad comments on ${issue.identifier}; updating the oldest (${existing.id}) and leaving duplicates for human cleanup.`
    );
  }

  if (existing) {
    const comment = await updateComment(existing.id, body, token, {
      fetchImpl,
    });
    return {
      operation: "updated",
      issueId: issue.id,
      issueIdentifier: issue.identifier,
      commentId: comment.id,
      body,
    };
  }

  const comment = await createComment(issue.id, body, token, { fetchImpl });
  return {
    operation: "created",
    issueId: issue.id,
    issueIdentifier: issue.identifier,
    commentId: comment.id,
    body,
  };
};

export const readWorkpadBody = (path, { readFile = readFileSync } = {}) =>
  assertCodexWorkpadBody(
    path === "-" ? readFile(0, "utf8") : readFile(path, "utf8")
  );

const main = async () => {
  const [issueIdentifier, inputPath] = process.argv.slice(2);
  if (!issueIdentifier || !inputPath) {
    throw new Error(
      "Usage: node scripts/symphony-codex-workpad.mjs <issue-identifier> <workpad-md-file|->"
    );
  }

  const result = await upsertCodexWorkpad({
    issueIdentifier,
    body: readWorkpadBody(inputPath),
    token: loadToken(),
  });
  process.stdout.write(
    `${result.operation} Codex Workpad comment ${result.commentId} on ${result.issueIdentifier}\n`
  );
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
