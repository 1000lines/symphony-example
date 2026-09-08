import { createHash } from "crypto";
import { parseDocument } from "yaml";

import { formatJsonOutput, JsonOutput, withSchemaVersion } from "./jsonOutput";
import {
  extractFencedBlocks,
  formatGraphEdgeId,
  formatRelationPayloadId,
  parsePlanDecisions,
  parseProjectGraphFromMarkdown,
  ProjectGraph,
  ProjectGraphEdge,
  ProjectPlanDecision,
  RelationPayload,
} from "./projectGraph";

export type ProjectManifestErrorCode =
  | "missing-manifest-block"
  | "multiple-manifest-blocks"
  | "malformed-manifest-yaml"
  | "invalid-manifest-schema"
  | "unsupported-v1-field"
  | "removed-manifest-field"
  | "invalid-project"
  | "invalid-defaults"
  | "invalid-node"
  | "duplicate-manifest-node"
  | "invalid-node-type"
  | "invalid-branch-declaration"
  | "invalid-pr-policy"
  | "invalid-node-reference"
  | "duplicate-manifest-edge"
  | "invalid-manifest-edge"
  | "graph-manifest-node-mismatch"
  | "graph-manifest-edge-mismatch"
  | "graph-node-type-mismatch"
  | "unknown-relation-key";

export class ProjectManifestError extends Error {
  constructor(
    readonly code: ProjectManifestErrorCode,
    message: string,
    readonly input: string
  ) {
    super(message);
    this.name = "ProjectManifestError";
  }
}

export type ProjectNodeType = string;
export type BranchBirth = string;
export type PrCreatePolicy = string;

export type ProjectManifestProject = {
  readonly code: string;
  readonly color: string;
  readonly baseBranch: string;
  readonly humanLead: string;
  readonly humanLeadGithub: string | null;
  readonly linearIssueLabels: readonly string[];
  readonly githubPrLabels: readonly string[];
};

export type ProjectManifestDefaults = {
  readonly initialState: string | null;
  readonly maturityLabel: string;
  readonly taskBranchBase: string | null;
  readonly taskPrBase: string | null;
  readonly taskPrDraft: boolean | null;
  readonly issueAssignee: string | null;
  readonly prAssignee: string | null;
  readonly edgeSemantics: string | null;
  readonly relationType: "blocks";
  readonly mutationPolicy: string | null;
};

export type ProjectBranchDeclaration = {
  readonly ref: string | null;
  readonly template: string | null;
  readonly base: string;
  readonly birth: BranchBirth;
};

export type ProjectPrPolicy = {
  readonly url: string | null;
  readonly create: PrCreatePolicy | null;
  readonly base: string;
  readonly draft: boolean | null;
  readonly labels: readonly string[];
};

export type ProjectManifestNode = {
  readonly id: string;
  readonly title: string;
  readonly type: ProjectNodeType;
  readonly payloadKey: string | null;
  readonly existingIssue: string | null;
  readonly issueId: string | null;
  readonly difficulty: string | null;
  readonly initialState: string | null;
  readonly labels: readonly string[];
  readonly branch: ProjectBranchDeclaration;
  readonly pr: ProjectPrPolicy;
};

export type ProjectManifest = {
  readonly schema: "symphony-dag-manifest/v1";
  readonly project: ProjectManifestProject;
  readonly defaults: ProjectManifestDefaults;
  readonly nodes: readonly ProjectManifestNode[];
  readonly edges: readonly ProjectGraphEdge[];
  readonly source: string;
  readonly sourceSha256: string;
};

export type ProjectPlan = {
  readonly graph: ProjectGraph;
  readonly manifest: ProjectManifest;
  readonly decisions: readonly ProjectPlanDecision[];
  readonly relationPayloads: readonly RelationPayload[];
  readonly expectedRelationPayloads: readonly RelationPayload[];
  readonly issuePayloadNodes: readonly ProjectManifestNode[];
};

type RawObject = { readonly [key: string]: unknown };

