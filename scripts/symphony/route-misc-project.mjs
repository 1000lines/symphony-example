#!/usr/bin/env node

import { fileURLToPath } from "node:url";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const ROUTE_REASON = "eligible-demo-issue-without-project";

export const MISC_PROJECT_LOOKUP = Object.freeze({
  projectCode: "misc",
  projectColor: "blue",
  baseBranch: "main",
  activeStates: ["planned", "started", "in progress"],
  actorEmail: process.env.SYMPHONY_EXPECTED_LINEAR_EMAIL || "linear-bot@example.invalid",
});

const ROUTE_INPUT_QUERY = `query SymphonyMiscProjectRouteInput($issueId: String!, $activeProjectStates: [String!], $labelName: String!) {
  viewer { id name email }
  issue(id: $issueId) {
    id
    identifier
    title
    url
    team { key name }
    project { id name url }
    labels { nodes { id name } }
  }
  projects(first: 50, filter: { state: { in: $activeProjectStates } }) {
    nodes { id name url state content description }
    pageInfo { hasNextPage }
  }
  issueLabels(first: 20, filter: { name: { eqIgnoreCase: $labelName } }) {
    nodes { id name }
    pageInfo { hasNextPage }
  }
}`;

const TICKET_START_ROUTE_DECISION_QUERY = `query SymphonyMiscProjectTicketStartDecision($issueId: String!) {
  issue(id: $issueId) {
    id
    identifier
    title
    url
    project { id name url }
  }
}`;

const UPDATE_ISSUE_PROJECT_MUTATION = `mutation SymphonyMiscProjectRouteIssueUpdate($id: String!, $projectId: String!) {
  issueUpdate(id: $id, input: { projectId: $projectId }) {
    success
    issue { id identifier project { id name } }
  }
}`;

const ADD_ISSUE_LABEL_MUTATION = `mutation SymphonyMiscProjectRouteIssueLabelAdd($issueId: String!, $labelId: String!) {
  issueLabelAdd(input: { issueId: $issueId, labelId: $labelId }) {
    success
    issue { id identifier labels { nodes { id name } } }
  }
}`;

export function planMiscProjectRoute({
  issue,
  projects = [],
  issueLabels = [],
  actor,
  lookup = MISC_PROJECT_LOOKUP,
} = {}) {
  if (!issue || typeof issue !== "object") {
    throw new Error("Misc project routing requires a Linear issue object.");
  }

  const base = {
    issue: pickIssue(issue),
    previousProject: pickProject(issue.project),
    actor: actor ? pickActor(actor) : null,
    lookupSource: miscLookupSource(lookup),
  };

  if (!isDemoIssue(issue)) {
    return skippedPlan(base, "non-demo-issue");
  }
  if (issue.project) {
    return skippedPlan(base, "issue-already-has-project");
  }

  const project = resolveActiveMiscProject(projects, { issue, lookup });
  const labels = expectedLabelsFor(issue, issueLabels, project.projectColor);
  const mutationPayload = buildRouteMutationPayload({ issue, project, labels });

  return {
    ...base,
    action: "route",
    shouldMutate: true,
    dryRun: true,
    newProject: pickResolvedProject(project),
    labels,
    reason: ROUTE_REASON,
    mutationPayload,
    linearApiResult: {
      operation: "dry-run",
      success: true,
      mutations: mutationPayload.mutations.map((mutation) => mutation.name),
    },
  };
}

export function resolveActiveMiscProject(
  projects,
  { issue, lookup = MISC_PROJECT_LOOKUP } = {}
) {
  if (!Array.isArray(projects)) {
    throw new Error("Misc project lookup requires a projects array.");
  }

  const activeStates = new Set(lookup.activeStates.map(normalize));
  const lookupSource = miscLookupSource(lookup);
  const codeMatches = projects
    .map(parseLinearProjectMetadata)
    .filter((project) => project.projectCode === lookup.projectCode);
  const activeMatches = codeMatches.filter((project) =>
    activeStates.has(project.state)
  );

  if (activeMatches.length === 0) {
    const inactive = codeMatches
      .filter((project) => !activeStates.has(project.state))
      .map(formatProject)
      .join(", ");
    throw new Error(
      `Active misc project with project-code "${
        lookup.projectCode
      }" for ${issueName(
        issue
      )} was not found from lookup source "${lookupSource}".${
        inactive ? ` Matching inactive projects: ${inactive}.` : ""
      }`
    );
  }

  if (activeMatches.length > 1) {
    throw new Error(
      `Ambiguous active misc project metadata for ${issueName(
        issue
      )} from lookup source "${lookupSource}": ${activeMatches
        .map(formatProject)
        .join(", ")}.`
    );
  }

  const project = activeMatches[0];
  const problems = miscMetadataProblems(project, lookup);
  if (problems.length > 0) {
    throw new Error(
      `Active misc project metadata for ${issueName(
        issue
      )} does not match lookup source "${lookupSource}": ${problems.join(
        "; "
      )}.`
    );
  }

  return project;
}

