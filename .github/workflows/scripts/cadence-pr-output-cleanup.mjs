#!/usr/bin/env node
// Probe and clean stale Cadence GitHub-visible PR output.
//
// Auth:  GH_TOKEN with the relevant GitHub comment/review permissions.
// Usage: node .github/workflows/scripts/cadence-pr-output-cleanup.mjs owner/repo <pr-number> <head-sha> <targets-json-file|->

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const API_BASE = "https://api.github.com";
const GRAPHQL_API = `${API_BASE}/graphql`;
const DEFAULT_MINIMIZE_CLASSIFIER = "OUTDATED";
const DEFAULT_RESOLUTION_REASON = "ADDRESSED";

const MINIMIZE_COMMENT_MUTATION = `mutation MinimizeCadencePrOutput($subjectId: ID!, $classifier: ReportedContentClassifiers!) {
  minimizeComment(input: { subjectId: $subjectId, classifier: $classifier }) {
    clientMutationId
    minimizedComment { isMinimized }
  }
}`;

const RESOLVE_REVIEW_THREAD_MUTATION = `mutation ResolveCadencePrOutputThread($threadId: ID!, $resolutionReason: PullRequestReviewThreadResolutionReason) {
  resolveReviewThread(input: { threadId: $threadId, resolutionReason: $resolutionReason }) {
    clientMutationId
    thread { isResolved }
  }
}`;

const parseResponsePayload = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const redact = (text, token) =>
  token ? String(text).split(token).join("[redacted]") : String(text);

const githubHeaders = (token) => ({
  accept: "application/vnd.github+json",
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
  "x-github-api-version": "2022-11-28",
});

