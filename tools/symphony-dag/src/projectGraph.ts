export type ProjectGraphErrorCode =
  | "missing-mermaid-block"
  | "multiple-mermaid-blocks"
  | "malformed-mermaid"
  | "duplicate-graph-node"
  | "duplicate-graph-edge"
  | "unknown-graph-node"
  | "missing-relation-table"
  | "malformed-relation-row"
  | "duplicate-relation-payload"
  | "missing-decisions"
  | "malformed-decision-list";

export class ProjectGraphError extends Error {
  constructor(
    readonly code: ProjectGraphErrorCode,
    message: string,
    readonly input: string
  ) {
    super(message);
    this.name = "ProjectGraphError";
  }
}

export type ProjectGraphNodeTypeHint = string;

export type ProjectGraphNode = {
  readonly id: string;
  readonly label: string;
  readonly typeHint: ProjectGraphNodeTypeHint | null;
};

export type ProjectGraphEdge = {
  readonly from: string;
  readonly to: string;
};

export type ProjectGraph = {
  readonly schema: "symphony-dag/v1";
  readonly direction: string;
  readonly nodes: readonly ProjectGraphNode[];
  readonly edges: readonly ProjectGraphEdge[];
};

export type RelationPayload = {
  readonly source: string;
  readonly blockerKey: string;
  readonly blockedKey: string;
  readonly relation: "blocks";
};

export type ProjectPlanDecision = {
  readonly number: number;
  readonly title: string;
};

type FencedBlock = {
  readonly language: string;
  readonly body: string;
};

const DAG_SCHEMA_MARKER = "%% symphony-dag/v1";
const GRAPH_NODE_ID_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const GRAPH_NODE_ID_SOURCE = "[A-Z][A-Z0-9_]*";
const FLOWCHART_PATTERN = /^flowchart\s+([A-Z]{2})$/;
const EDGE_PATTERN = new RegExp(
  `^\\s*(${GRAPH_NODE_ID_SOURCE})\\s*-->\\s*(${GRAPH_NODE_ID_SOURCE})\\s*$`
);
const SQUARE_NODE_PATTERN = new RegExp(
  `^\\s*(${GRAPH_NODE_ID_SOURCE})\\s*\\["([^"]+)"\\]\\s*$`
);
const ROUND_NODE_PATTERN = new RegExp(
  `^\\s*(${GRAPH_NODE_ID_SOURCE})\\s*\\(\\("([^"]+)"\\)\\)\\s*$`
);
const RELATION_KEY_PATTERN = /^[A-Z0-9]+-[A-Z0-9][A-Z0-9-]*$/;
const DECISION_PATTERN = /^(\d+)\.\s+\*\*([^*]+)\*\*/;

export function parseProjectGraphFromMarkdown(markdown: string): ProjectGraph {
  const mermaidBlocks = extractFencedBlocks(markdown).filter(
    (block) =>
      block.language === "mermaid" && block.body.includes(DAG_SCHEMA_MARKER)
  );

  if (mermaidBlocks.length === 0) {
    throw new ProjectGraphError(
      "missing-mermaid-block",
      "Expected exactly one symphony-dag/v1 Mermaid block",
      markdown
    );
  }

  if (mermaidBlocks.length > 1) {
    throw new ProjectGraphError(
      "multiple-mermaid-blocks",
      "Expected exactly one symphony-dag/v1 Mermaid block",
      markdown
    );
  }

  return parseProjectGraph(mermaidBlocks[0].body);
}