const MANIFEST_SCHEMA = "symphony-dag-manifest/v1";
const NODE_ID_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const PAYLOAD_KEY_PATTERN = /^[A-Z][A-Z0-9]*-[A-Z0-9][A-Z0-9-]*$/;
const BRANCH_REF_PATTERN = /^[A-Za-z0-9._/${}-]+$/;
const V1_DEFAULT_FIELDS = [
  "stack_policy",
  "leaf_branch_policy",
  "integration_branch_policy",
  "generated_join_pr_policy",
  "generated_join_linear_issue_policy",
] as const;
const REMOVED_PROJECT_FIELDS = ["integration_branch"] as const;
const REMOVED_DEFAULT_FIELDS = ["frontier_blocked_label"] as const;
const V1_NODE_FIELDS = [
  "stack_policy",
  "branch_base_exceptions",
  "materialized_by",
  "updated_by",
  "relation_policy",
  "feeders",
  "join_update_policy",
  "linear_issue",
] as const;

export function parseProjectManifestFromMarkdown(
  markdown: string
): ProjectManifest {
  const manifestBlocks = extractFencedBlocks(markdown).filter(
    (block) =>
      (block.language === "yaml" || block.language === "yml") &&
      /^\s*schema:\s*symphony-dag-manifest\/v1\s*$/m.test(block.body)
  );

  if (manifestBlocks.length === 0) {
    throw new ProjectManifestError(
      "missing-manifest-block",
      "Expected exactly one symphony-dag-manifest/v1 YAML block",
      markdown
    );
  }

  if (manifestBlocks.length > 1) {
    throw new ProjectManifestError(
      "multiple-manifest-blocks",
      "Expected exactly one symphony-dag-manifest/v1 YAML block",
      markdown
    );
  }

  return parseProjectManifest(manifestBlocks[0].body);
}

export function parseProjectManifest(source: string): ProjectManifest {
  const document = parseDocument(source, { strict: true });
  if (document.errors.length > 0) {
    throw new ProjectManifestError(
      "malformed-manifest-yaml",
      document.errors[0].message,
      source
    );
  }

  const raw = document.toJSON();
  if (!isObject(raw)) {
    throw new ProjectManifestError(
      "invalid-manifest-schema",
      "Manifest must be a YAML object",
      source
    );
  }

  if (raw.schema !== MANIFEST_SCHEMA) {
    throw new ProjectManifestError(
      "invalid-manifest-schema",
      "Manifest schema must be symphony-dag-manifest/v1",
      source
    );
  }

  const project = parseProject(raw.project, source);
  const defaults = parseDefaults(raw.defaults, source);
  const nodes = parseNodes(raw.nodes, source);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = parseManifestEdges(raw.edges, nodeIds, source);

  return {
    schema: MANIFEST_SCHEMA,
    project,
    defaults,
    nodes,
    edges,
    source,
    sourceSha256: createHash("sha256").update(source).digest("hex"),
  };
}

export function parseProjectPlan(markdown: string): ProjectPlan {
  const graph = parseProjectGraphFromMarkdown(markdown);
  const manifest = parseProjectManifestFromMarkdown(markdown);
  const decisions = parsePlanDecisions(markdown);

  validateGraphAgainstManifest(graph, manifest);

  const expectedRelationPayloads = expectedRelationPayloadsForPlan(manifest);
  const issuePayloadNodes = manifest.nodes.filter(
    (node) => node.payloadKey !== null && node.existingIssue === null
  );

  return {
    graph,
    manifest,
    decisions,
    relationPayloads: expectedRelationPayloads,
    expectedRelationPayloads,
    issuePayloadNodes,
  };
}

