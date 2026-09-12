import fs from "node:fs";
import path from "node:path";

export const SYMPHONY_PROJECT_COLORS = [
  "pink",
  "cyan",
  "blue",
  "green",
  "orange",
  "red",
  "yellow",
  "purple",
  "teal",
  "magenta",
  "indigo",
  "navy",
  "lavender",
  "burgundy",
  "coral",
  "peach",
  "amber",
  "gold",
  "lime",
  "olive",
  "mint",
  "forest",
  "brown",
  "slate",
] as const;

export type SymphonyProjectColor = (typeof SYMPHONY_PROJECT_COLORS)[number];

// Hex per color, matching the Linear color-lane label colors (the source of
// truth for a project's icon). Typed as Record<SymphonyProjectColor, string> so
// adding a color above without a hex here fails the typecheck.
export const SYMPHONY_PROJECT_COLOR_HEX: Record<SymphonyProjectColor, string> =
  {
    pink: "#ff69b4",
    cyan: "#00bcd4",
    blue: "#4ea7fc",
    green: "#2ea44f",
    orange: "#f97316",
    red: "#d73a4a",
    yellow: "#ffd33d",
    purple: "#8250df",
    teal: "#14b8a6",
    magenta: "#c026d3",
    indigo: "#4338ca",
    navy: "#1e3a8a",
    lavender: "#a78bfa",
    burgundy: "#881337",
    coral: "#fb7185",
    peach: "#fdba74",
    amber: "#d97706",
    gold: "#b59b00",
    lime: "#84cc16",
    olive: "#6b7c32",
    mint: "#6ee7b7",
    forest: "#166534",
    brown: "#92400e",
    slate: "#64748b",
  };

export const DEFAULT_ACTIVE_LINEAR_PROJECT_STATES = [
  "planned",
  "started",
  "in progress",
] as const;

export type LinearProjectInput = {
  name?: string | null;
  state?: string | null;
  url?: string | null;
  content?: string | null;
  description?: string | null;
};

export type ParsedProjectMetadata = {
  projectCode?: string;
  projectColor?: string;
  baseBranch: string;
  humanLead?: string;
  projectState: string;
  projectUrl?: string;
  projectName?: string;
  missingRequiredFields: MetadataField[];
};

export type MetadataField = "project-code" | "project-color" | "human-lead";

export type ProjectColorProblem =
  | {
      type: "missing-metadata";
      project: ParsedProjectMetadata;
      missingFields: MetadataField[];
    }
  | {
      type: "unknown-color";
      project: ParsedProjectMetadata;
      color: string;
    }
  | {
      type: "duplicate-active-color";
      color: SymphonyProjectColor;
      projects: ParsedProjectMetadata[];
    };

export type ProjectColorAudit = {
  supportedColors: readonly SymphonyProjectColor[];
  activeProjects: ParsedProjectMetadata[];
  inactiveProjects: ParsedProjectMetadata[];
  usedColors: SymphonyProjectColor[];
  problems: ProjectColorProblem[];
};

export type ProjectColorSelection =
  | {
      available: true;
      color: SymphonyProjectColor;
      audit: ProjectColorAudit;
    }
  | {
      available: false;
      reason: string;
      audit: ProjectColorAudit;
    };

export type ProjectColorOptions = {
  activeStates?: readonly string[];
};

type MetadataBlock = {
  projectCode?: string;
  projectColor?: string;
  baseBranch?: string;
  humanLead?: string;
  projectUrl?: string;
};

const METADATA_KEY_MAP: Record<string, keyof MetadataBlock> = {
  "project-code": "projectCode",
  project_code: "projectCode",
  "project-color": "projectColor",
  project_color: "projectColor",
  "base-branch": "baseBranch",
  base_branch: "baseBranch",
  "human-lead": "humanLead",
  human_lead: "humanLead",
  "project-url": "projectUrl",
  project_url: "projectUrl",
};