export function parseProjectGraph(source: string): ProjectGraph {
  const lines = source.split(/\r?\n/);
  const meaningfulLines = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (meaningfulLines[0] !== DAG_SCHEMA_MARKER) {
    throw new ProjectGraphError(
      "malformed-mermaid",
      "Missing symphony-dag/v1 marker",
      source
    );
  }

  const flowchartMatch = FLOWCHART_PATTERN.exec(meaningfulLines[1] ?? "");
  if (!flowchartMatch) {
    throw new ProjectGraphError(
      "malformed-mermaid",
      "Missing Mermaid flowchart declaration",
      source
    );
  }

  const nodes: ProjectGraphNode[] = [];
  const edges: ProjectGraphEdge[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const line of meaningfulLines.slice(2)) {
    if (line.startsWith("%%")) {
      continue;
    }

    const edgeMatch = EDGE_PATTERN.exec(line);
    if (edgeMatch) {
      const edge = { from: edgeMatch[1], to: edgeMatch[2] };
      const edgeId = formatGraphEdgeId(edge);
      if (edgeIds.has(edgeId)) {
        throw new ProjectGraphError(
          "duplicate-graph-edge",
          `Duplicate graph edge: ${edgeId}`,
          line
        );
      }
      edgeIds.add(edgeId);
      edges.push(edge);
      continue;
    }

    const node = parseNodeLine(line);
    if (!node) {
      throw new ProjectGraphError(
        "malformed-mermaid",
        `Malformed Mermaid DAG line: ${line}`,
        line
      );
    }

    if (nodeIds.has(node.id)) {
      throw new ProjectGraphError(
        "duplicate-graph-node",
        `Duplicate graph node: ${node.id}`,
        line
      );
    }
    nodeIds.add(node.id);
    nodes.push(node);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new ProjectGraphError(
        "unknown-graph-node",
        `Graph edge references an unknown node: ${formatGraphEdgeId(edge)}`,
        formatGraphEdgeId(edge)
      );
    }
  }

  return {
    schema: "symphony-dag/v1",
    direction: flowchartMatch[1],
    nodes,
    edges,
  };
}

export function parseRelationPayloadTable(
  markdown: string
): readonly RelationPayload[] {
  const section = extractMarkdownSection(markdown, "Linear Relation Payloads");
  if (!section) {
    throw new ProjectGraphError(
      "missing-relation-table",
      "Missing Linear Relation Payloads section",
      markdown
    );
  }

  const rows: RelationPayload[] = [];
  const seenRows = new Set<string>();
  for (const line of section.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) {
      continue;
    }

    const cells = line
      .trim()
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length !== 4) {
      continue;
    }

    if (
      cells[0].startsWith("Source") ||
      cells.every((cell) => /^-+$/.test(cell))
    ) {
      continue;
    }

    const row = parseRelationPayloadRow(cells, line);
    const rowId = formatRelationPayloadId(row);
    if (seenRows.has(rowId)) {
      throw new ProjectGraphError(
        "duplicate-relation-payload",
        `Duplicate relation payload: ${rowId}`,
        line
      );
    }

    seenRows.add(rowId);
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new ProjectGraphError(
      "missing-relation-table",
      "Linear Relation Payloads table has no rows",
      section
    );
  }

  return rows;
}

export function parsePlanDecisions(
  markdown: string
): readonly ProjectPlanDecision[] {
  const section = extractMarkdownSection(markdown, "Decisions");
  if (!section) {
    throw new ProjectGraphError(
      "missing-decisions",
      "Missing Decisions section",
      markdown
    );
  }

  const numberedDecisions: ProjectPlanDecision[] = [];
  for (const line of section.split(/\r?\n/)) {
    const match = DECISION_PATTERN.exec(line);
    if (!match) {
      continue;
    }

    numberedDecisions.push({
      number: Number.parseInt(match[1], 10),
      title: match[2].replace(/\.$/, ""),
    });
  }

  if (numberedDecisions.length > 0) {
    numberedDecisions.forEach((decision, index) => {
      const expectedNumber = index + 1;
      if (decision.number !== expectedNumber) {
        throw new ProjectGraphError(
          "malformed-decision-list",
          `Expected decision ${expectedNumber}, found ${decision.number}`,
          section
        );
      }
    });

    return numberedDecisions;
  }

  const tableDecisions = parseDecisionTable(section);
  if (tableDecisions.length > 0) {
    return tableDecisions;
  }

  throw new ProjectGraphError(
    "missing-decisions",
    "Decisions section has no numbered decisions or decision table rows",
    section
  );
}