export function projectPlanToJsonOutput(plan: ProjectPlan): JsonOutput<{
  readonly project: ProjectManifestProject;
  readonly manifestSha256: string;
  readonly graph: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly nodes: readonly ProjectManifestNode[];
    readonly edges: readonly ProjectGraphEdge[];
  };
  readonly decisions: readonly ProjectPlanDecision[];
  readonly relationPayloads: readonly RelationPayload[];
}> {
  return withSchemaVersion({
    project: plan.manifest.project,
    manifestSha256: plan.manifest.sourceSha256,
    graph: {
      nodeCount: plan.graph.nodes.length,
      edgeCount: plan.graph.edges.length,
      nodes: plan.manifest.nodes,
      edges: plan.manifest.edges,
    },
    decisions: plan.decisions,
    relationPayloads: plan.relationPayloads,
  });
}

export function formatProjectPlanJson(plan: ProjectPlan): string {
  return formatJsonOutput(projectPlanToJsonOutput(plan));
}

function parseProject(input: unknown, source: string): ProjectManifestProject {
  if (!isObject(input)) {
    throw new ProjectManifestError(
      "invalid-project",
      "Manifest project must be an object",
      source
    );
  }

  assertNoFields(
    input,
    REMOVED_PROJECT_FIELDS,
    "project",
    "removed-manifest-field"
  );
  const requiredStrings = readRequiredStringFields(
    input,
    ["code", "color", "base_branch", "human_lead"] as const,
    "invalid-project",
    source
  );

  return {
    code: requiredStrings.code,
    color: requiredStrings.color,
    baseBranch: requiredStrings.base_branch,
    humanLead: requiredStrings.human_lead,
    humanLeadGithub: readOptionalString(input, "human_lead_github"),
    linearIssueLabels: readStringArray(
      input,
      "linear_issue_labels",
      "invalid-project",
      source
    ),
    githubPrLabels: readStringArray(
      input,
      "github_pr_labels",
      "invalid-project",
      source
    ),
  };
}

function parseDefaults(
  input: unknown,
  source: string
): ProjectManifestDefaults {
  if (!isObject(input)) {
    throw new ProjectManifestError(
      "invalid-defaults",
      "Manifest defaults must be an object",
      source
    );
  }

  assertNoFields(input, V1_DEFAULT_FIELDS, "defaults");
  assertNoFields(
    input,
    REMOVED_DEFAULT_FIELDS,
    "defaults",
    "removed-manifest-field"
  );
  const relationType = readOptionalString(input, "relation_type") ?? "blocks";
  if (relationType !== "blocks") {
    throw new ProjectManifestError(
      "invalid-defaults",
      "Manifest relation_type must be blocks",
      relationType
    );
  }

  return {
    initialState: readOptionalString(input, "initial_state"),
    maturityLabel: readRequiredString(
      input,
      "maturity_label",
      "invalid-defaults",
      source
    ),
    taskBranchBase: readOptionalString(input, "task_branch_base"),
    taskPrBase: readOptionalString(input, "task_pr_base"),
    taskPrDraft: readOptionalBoolean(input, "task_pr_draft"),
    issueAssignee: readOptionalString(input, "issue_assignee"),
    prAssignee: readOptionalString(input, "pr_assignee"),
    edgeSemantics: readOptionalString(input, "edge_semantics"),
    relationType,
    mutationPolicy: readOptionalString(input, "mutation_policy"),
  };
}

function parseNodes(
  input: unknown,
  source: string
): readonly ProjectManifestNode[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new ProjectManifestError(
      "invalid-node",
      "Manifest nodes must be a non-empty array",
      source
    );
  }

  const seenIds = new Set<string>();
  return input.map((entry) => {
    if (!isObject(entry)) {
      throw new ProjectManifestError(
        "invalid-node",
        "Manifest node must be an object",
        source
      );
    }

    assertNoFields(entry, V1_NODE_FIELDS, "node");

    const id = readRequiredString(entry, "id", "invalid-node", source);
    if (!NODE_ID_PATTERN.test(id)) {
      throw new ProjectManifestError(
        "invalid-node",
        `Invalid manifest node id: ${id}`,
        id
      );
    }

    if (seenIds.has(id)) {
      throw new ProjectManifestError(
        "duplicate-manifest-node",
        `Duplicate manifest node: ${id}`,
        id
      );
    }
    seenIds.add(id);

    const type = readNodeType(entry.type, source);
    const labels = readStringArray(entry, "labels", "invalid-node", source, {
      optional: true,
    });
    validateLabels(labels, id);

    const payloadKey = readOptionalString(entry, "payload_key");
    const existingIssue = readOptionalString(entry, "existing_issue");
    const issueId = readOptionalString(entry, "issue_id");
    validateNodeIssueIdentity({ id, payloadKey, existingIssue, issueId });

    return {
      id,
      title: readRequiredString(entry, "title", "invalid-node", source),
      type,
      payloadKey,
      existingIssue,
      issueId,
      difficulty: readOptionalString(entry, "difficulty"),
      initialState: readOptionalString(entry, "initial_state"),
      labels,
      branch: parseBranch(entry.branch, id, source),
      pr: parsePr(entry.pr, id, source),
    };
  });
}