export function parseLinearProjectMetadata(project) {
  const fields = metadataFields(
    [project.content, project.description].filter(Boolean).join("\n")
  );
  const projectColor = fields["project-color"]?.toLowerCase();
  const missingRequiredFields = [
    fields["project-code"] ? "" : "project-code",
    projectColor ? "" : "project-color",
  ].filter(Boolean);

  return {
    id: project.id,
    name: project.name || "",
    url: project.url,
    state: normalize(project.state),
    projectCode: fields["project-code"],
    projectColor,
    baseBranch: fields["base-branch"] || "main",
    humanLead: fields["human-lead"],
    missingRequiredFields,
  };
}

export function buildRouteMutationPayload({ issue, project, labels }) {
  const issueId = required(issue.id, "issue.id");
  const projectId = required(project.id, "project.id");
  const labelsToAdd = labels.filter((label) => label.operation === "add");

  return {
    issueUpdate: {
      id: issueId,
      input: { projectId },
    },
    issueLabelAdd: labelsToAdd.map((label) => ({
      input: { issueId, labelId: label.id },
    })),
    mutations: [
      { name: "issueUpdate", variables: { id: issueId, projectId } },
      ...labelsToAdd.map((label) => ({
        name: "issueLabelAdd",
        variables: { issueId, labelId: label.id },
      })),
    ],
  };
}

export async function readMiscProjectRoutingInput(
  issueId,
  {
    token,
    env = process.env,
    fetchImpl = fetch,
    linearApiUrl = LINEAR_API_URL,
    lookup = MISC_PROJECT_LOOKUP,
  } = {}
) {
  const linearToken = linearTokenFor(token, env, "read Linear routing input");
  const data = await linearRequest({
    query: ROUTE_INPUT_QUERY,
    variables: {
      issueId,
      activeProjectStates: lookup.activeStates,
      labelName: lookup.projectColor,
    },
    token: linearToken,
    operation: "read Linear routing input",
    fetchImpl,
    linearApiUrl,
  });

  if (!data.issue) {
    throw new Error(`Linear issue "${issueId}" was not found.`);
  }
  if (data.projects?.pageInfo?.hasNextPage) {
    throw new Error(
      `Linear returned more than 50 active projects while resolving project-code "${lookup.projectCode}"; misc project lookup is ambiguous.`
    );
  }
  if (data.issueLabels?.pageInfo?.hasNextPage) {
    throw new Error(
      `Linear returned more than 20 labels named "${lookup.projectColor}"; label lookup is ambiguous.`
    );
  }

  return {
    issue: data.issue,
    projects: data.projects?.nodes || [],
    issueLabels: data.issueLabels?.nodes || [],
    actor: data.viewer,
  };
}

export async function routeMiscProjectIssue(
  issueId,
  {
    dryRun = true,
    token,
    env = process.env,
    fetchImpl = fetch,
    linearApiUrl = LINEAR_API_URL,
    lookup = MISC_PROJECT_LOOKUP,
  } = {}
) {
  if (!issueId) {
    throw new Error("Missing required Linear issue identifier.");
  }

  const linearToken = linearTokenFor(token, env, "route a misc project issue");
  const input = await readMiscProjectRoutingInput(issueId, {
    token: linearToken,
    env,
    fetchImpl,
    linearApiUrl,
    lookup,
  });
  const plan = planMiscProjectRoute({ ...input, lookup });

  if (dryRun || !plan.shouldMutate) {
    return {
      ...plan,
      dryRun,
      linearApiResult: plan.shouldMutate
        ? plan.linearApiResult
        : { operation: "skipped", success: true },
    };
  }

  return {
    ...plan,
    dryRun: false,
    linearApiResult: await applyMiscProjectRoute({
      plan,
      token: linearToken,
      env,
      fetchImpl,
      linearApiUrl,
      lookup,
    }),
  };
}