export function formatGraphEdgeId(edge: ProjectGraphEdge): string {
  return `${edge.from}->${edge.to}`;
}

export function formatRelationPayloadId(payload: {
  readonly blockerKey: string;
  readonly blockedKey: string;
  readonly relation: string;
}): string {
  return `${payload.blockerKey}->${payload.blockedKey}:${payload.relation}`;
}

export function extractFencedBlocks(markdown: string): readonly FencedBlock[] {
  const blocks: FencedBlock[] = [];
  const fencePattern = /^```([A-Za-z0-9_-]*)\s*$/;
  const lines = markdown.split(/\r?\n/);

  let language: string | null = null;
  let bodyLines: string[] = [];

  for (const line of lines) {
    if (language === null) {
      const match = fencePattern.exec(line.trim());
      if (match) {
        language = match[1].toLowerCase();
        bodyLines = [];
      }
      continue;
    }

    if (line.trim() === "```") {
      blocks.push({ language, body: bodyLines.join("\n") });
      language = null;
      bodyLines = [];
      continue;
    }

    bodyLines.push(line);
  }

  return blocks;
}

function parseNodeLine(line: string): ProjectGraphNode | null {
  const match = SQUARE_NODE_PATTERN.exec(line) ?? ROUND_NODE_PATTERN.exec(line);
  if (!match) {
    return null;
  }

  const id = match[1];
  if (!GRAPH_NODE_ID_PATTERN.test(id)) {
    return null;
  }

  const label = match[2];
  return {
    id,
    label,
    typeHint: parseNodeTypeHint(label),
  };
}

function parseNodeTypeHint(label: string): ProjectGraphNodeTypeHint | null {
  const match = /^[^:]+?\s+([a-z][a-z0-9_-]*):\s+/.exec(label);
  if (!match) {
    return null;
  }

  return match[1] as ProjectGraphNodeTypeHint;
}

function parseRelationPayloadRow(
  cells: readonly string[],
  input: string
): RelationPayload {
  const [sourceCell, blockerCell, blockedCell, relationCell] = cells;
  const blockerKey = unwrapCodeCell(blockerCell);
  const blockedKey = unwrapCodeCell(blockedCell);
  const relation = unwrapCodeCell(relationCell);

  if (
    sourceCell.length === 0 ||
    !RELATION_KEY_PATTERN.test(blockerKey) ||
    !RELATION_KEY_PATTERN.test(blockedKey) ||
    relation !== "blocks"
  ) {
    throw new ProjectGraphError(
      "malformed-relation-row",
      `Malformed relation payload row: ${input}`,
      input
    );
  }

  return {
    source: unwrapCodeCell(sourceCell),
    blockerKey,
    blockedKey,
    relation,
  };
}

function unwrapCodeCell(cell: string): string {
  const match = /^`([^`]+)`$/.exec(cell);
  return match ? match[1] : cell;
}

function parseDecisionTable(section: string): readonly ProjectPlanDecision[] {
  const decisions: ProjectPlanDecision[] = [];
  for (const line of section.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) {
      continue;
    }

    const cells = line
      .trim()
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (
      cells.length === 0 ||
      cells[0] === "Decision" ||
      cells.every((cell) => /^-+$/.test(cell))
    ) {
      continue;
    }

    decisions.push({
      number: decisions.length + 1,
      title: stripMarkdown(cells[0]).replace(/\.$/, ""),
    });
  }

  return decisions;
}

function stripMarkdown(input: string): string {
  return input.replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
}

function extractMarkdownSection(
  markdown: string,
  heading: string
): string | null {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`);
  const nextHeadingPattern = /^##\s+/;
  const start = lines.findIndex((line) => headingPattern.test(line));

  if (start === -1) {
    return null;
  }

  const bodyLines: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (nextHeadingPattern.test(line)) {
      break;
    }

    bodyLines.push(line);
  }

  return bodyLines.join("\n");
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