function parseBranch(
  input: unknown,
  nodeId: string,
  source: string
): ProjectBranchDeclaration {
  if (!isObject(input)) {
    throw new ProjectManifestError(
      "invalid-branch-declaration",
      `Node ${nodeId} must declare a branch object`,
      nodeId
    );
  }
  assertNoFields(input, ["base_node"] as const, `node ${nodeId} branch`);

  const ref = readOptionalString(input, "ref");
  const template = readOptionalString(input, "template");
  const base = readRequiredString(
    input,
    "base",
    "invalid-branch-declaration",
    source
  );
  const birth = readRequiredString(
    input,
    "birth",
    "invalid-branch-declaration",
    source
  );

  if (
    (ref === null && template === null) ||
    (ref !== null && template !== null)
  ) {
    throw new ProjectManifestError(
      "invalid-branch-declaration",
      `Node ${nodeId} must declare exactly one branch ref or template`,
      nodeId
    );
  }

  for (const branchValue of [ref, template, base]) {
    if (branchValue !== null && !BRANCH_REF_PATTERN.test(branchValue)) {
      throw new ProjectManifestError(
        "invalid-branch-declaration",
        `Node ${nodeId} has an invalid branch declaration: ${branchValue}`,
        branchValue
      );
    }
  }

  return { ref, template, base, birth };
}

function parsePr(
  input: unknown,
  nodeId: string,
  source: string
): ProjectPrPolicy {
  if (!isObject(input)) {
    throw new ProjectManifestError(
      "invalid-pr-policy",
      `Node ${nodeId} must declare a PR policy object`,
      nodeId
    );
  }
  assertNoFields(
    input,
    ["base_node", "boilerplate"] as const,
    `node ${nodeId} pr`
  );

  const url = readOptionalString(input, "url");
  const create = readOptionalString(input, "create");
  if (url === null && create === null) {
    throw new ProjectManifestError(
      "invalid-pr-policy",
      `Node ${nodeId} must declare a PR url or create policy`,
      nodeId
    );
  }

  return {
    url,
    create,
    base: readRequiredString(input, "base", "invalid-pr-policy", source),
    draft: readOptionalBoolean(input, "draft"),
    labels: readStringArray(input, "labels", "invalid-pr-policy", source, {
      optional: true,
    }),
  };
}

function parseManifestEdges(
  input: unknown,
  nodeIds: ReadonlySet<string>,
  source: string
): readonly ProjectGraphEdge[] {
  if (!Array.isArray(input)) {
    throw new ProjectManifestError(
      "invalid-manifest-edge",
      "Manifest edges must be an array",
      source
    );
  }

  const seenEdges = new Set<string>();
  return input.map((entry) => {
    if (!isObject(entry)) {
      throw new ProjectManifestError(
        "invalid-manifest-edge",
        "Manifest edge must be an object",
        source
      );
    }

    const edge = {
      from: readRequiredString(entry, "from", "invalid-manifest-edge", source),
      to: readRequiredString(entry, "to", "invalid-manifest-edge", source),
    };
    const edgeId = formatGraphEdgeId(edge);

    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new ProjectManifestError(
        "invalid-manifest-edge",
        `Manifest edge references an unknown node: ${edgeId}`,
        edgeId
      );
    }

    if (seenEdges.has(edgeId)) {
      throw new ProjectManifestError(
        "duplicate-manifest-edge",
        `Duplicate manifest edge: ${edgeId}`,
        edgeId
      );
    }

    seenEdges.add(edgeId);
    return edge;
  });
}