export async function routeMiscProjectOnTicketStart(
  issueId,
  {
    token,
    env = process.env,
    fetchImpl = fetch,
    linearApiUrl = LINEAR_API_URL,
    lookup = MISC_PROJECT_LOOKUP,
    routeIssue = routeMiscProjectIssue,
  } = {}
) {
  if (!issueId) {
    throw new Error("Missing required Linear issue identifier.");
  }

  const linearToken = linearTokenFor(
    token,
    env,
    "read Linear ticket-start misc routing input"
  );
  const issue = await readTicketStartRouteDecision(issueId, {
    token: linearToken,
    fetchImpl,
    linearApiUrl,
  });

  if (issue.project) {
    return {
      ...skippedPlan(
        {
          issue: pickIssue(issue),
          previousProject: pickProject(issue.project),
          actor: null,
          lookupSource: miscLookupSource(lookup),
        },
        "issue-already-has-project"
      ),
      dryRun: false,
    };
  }

  return routeIssue(issue.identifier || issueId, {
    dryRun: false,
    token: linearToken,
    env,
    fetchImpl,
    linearApiUrl,
    lookup,
  });
}

export async function applyMiscProjectRoute({
  plan,
  token,
  env = process.env,
  fetchImpl = fetch,
  linearApiUrl = LINEAR_API_URL,
  lookup = MISC_PROJECT_LOOKUP,
} = {}) {
  const linearToken = linearTokenFor(
    token,
    env,
    "write Linear misc project routing"
  );
  if (!plan?.shouldMutate) {
    return { operation: "skipped", success: true };
  }
  if (plan.actor?.email !== lookup.actorEmail) {
    throw new Error(
      `Linear misc project writes require viewer ${lookup.actorEmail}; got ${
        plan.actor?.email || "unknown"
      }.`
    );
  }

  const mutations = [];
  const update = plan.mutationPayload.issueUpdate;
  const updateData = await linearRequest({
    query: UPDATE_ISSUE_PROJECT_MUTATION,
    variables: { id: update.id, projectId: update.input.projectId },
    token: linearToken,
    operation: "assign Linear issue to misc project",
    fetchImpl,
    linearApiUrl,
  });
  if (!updateData.issueUpdate?.success) {
    throw new Error(
      `Linear API did not assign ${plan.issue.identifier} to the misc project.`
    );
  }
  mutations.push({
    name: "issueUpdate",
    success: true,
    issueIdentifier: updateData.issueUpdate.issue?.identifier,
    projectName: updateData.issueUpdate.issue?.project?.name,
  });

  for (const labelAdd of plan.mutationPayload.issueLabelAdd) {
    const labelData = await linearRequest({
      query: ADD_ISSUE_LABEL_MUTATION,
      variables: labelAdd.input,
      token: linearToken,
      operation: "add misc project label to Linear issue",
      fetchImpl,
      linearApiUrl,
    });
    if (!labelData.issueLabelAdd?.success) {
      throw new Error(
        `Linear API did not add label ${labelAdd.input.labelId} to ${plan.issue.identifier}.`
      );
    }
    mutations.push({
      name: "issueLabelAdd",
      success: true,
      issueIdentifier: labelData.issueLabelAdd.issue?.identifier,
      labels: labelsOf(labelData.issueLabelAdd.issue),
    });
  }

  return { operation: "mutated", success: true, mutations };
}

async function readTicketStartRouteDecision(
  issueId,
  { token, fetchImpl, linearApiUrl }
) {
  const data = await linearRequest({
    query: TICKET_START_ROUTE_DECISION_QUERY,
    variables: { issueId },
    token,
    operation: "read Linear ticket-start misc routing input",
    fetchImpl,
    linearApiUrl,
  });

  if (!data.issue) {
    throw new Error(`Linear issue "${issueId}" was not found.`);
  }

  return data.issue;
}

function skippedPlan(base, reason) {
  return {
    ...base,
    action: "skipped",
    shouldMutate: false,
    dryRun: true,
    newProject: null,
    labels: [],
    mutationPayload: { issueUpdate: null, issueLabelAdd: [], mutations: [] },
    linearApiResult: { operation: "skipped", success: true },
    reason,
  };
}