const githubRestRequest = async ({
  token,
  method,
  path,
  body,
  fetchImpl = fetch,
}) => {
  const response = await fetchImpl(`${API_BASE}${path}`, {
    method,
    headers: githubHeaders(token),
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = parseResponsePayload(text);

  if (!response.ok) {
    const error = new Error(
      payload?.message ||
        text ||
        response.statusText ||
        `HTTP ${response.status}`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return { status: response.status, payload };
};

const githubGraphqlRequest = async ({
  token,
  query,
  variables,
  fetchImpl = fetch,
}) => {
  const response = await fetchImpl(GRAPHQL_API, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  const payload = parseResponsePayload(text);

  if (!response.ok || payload?.errors?.length) {
    const error = new Error(
      payload?.errors?.[0]?.message ||
        payload?.message ||
        text ||
        response.statusText ||
        `HTTP ${response.status}`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return { status: response.status, payload };
};

export const parseRepo = (repoSlug) => {
  const [owner, repo] = String(repoSlug || "").split("/");
  if (!owner || !repo) {
    throw new Error("Repository must be in owner/name form.");
  }
  return { owner, repo };
};

export const supersededBody = ({
  currentHeadSha,
  currentOutputUrl = "",
  workpadUrl = "",
} = {}) => {
  const lines = [
    `Superseded by Cadence output for current head \`${
      currentHeadSha || "unknown"
    }\`.`,
  ];
  if (currentOutputUrl) lines.push(`Current output: ${currentOutputUrl}`);
  if (workpadUrl) lines.push(`Detailed state: ${workpadUrl}`);
  if (!currentOutputUrl && !workpadUrl) {
    lines.push("Current output is recorded in the latest Cadence PR review.");
  }
  return `${lines.join("\n")}\n`;
};

export const isPermissionDeniedError = (error) =>
  [401, 403].includes(Number(error?.status)) ||
  /resource not accessible|permission|requires.*write|forbidden/i.test(
    error?.message || ""
  );

const targetLabel = (target = {}) =>
  [
    target.kind || "unknown",
    target.action || "unknown",
    target.id ? `id=${target.id}` : "",
    target.nodeId ? `nodeId=${target.nodeId}` : "",
  ]
    .filter(Boolean)
    .join(" ");

const limitation = ({ target, reason, message }) => ({
  status: "limitation",
  kind: target.kind,
  action: target.action,
  id: target.id,
  nodeId: target.nodeId,
  reason,
  message,
});

const cleaned = ({ target, method, path }) => ({
  status: "cleaned",
  kind: target.kind,
  action: target.action,
  id: target.id,
  nodeId: target.nodeId,
  method,
  path,
});

const planned = ({ target, method, path }) => ({
  status: "planned",
  kind: target.kind,
  action: target.action,
  id: target.id,
  nodeId: target.nodeId,
  method,
  path,
});

const apiErrorLimitation = ({ target, error, token }) =>
  limitation({
    target,
    reason: isPermissionDeniedError(error) ? "permission-denied" : "api-error",
    message: `${redact(error.message, token)}${
      error.status ? ` (HTTP ${error.status})` : ""
    }`,
  });

const bodyForTarget = (target, context) =>
  target.body ||
  supersededBody({
    currentHeadSha: context.currentHeadSha,
    currentOutputUrl: context.currentOutputUrl,
    workpadUrl: context.workpadUrl,
  });

const requireNumericId = (target) => {
  if (!Number.isInteger(Number(target.id)) || Number(target.id) <= 0) {
    return limitation({
      target,
      reason: "missing-rest-id",
      message: `${targetLabel(target)} needs a numeric REST id.`,
    });
  }
  return null;
};

const requireNodeId = (target) => {
  if (!target.nodeId) {
    return limitation({
      target,
      reason: "missing-node-id",
      message: `${targetLabel(target)} needs a GraphQL node id.`,
    });
  }
  return null;
};

const restTarget = async ({
  target,
  token,
  owner,
  repo,
  prNumber,
  currentHeadSha,
  currentOutputUrl,
  workpadUrl,
  fetchImpl,
  dryRun,
}) => {
  const missingId = requireNumericId(target);
  if (missingId) return missingId;

  const id = Number(target.id);
  let method;
  let path;
  if (target.kind === "issue-comment") {
    method = "PATCH";
    path = `/repos/${owner}/${repo}/issues/comments/${id}`;
  } else if (target.kind === "pull-request-review") {
    // Submitted reviews cannot be deleted; superseding one edits the body only.
    method = "PUT";
    path = `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${id}`;
  } else if (target.kind === "review-comment") {
    method = "PATCH";
    path = `/repos/${owner}/${repo}/pulls/comments/${id}`;
  } else {
    return limitation({
      target,
      reason: "unsupported-target-kind",
      message: `${targetLabel(target)} is not a REST cleanup target.`,
    });
  }

  if (dryRun) return planned({ target, method, path });

  await githubRestRequest({
    token,
    method,
    path,
    body: {
      body: bodyForTarget(target, {
        currentHeadSha,
        currentOutputUrl,
        workpadUrl,
      }),
    },
    fetchImpl,
  });
  return cleaned({ target, method, path });
};

const graphqlTarget = async ({ target, token, fetchImpl, dryRun }) => {
  const missingNodeId = requireNodeId(target);
  if (missingNodeId) return missingNodeId;

  if (target.action === "minimize") {
    const method = "GRAPHQL";
    const path = "minimizeComment";
    if (dryRun) return planned({ target, method, path });

    await githubGraphqlRequest({
      token,
      query: MINIMIZE_COMMENT_MUTATION,
      variables: {
        subjectId: target.nodeId,
        classifier: target.classifier || DEFAULT_MINIMIZE_CLASSIFIER,
      },
      fetchImpl,
    });
    return cleaned({ target, method, path });
  }

  if (target.action === "resolve") {
    const method = "GRAPHQL";
    const path = "resolveReviewThread";
    if (dryRun) return planned({ target, method, path });

    await githubGraphqlRequest({
      token,
      query: RESOLVE_REVIEW_THREAD_MUTATION,
      variables: {
        threadId: target.nodeId,
        resolutionReason: target.resolutionReason || DEFAULT_RESOLUTION_REASON,
      },
      fetchImpl,
    });
    return cleaned({ target, method, path });
  }

  return limitation({
    target,
    reason: "unsupported-cleanup-action",
    message: `${targetLabel(
      target
    )} must use action update, supersede, minimize, or resolve.`,
  });
};

export const cleanupPrOutputTarget = async ({
  target,
  token,
  owner,
  repo,
  prNumber,
  currentHeadSha,
  currentOutputUrl = "",
  workpadUrl = "",
  fetchImpl = fetch,
  dryRun = false,
}) => {
  if (!target || typeof target !== "object") {
    return limitation({
      target: { kind: "unknown", action: "unknown" },
      reason: "invalid-target",
      message: "Cleanup target must be an object.",
    });
  }
  if (!dryRun && !token) {
    throw new Error("GH_TOKEN is required to clean up Cadence PR output.");
  }

  const action = target.action || "supersede";
  const normalizedTarget = { ...target, action };

  try {
    if (action === "update" || action === "supersede") {
      return await restTarget({
        target: normalizedTarget,
        token,
        owner,
        repo,
        prNumber,
        currentHeadSha,
        currentOutputUrl,
        workpadUrl,
        fetchImpl,
        dryRun,
      });
    }
    return await graphqlTarget({
      target: normalizedTarget,
      token,
      fetchImpl,
      dryRun,
    });
  } catch (error) {
    return apiErrorLimitation({
      target: normalizedTarget,
      error,
      token,
    });
  }
};

export const cleanupCadencePrOutput = async ({
  token,
  owner,
  repo,
  prNumber,
  currentHeadSha,
  currentOutputUrl = "",
  workpadUrl = "",
  targets = [],
  fetchImpl = fetch,
  dryRun = false,
} = {}) => {
  if (!owner || !repo) {
    throw new Error("GitHub owner and repo are required.");
  }
  if (!Number.isInteger(Number(prNumber)) || Number(prNumber) <= 0) {
    throw new Error("PR number must be a positive integer.");
  }
  if (!currentHeadSha) {
    throw new Error("Current PR head SHA is required.");
  }
  if (!Array.isArray(targets)) {
    throw new Error("Cleanup targets must be an array.");
  }

  const results = [];
  for (const target of targets) {
    results.push(
      await cleanupPrOutputTarget({
        target,
        token,
        owner,
        repo,
        prNumber,
        currentHeadSha,
        currentOutputUrl,
        workpadUrl,
        fetchImpl,
        dryRun,
      })
    );
  }

  return {
    currentHeadSha,
    cleanedCount: results.filter((item) => item.status === "cleaned").length,
    plannedCount: results.filter((item) => item.status === "planned").length,
    limitationCount: results.filter((item) => item.status === "limitation")
      .length,
    results,
  };
};

export const readCleanupInput = (path, { readFile = readFileSync } = {}) => {
  const raw = path === "-" ? readFile(0, "utf8") : readFile(path, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? { targets: parsed } : parsed;
  } catch (error) {
    throw new Error(`Cleanup input is not valid JSON: ${error.message}`);
  }
};

const main = async () => {
  const [repoSlug, prNumber, currentHeadSha, inputPath] = process.argv.slice(2);
  if (!repoSlug || !prNumber || !currentHeadSha || !inputPath) {
    throw new Error(
      "Usage: node .github/workflows/scripts/cadence-pr-output-cleanup.mjs owner/repo <pr-number> <head-sha> <targets-json-file|->"
    );
  }

  const { owner, repo } = parseRepo(repoSlug);
  const input = readCleanupInput(inputPath);
  const result = await cleanupCadencePrOutput({
    ...input,
    owner,
    repo,
    prNumber,
    currentHeadSha,
    token: process.env.GH_TOKEN,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