function validateNodeIssueIdentity(options: {
  readonly id: string;
  readonly payloadKey: string | null;
  readonly existingIssue: string | null;
  readonly issueId: string | null;
}) {
  const { id, payloadKey, existingIssue, issueId } = options;
  if (payloadKey !== null && !PAYLOAD_KEY_PATTERN.test(payloadKey)) {
    throw new ProjectManifestError(
      "invalid-node",
      `Node ${id} has an invalid payload key: ${payloadKey}`,
      payloadKey
    );
  }

  if (existingIssue !== null && !PAYLOAD_KEY_PATTERN.test(existingIssue)) {
    throw new ProjectManifestError(
      "invalid-node",
      `Node ${id} has an invalid existing issue key: ${existingIssue}`,
      existingIssue
    );
  }

  if (payloadKey === null && existingIssue === null) {
    throw new ProjectManifestError(
      "invalid-node",
      `Node ${id} must declare a payload_key or existing_issue`,
      id
    );
  }

  if (issueId !== null && existingIssue === null) {
    throw new ProjectManifestError(
      "invalid-node",
      `Node ${id} can only declare issue_id with existing_issue`,
      id
    );
  }
}

function validateLabels(labels: readonly string[], nodeId: string) {
  const stackLabel = labels.find((label) => label.startsWith("stack:"));
  if (stackLabel) {
    throw new ProjectManifestError(
      "unsupported-v1-field",
      `Node ${nodeId} uses unsupported v1 stack label ${stackLabel}`,
      stackLabel
    );
  }
}

function validateGraphAgainstManifest(
  graph: ProjectGraph,
  manifest: ProjectManifest
) {
  const graphNodeIds = graph.nodes.map((node) => node.id);
  const manifestNodeIds = manifest.nodes.map((node) => node.id);
  assertSameSet(
    graphNodeIds,
    manifestNodeIds,
    "graph-manifest-node-mismatch",
    "Graph and manifest nodes do not match"
  );

  const graphEdges = graph.edges.map(formatGraphEdgeId);
  const manifestEdges = manifest.edges.map(formatGraphEdgeId);
  assertSameSet(
    graphEdges,
    manifestEdges,
    "graph-manifest-edge-mismatch",
    "Graph and manifest edges do not match"
  );

  const manifestNodesById = new Map(
    manifest.nodes.map((node) => [node.id, node])
  );
  for (const graphNode of graph.nodes) {
    const manifestNode = manifestNodesById.get(graphNode.id);
    if (
      manifestNode &&
      graphNode.typeHint !== null &&
      graphNode.typeHint !== manifestNode.type
    ) {
      throw new ProjectManifestError(
        "graph-node-type-mismatch",
        `Graph node ${graphNode.id} type hint does not match manifest type`,
        graphNode.id
      );
    }
  }
}

function expectedRelationPayloadsForPlan(
  manifest: ProjectManifest
): readonly RelationPayload[] {
  const nodesById = new Map(manifest.nodes.map((node) => [node.id, node]));
  const payloads = manifest.edges.map((edge) => {
    const fromNode = readManifestNode(nodesById, edge.from);
    const toNode = readManifestNode(nodesById, edge.to);
    const blockerKey = issueKeyForNode(fromNode);
    const blockedKey = issueKeyForNode(toNode);
    return {
      source: `${blockerKey} -> ${blockedKey}`,
      blockerKey,
      blockedKey,
      relation: "blocks" as const,
    };
  });

  const seenPayloads = new Set<string>();
  for (const payload of payloads) {
    const payloadId = formatRelationPayloadId(payload);
    if (seenPayloads.has(payloadId)) {
      throw new ProjectManifestError(
        "unknown-relation-key",
        `Duplicate relation payload: ${payloadId}`,
        payloadId
      );
    }
    seenPayloads.add(payloadId);
  }

  return payloads;
}