export function isSymphonyProjectColor(
  color: string
): color is SymphonyProjectColor {
  return (SYMPHONY_PROJECT_COLORS as readonly string[]).includes(color);
}

export function parseProjectMetadataBlock(text: string): MetadataBlock {
  const block: MetadataBlock = {};

  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:[-*]\s*)?([A-Za-z][A-Za-z_-]*):\s*(.*?)\s*$/.exec(
      line
    );
    if (!match) {
      continue;
    }

    const field = METADATA_KEY_MAP[match[1].toLowerCase()];
    if (!field || block[field] !== undefined) {
      continue;
    }

    block[field] = cleanMetadataValue(match[2]);
  }

  return block;
}

export function parseLinearProjectMetadata(
  project: LinearProjectInput
): ParsedProjectMetadata {
  const block = parseProjectMetadataBlock(
    [project.content, project.description].filter(Boolean).join("\n")
  );
  const projectColor = block.projectColor?.toLowerCase();
  const missingRequiredFields: MetadataField[] = [];

  if (!block.projectCode) {
    missingRequiredFields.push("project-code");
  }
  if (!projectColor) {
    missingRequiredFields.push("project-color");
  }
  if (!block.humanLead) {
    missingRequiredFields.push("human-lead");
  }

  return {
    projectCode: block.projectCode,
    projectColor,
    baseBranch: block.baseBranch || "main",
    humanLead: block.humanLead,
    projectState: normalizeState(project.state),
    projectUrl: project.url || block.projectUrl,
    projectName: project.name || undefined,
    missingRequiredFields,
  };
}

export function auditProjectColorAvailability(
  projects: readonly LinearProjectInput[],
  options: ProjectColorOptions = {}
): ProjectColorAudit {
  const activeStates = normalizeActiveStates(options.activeStates);
  const parsedProjects = projects.map(parseLinearProjectMetadata);
  const activeProjects = parsedProjects.filter((project) =>
    activeStates.has(project.projectState)
  );
  const inactiveProjects = parsedProjects.filter(
    (project) => !activeStates.has(project.projectState)
  );
  const colorUsage = new Map<SymphonyProjectColor, ParsedProjectMetadata[]>();
  const problems: ProjectColorProblem[] = [];

  for (const project of activeProjects) {
    if (project.missingRequiredFields.length > 0) {
      problems.push({
        type: "missing-metadata",
        project,
        missingFields: project.missingRequiredFields,
      });
    }

    if (!project.projectColor) {
      continue;
    }

    if (!isSymphonyProjectColor(project.projectColor)) {
      problems.push({
        type: "unknown-color",
        project,
        color: project.projectColor,
      });
      continue;
    }

    colorUsage.set(project.projectColor, [
      ...(colorUsage.get(project.projectColor) || []),
      project,
    ]);
  }

  for (const color of SYMPHONY_PROJECT_COLORS) {
    const projectsForColor = colorUsage.get(color) || [];
    if (projectsForColor.length > 1) {
      problems.push({
        type: "duplicate-active-color",
        color,
        projects: projectsForColor,
      });
    }
  }

  return {
    supportedColors: SYMPHONY_PROJECT_COLORS,
    activeProjects,
    inactiveProjects,
    usedColors: SYMPHONY_PROJECT_COLORS.filter(
      (color) => (colorUsage.get(color) || []).length > 0
    ),
    problems,
  };
}

export function selectAvailableProjectColor(
  projects: readonly LinearProjectInput[],
  options: ProjectColorOptions = {}
): ProjectColorSelection {
  const audit = auditProjectColorAvailability(projects, options);

  if (audit.problems.length > 0) {
    return {
      available: false,
      reason: `Cannot select a Symphony project color because active Linear project metadata has conflicts: ${formatProblems(
        audit.problems
      ).join("; ")}`,
      audit,
    };
  }

  const color = SYMPHONY_PROJECT_COLORS.find(
    (candidate) => !audit.usedColors.includes(candidate)
  );
  if (!color) {
    return {
      available: false,
      reason: `No Symphony project colors are available; active projects already use ${formatColorList(
        audit.usedColors
      )}.`,
      audit,
    };
  }

  return {
    available: true,
    color,
    audit,
  };
}