function expectedLabelsFor(issue, issueLabels, labelName) {
  const currentLabels = new Set(labelsOf(issue).map(normalize));
  const matches = issueLabels.filter(
    (label) => normalize(label.name) === normalize(labelName)
  );

  if (matches.length === 0) {
    throw new Error(
      `Required Linear label "${labelName}" for ${issueName(
        issue
      )} was not found.`
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Required Linear label "${labelName}" for ${issueName(
        issue
      )} is ambiguous.`
    );
  }

  return [
    {
      id: required(matches[0].id, `label ${labelName}.id`),
      name: matches[0].name,
      operation: currentLabels.has(normalize(labelName)) ? "present" : "add",
    },
  ];
}

function miscMetadataProblems(project, lookup) {
  return [
    project.id ? "" : "missing Linear project id",
    ...project.missingRequiredFields.map((field) => `missing ${field}`),
    project.projectCode === lookup.projectCode
      ? ""
      : `project-code is ${value(project.projectCode)}, expected ${
          lookup.projectCode
        }`,
    project.projectColor === lookup.projectColor
      ? ""
      : `project-color is ${value(project.projectColor)}, expected ${
          lookup.projectColor
        }`,
    project.baseBranch === lookup.baseBranch
      ? ""
      : `base-branch is ${value(project.baseBranch)}, expected ${
          lookup.baseBranch
        }`,
  ].filter(Boolean);
}

function metadataFields(text) {
  const fields = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = /^\s*(?:[-*]\s*)?([A-Za-z][A-Za-z_-]*):\s*(.*?)\s*$/.exec(
      line
    );
    if (!match) {
      continue;
    }
    const key = match[1].toLowerCase().replaceAll("_", "-");
    if (
      ["project-code", "project-color", "base-branch", "human-lead"].includes(
        key
      )
    ) {
      fields[key] ??= clean(match[2]);
    }
  }
  return fields;
}

async function linearRequest({
  query,
  variables,
  token,
  operation,
  fetchImpl,
  linearApiUrl,
}) {
  const response = await fetchImpl(linearApiUrl, {
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
    throw new Error(
      `Linear API rejected ${operation}: ${JSON.stringify(
        payload?.errors || payload || { status: response.status }
      )
        .split(token)
        .join("[REDACTED_LINEAR_TOKEN]")}`
    );
  }
  if (!payload) {
    throw new Error(`Linear API returned invalid JSON for ${operation}.`);
  }
  return payload.data || {};
}

function isDemoIssue(issue) {
  return (
    /^DEMO-\d+$/.test(issue.identifier || "") ||
    normalize(issue.team?.key) === "demo"
  );
}

function labelsOf(issue) {
  const labels = Array.isArray(issue?.labels)
    ? issue.labels
    : issue?.labels?.nodes || [];
  return labels.map((label) =>
    typeof label === "string" ? label : label.name
  );
}

function pickIssue(issue) {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
  };
}

function pickProject(project) {
  return project
    ? { id: project.id, name: project.name, url: project.url }
    : null;
}

function pickResolvedProject(project) {
  return {
    ...pickProject(project),
    projectCode: project.projectCode,
    projectColor: project.projectColor,
    baseBranch: project.baseBranch,
  };
}

function pickActor(actor) {
  return { id: actor.id, name: actor.name, email: actor.email };
}

function formatProject(project) {
  return `${project.name || "project"}${
    project.id ? ` (${project.id})` : ""
  }: state=${project.state || "(none)"}, project-code=${value(
    project.projectCode
  )}, project-color=${value(project.projectColor)}, base-branch=${value(
    project.baseBranch
  )}`;
}

function miscLookupSource(lookup) {
  return `project-code:${lookup.projectCode || "(missing)"}`;
}

function linearTokenFor(token, env, operation) {
  const linearToken = token || env.LINEAR_API_TOKEN || env.LINEAR_API_KEY;
  if (!linearToken) {
    throw new Error(`Set LINEAR_API_TOKEN or LINEAR_API_KEY to ${operation}.`);
  }
  return linearToken;
}

function required(value, label) {
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function issueName(issue) {
  return issue?.identifier || "issue";
}

function value(input) {
  return input || "(missing)";
}

function clean(input) {
  return String(input || "")
    .trim()
    .replace(/^["'`]|["'`]$/g, "");
}

function normalize(input) {
  return clean(input).toLowerCase();
}

function readFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    console.info(HELP_TEXT);
    return;
  }
  if (args.includes("--apply") && args.includes("--dry-run")) {
    throw new Error("Use either --dry-run or --apply, not both.");
  }

  const issueId =
    readFlag(args, "--issue") || args.find((arg) => !arg.startsWith("--"));
  const result = await routeMiscProjectIssue(issueId, {
    dryRun: !args.includes("--apply"),
  });
  console.info(JSON.stringify(result, null, 2));
}

const HELP_TEXT = `
Usage:
  node scripts/symphony/route-misc-project.mjs --issue DEMO-123 --dry-run
  node scripts/symphony/route-misc-project.mjs --issue DEMO-123 --apply

Routes an eligible no-project DEMO issue to the active misc project. The helper
defaults to dry-run; --apply performs the Linear project assignment and missing
color-label write only when the Linear viewer is linear-bot@example.invalid.
`.trim();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