function issueKeyForNode(node: ProjectManifestNode): string {
  const issueKey = node.existingIssue ?? node.payloadKey;
  if (issueKey === null) {
    throw new ProjectManifestError(
      "unknown-relation-key",
      `Node ${node.id} has no Linear issue key`,
      node.id
    );
  }

  return issueKey;
}

function readManifestNode(
  nodesById: ReadonlyMap<string, ProjectManifestNode>,
  id: string
): ProjectManifestNode {
  const node = nodesById.get(id);
  if (!node) {
    throw new ProjectManifestError(
      "invalid-manifest-edge",
      `Unknown manifest node: ${id}`,
      id
    );
  }

  return node;
}

function assertSameSet(
  left: readonly string[],
  right: readonly string[],
  code: ProjectManifestErrorCode,
  message: string
) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const missingFromRight = left.filter((value) => !rightSet.has(value));
  const missingFromLeft = right.filter((value) => !leftSet.has(value));

  if (missingFromRight.length > 0 || missingFromLeft.length > 0) {
    throw new ProjectManifestError(
      code,
      `${message}: missing from manifest/right [${missingFromRight.join(
        ", "
      )}], missing from graph/left [${missingFromLeft.join(", ")}]`,
      [...missingFromRight, ...missingFromLeft].join(", ")
    );
  }
}

function readNodeType(input: unknown, source: string): ProjectNodeType {
  if (typeof input !== "string" || input.length === 0) {
    throw new ProjectManifestError(
      "invalid-node-type",
      `Invalid node type: ${String(input)}`,
      source
    );
  }

  if (input === "generated_join") {
    throw new ProjectManifestError(
      "unsupported-v1-field",
      "Generated join nodes are not part of the DAG v2 manifest profile",
      input
    );
  }

  return input;
}

function readRequiredString(
  input: RawObject,
  key: string,
  code: ProjectManifestErrorCode,
  source: string
): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ProjectManifestError(
      code,
      `Expected non-empty string for ${key}`,
      source
    );
  }

  return value;
}

function readRequiredStringFields<Key extends string>(
  input: RawObject,
  keys: readonly Key[],
  code: ProjectManifestErrorCode,
  source: string
): Record<Key, string> {
  return Object.fromEntries(
    keys.map((key) => [key, readRequiredString(input, key, code, source)])
  ) as Record<Key, string>;
}

function readOptionalString(input: RawObject, key: string): string | null {
  const value = input[key];
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ProjectManifestError(
      "invalid-manifest-schema",
      `Expected string for ${key}`,
      key
    );
  }

  return value;
}

function readOptionalBoolean(input: RawObject, key: string): boolean | null {
  const value = input[key];
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "boolean") {
    throw new ProjectManifestError(
      "invalid-manifest-schema",
      `Expected boolean for ${key}`,
      key
    );
  }

  return value;
}

function readStringArray(
  input: RawObject,
  key: string,
  code: ProjectManifestErrorCode,
  source: string,
  options: { readonly optional?: boolean } = {}
): readonly string[] {
  const value = input[key];
  if (value === undefined && options.optional) {
    return [];
  }

  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new ProjectManifestError(
      code,
      `Expected string array for ${key}`,
      source
    );
  }

  return value;
}

function assertNoFields(
  input: RawObject,
  fields: readonly string[],
  location: string,
  code:
    | "unsupported-v1-field"
    | "removed-manifest-field" = "unsupported-v1-field"
) {
  for (const field of fields) {
    if (input[field] !== undefined) {
      throw new ProjectManifestError(
        code,
        code === "removed-manifest-field"
          ? `${location} uses removed field ${field}; ` +
            "update and re-approve the plan for base-branch task PRs before fan-out"
          : `${location} uses unsupported v1 field ${field}`,
        field
      );
    }
  }
}

function isObject(input: unknown): input is RawObject {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