export function readProjectColorFixture(
  filePath: string
): LinearProjectInput[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  const projects = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.projects)
    ? parsed.projects
    : undefined;

  if (!projects) {
    throw new Error(
      `Project color fixture must be an array or an object with a projects array: ${path.resolve(
        filePath
      )}`
    );
  }

  return projects.map(readFixtureProject);
}

function readFixtureProject(
  project: unknown,
  index: number
): LinearProjectInput {
  if (!isRecord(project)) {
    throw new Error(`Fixture project at index ${index} must be an object.`);
  }

  return {
    name: optionalString(project.name, `projects[${index}].name`),
    state: optionalString(project.state, `projects[${index}].state`),
    url: optionalString(project.url, `projects[${index}].url`),
    content: optionalString(project.content, `projects[${index}].content`),
    description: optionalString(
      project.description,
      `projects[${index}].description`
    ),
  };
}

function formatProblems(problems: readonly ProjectColorProblem[]) {
  return problems.map((problem) => {
    if (problem.type === "missing-metadata") {
      return `${formatProject(problem.project)} is missing ${formatColorList(
        problem.missingFields
      )}`;
    }

    if (problem.type === "unknown-color") {
      return `${formatProject(problem.project)} uses unknown color "${
        problem.color
      }"`;
    }

    return `color "${
      problem.color
    }" is used by more than one active project: ${problem.projects
      .map(formatProject)
      .join(", ")}`;
  });
}

function formatProject(project: ParsedProjectMetadata) {
  const label =
    project.projectCode ||
    project.projectName ||
    project.projectUrl ||
    "project";
  return project.projectUrl ? `${label} (${project.projectUrl})` : label;
}

function formatColorList(colors: readonly string[]) {
  if (colors.length === 0) {
    return "none";
  }
  if (colors.length === 1) {
    return colors[0];
  }

  return `${colors.slice(0, -1).join(", ")}, and ${colors[colors.length - 1]}`;
}

function cleanMetadataValue(value: string) {
  return value.trim().replace(/^["'`]|["'`]$/g, "");
}

function normalizeState(state: string | null | undefined) {
  return (state || "").trim().toLowerCase();
}

function normalizeActiveStates(activeStates: readonly string[] | undefined) {
  return new Set(
    (activeStates || DEFAULT_ACTIVE_LINEAR_PROJECT_STATES).map(normalizeState)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, label: string) {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string when provided.`);
  }
  return value;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    console.info(HELP_TEXT);
    return;
  }

  const fixturePath = readFlag(args, "--fixture");
  if (!fixturePath) {
    throw new Error("Missing required --fixture <path>.");
  }

  const projects = readProjectColorFixture(fixturePath);
  const selection = selectAvailableProjectColor(projects);

  if (!selection.available) {
    console.error(selection.reason);
    console.error(JSON.stringify(selection.audit, null, 2));
    process.exitCode = 1;
    return;
  }

  console.info(
    JSON.stringify(
      {
        availableColor: selection.color,
        usedColors: selection.audit.usedColors,
        inactiveProjects: selection.audit.inactiveProjects,
      },
      null,
      2
    )
  );
}

function readFlag(args: readonly string[], flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

const HELP_TEXT = `
Usage:
  npx ts-node scripts/symphony/project-colors.ts --fixture <projects.json>

The fixture must be either an array of Linear project objects or an object with
a projects array. Each project may include name, state, url, content, and
description fields from Linear.

Before assigning the returned color, also inspect open GitHub PRs with project
color labels for likely orphaned work. This helper only audits Linear project
metadata.
`.trim();

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
