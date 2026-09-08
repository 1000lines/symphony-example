#!/usr/bin/env node

import { fileURLToPath } from "node:url";

const ISSUE_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ISSUE_QUERY = `query SymphonyPrLabels($id: String!) {
  issue(id: $id) {
    identifier
    project { content description }
    attachments(first: 100) {
      nodes { url }
      pageInfo { hasNextPage }
    }
  }
}`;

function projectColor(project) {
  // The general metadata helpers select the first value. Repair must reject
  // conflicting declarations, including conflicts between content/description.
  const colors = [project?.content, project?.description]
    .filter(Boolean)
    .join("\n")
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = /^\s*(?:[-*]\s+)?project[-_]color:\s*(.*?)\s*$/i.exec(line);
      if (!match) return [];
      return [match[1].replace(/^([`"'])(.*)\1$/, "$2").toLowerCase()];
    });
  if (!colors.length) {
    throw new Error("Owning Linear project is missing project-color metadata.");
  }
  if (new Set(colors).size !== 1) {
    throw new Error(
      "Owning Linear project has ambiguous project-color metadata."
    );
  }
  if (!/^[a-z][a-z0-9-]*$/.test(colors[0])) {
    throw new Error(
      "Owning Linear project has invalid project-color metadata."
    );
  }
  return colors[0];
}

function associatedPr(issue, repository, pulls) {
  const attached = new Set();
  for (const { url } of issue.attachments.nodes) {
    const match =
      /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)(?:[/?#].*)?$/i.exec(
        url
      );
    if (match?.[1].toLowerCase() === repository.toLowerCase()) {
      attached.add(Number(match[2]));
    }
  }
  const candidates = pulls
    .map((pr) => ({
      pr,
      branchIssue: /^symphony\/[^/]+\/([A-Z][A-Z0-9]*-\d+)\/.+$/i
        .exec(pr.head?.ref)?.[1]
        ?.toUpperCase(),
      titleIssue: /^\[([A-Z][A-Z0-9]*-\d+)\]:/i
        .exec(pr.title)?.[1]
        ?.toUpperCase(),
    }))
    .filter(
      ({ pr, branchIssue, titleIssue }) =>
        attached.has(pr.number) ||
        branchIssue === issue.identifier ||
        titleIssue === issue.identifier
    );
  if (!candidates.length) return undefined;
  if (candidates.length !== 1) {
    throw new Error(
      "Ambiguous issue/PR association: multiple open PRs match the Linear issue."
    );
  }
  const { pr, branchIssue, titleIssue } = candidates[0];
  if (
    pr.base?.repo?.full_name?.toLowerCase() !== repository.toLowerCase() ||
    (branchIssue && branchIssue !== issue.identifier) ||
    (titleIssue && titleIssue !== issue.identifier) ||
    (!attached.has(pr.number) && branchIssue !== issue.identifier)
  ) {
    throw new Error(
      "Unverified or conflicting issue/PR association; refusing to edit labels."
    );
  }
  return pr;
}

export async function ensurePrLabels({
  issueIdentifier,
  repository,
  env = process.env,
  fetchImpl = fetch,
}) {
  if (!ISSUE_PATTERN.test(issueIdentifier || "")) {
    throw new Error(
      "A valid Linear issue identifier is required (--issue TEAM-123)."
    );
  }
  if (!REPOSITORY_PATTERN.test(repository || "")) {
    throw new Error(
      "An explicit GitHub repository is required (--repo OWNER/REPO)."
    );
  }
  const linearToken = env.LINEAR_API_TOKEN || env.LINEAR_API_KEY;
  const githubToken = env.GH_TOKEN || env.GITHUB_TOKEN;
  if (!linearToken || !githubToken) {
    throw new Error(
      "Linear and GitHub API tokens are required for PR label repair."
    );
  }

  // One deadline for the entire run, no retries, and bounded pagination. Leave
  // room for Symphony's existing hook timeout; errors retain best-effort semantics.
  const signal = AbortSignal.timeout(45_000);
  async function request(url, token, operation, body) {
    let response;
    try {
      response = await fetchImpl(url, {
        method: body ? "POST" : "GET",
        headers: { authorization: token, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal,
        redirect: "error",
      });
    } catch {
      throw new Error(`${operation}: API request failed or timed out.`);
    }
    if (!response.ok) {
      throw new Error(`${operation}: HTTP ${response.status}.`);
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`${operation}: invalid API JSON response.`);
    }
  }
  const github = (path, operation, body) =>
    request(
      `https://api.github.com/repos/${repository}/${path}`,
      `Bearer ${githubToken}`,
      operation,
      body
    );
  async function githubList(path, operation) {
    const items = [];
    for (let page = 1; page <= 10; page++) {
      const batch = await github(
        `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
        operation
      );
      if (!Array.isArray(batch))
        throw new Error(`${operation}: invalid API response.`);
      items.push(...batch);
      if (batch.length < 100) return items;
    }
    throw new Error(
      `${operation}: pagination limit exceeded; results are incomplete.`
    );
  }
  const payload = await request(
    "https://api.linear.app/graphql",
    linearToken,
    "Read Linear issue/project",
    { query: ISSUE_QUERY, variables: { id: issueIdentifier } }
  );
  if (payload?.errors?.length) {
    throw new Error(
      "Read Linear issue/project: GraphQL API errors (response details omitted)."
    );
  }
  const issue = payload?.data?.issue;
  if (
    issue?.identifier !== issueIdentifier ||
    !Array.isArray(issue.attachments?.nodes)
  ) {
    throw new Error(
      "Linear issue lookup is missing or does not match the requested issue."
    );
  }
  if (issue.attachments.pageInfo?.hasNextPage !== false) {
    throw new Error(
      "Linear attachments are incomplete; issue/PR association may be ambiguous."
    );
  }

  const pulls = await githubList("pulls?state=open", "List open PRs");
  const pr = associatedPr(issue, repository, pulls);
  if (!pr) return { issue: issueIdentifier, repository, result: "no-open-pr" };

  const required = [...new Set(["symphony", projectColor(issue.project)])];
  const labelsPath = `issues/${pr.number}/labels`;
  async function readLabels() {
    const labels = await githubList(labelsPath, "Read PR labels");
    if (labels.some((label) => typeof label.name !== "string")) {
      throw new Error("Read PR labels: invalid API response.");
    }
    return labels.map((label) => label.name.toLowerCase());
  }
  const before = await readLabels();
  const missing = required.filter((label) => !before.includes(label));
  for (const label of missing) {
    // Check all missing labels first so a nonexistent required label causes
    // no partial write and repair never needs to create repository labels.
    const existing = await github(
      `labels/${encodeURIComponent(label)}`,
      `Verify required label ${label} exists`
    );
    if (existing?.name?.toLowerCase() !== label) {
      throw new Error(
        `Verify required label ${label} exists: invalid API response.`
      );
    }
  }
  if (missing.length) {
    await github(labelsPath, "Add missing PR labels", { labels: missing });
  }
  const after = await readLabels();
  if (required.some((label) => !after.includes(label))) {
    throw new Error(
      "PR label readback failed: required symphony/project-color labels are missing."
    );
  }
  return {
    issue: issueIdentifier,
    repository,
    pr: pr.number,
    result: missing.length ? "repaired" : "already-correct",
    added: missing,
    verified: required,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--issue" || args[2] !== "--repo") {
    throw new Error(
      "Usage: node scripts/symphony/ensure-pr-labels.mjs --issue TEAM-123 --repo OWNER/REPO"
    );
  }
  console.info(
    JSON.stringify(
      await ensurePrLabels({ issueIdentifier: args[1], repository: args[3] })
    )
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Symphony PR label repair: ${error.message}`);
    process.exitCode = 1;
  });
}
