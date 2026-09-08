import {
  formatJsonOutput,
  type JsonOutput,
  withSchemaVersion,
} from "./jsonOutput";
import { type RelationPayload } from "./projectGraph";
import {
  parseProjectPlan,
  type ProjectManifestNode,
  type ProjectNodeType,
  type ProjectPlan,
} from "./projectManifest";

export type DagLinearPayloadErrorCode =
  | "invalid-issue-payload"
  | "missing-required-label"
  | "missing-state-id"
  | "missing-issue-id"
  | "missing-issue-mapping"
  | "duplicate-issue-mapping";

export class DagLinearPayloadError extends Error {
  constructor(
    readonly code: DagLinearPayloadErrorCode,
    message: string,
    readonly input: string
  ) {
    super(message);
    this.name = "DagLinearPayloadError";
  }
}

export type DagLinearPayloadOptions = {
  readonly teamKey: string;
  readonly teamId?: string;
  readonly projectName: string;
  readonly projectId?: string;
  readonly sourcePlanPath: string;
  readonly sourceIssueIdentifier?: string;
  readonly sourceIssueUrl?: string;
  readonly assignee?: {
    readonly id?: string;
    readonly name: string;
    readonly githubLogin?: string | null;
  } | null;
  readonly stateIdsByName?: Readonly<Record<string, string>>;
  readonly labelIdsByName?: Readonly<Record<string, string>>;
  readonly issueIdsByKey?: Readonly<Record<string, string>>;
};

export type DagSourceLink = {
  readonly label: string;
  readonly target: string;
};

export type DagLinearIssueCreateInput = {
  readonly teamId?: string;
  readonly projectId?: string;
  readonly title: string;
  readonly description: string;
  readonly stateId?: string;
  readonly labelIds?: readonly string[];
  readonly assigneeId?: string;
};

export type DagLinearIssuePayload = {
  readonly nodeId: string;
  readonly payloadKey: string;
  readonly title: string;
  readonly nodeType: ProjectNodeType;
  readonly difficulty: string | null;
  readonly initialState: string;
  readonly labelNames: readonly string[];
  readonly branch: {
    readonly template: string;
    readonly baseBranch: string;
    readonly birth: string;
  };
  readonly pr: {
    readonly create: string;
    readonly baseBranch: string;
    readonly draft: boolean;
    readonly githubLabels: readonly string[];
  };
  readonly assignee: DagLinearPayloadOptions["assignee"];
  readonly sourceLinks: readonly DagSourceLink[];
  readonly issueCreateInput: DagLinearIssueCreateInput;
};

export type DagLinearRelationPayload = RelationPayload & {
  readonly issueRelationCreateInput?: {
    readonly issueId: string;
    readonly relatedIssueId: string;
    readonly type: "blocks";
  };
};

export type DagLinearFanOutPayload = JsonOutput<{
  readonly kind: "dag_linear_fanout_payload";
  readonly team: {
    readonly key: string;
    readonly id?: string;
  };
  readonly project: {
    readonly code: string;
    readonly color: string;
    readonly name: string;
    readonly id?: string;
    readonly baseBranch: string;
    readonly humanLead: string;
    readonly humanLeadGithub: string | null;
  };
  readonly manifestSha256: string;
  readonly sourceLinks: readonly DagSourceLink[];
  readonly assignee: DagLinearPayloadOptions["assignee"];
  readonly githubPrLabels: readonly string[];
  readonly requiredLinearLabels: readonly string[];
  readonly issuePayloads: readonly DagLinearIssuePayload[];
  readonly relationPayloads: readonly DagLinearRelationPayload[];
}>;

export type DagLiveWritePreview = JsonOutput<{
  readonly kind: "dag_linear_live_write_preview";
  readonly labelSetup: readonly (
    | {
        readonly name: string;
        readonly status: "existing";
        readonly id: string;
      }
    | {
        readonly name: string;
        readonly status: "create";
      }
  )[];
  readonly issueCreatePayloads: readonly DagLinearIssueCreateInput[];
  readonly relationCreatePayloads: readonly NonNullable<
    DagLinearRelationPayload["issueRelationCreateInput"]
  >[];
}>;

export type LinearLabel = {
  readonly id: string;
  readonly name: string;
};

export type DagPostFanOutIssueMapping = {
  readonly payloadKey: string;
  readonly issueId: string;
  readonly issueIdentifier: string;
  readonly url?: string;
};

export type DagPostFanOutRewrite = JsonOutput<{
  readonly kind: "dag_linear_post_fanout_rewrite";
  readonly issueMappings: readonly DagPostFanOutIssueMapping[];
  readonly relationPayloads: readonly RelationPayload[];
}>;

export function buildDagLinearPayloadFromMarkdown(
  markdown: string,
  options: DagLinearPayloadOptions
): DagLinearFanOutPayload {
  return buildDagLinearPayload(parseProjectPlan(markdown), options);
}

export function buildDagLinearPayload(
  plan: ProjectPlan,
  options: DagLinearPayloadOptions
): DagLinearFanOutPayload {
  const sourceLinks = buildSourceLinks(options);
  const issuePayloads = plan.issuePayloadNodes.map((node) =>
    buildIssuePayload(plan, node, options, sourceLinks)
  );
  const relationPayloads = plan.relationPayloads.map((payload) =>
    buildRelationPayload(payload, options.issueIdsByKey)
  );

  return withSchemaVersion({
    kind: "dag_linear_fanout_payload" as const,
    team: {
      key: options.teamKey,
      ...(options.teamId ? { id: options.teamId } : {}),
    },
    project: {
      code: plan.manifest.project.code,
      color: plan.manifest.project.color,
      name: options.projectName,
      ...(options.projectId ? { id: options.projectId } : {}),
      baseBranch: plan.manifest.project.baseBranch,
      humanLead: plan.manifest.project.humanLead,
      humanLeadGithub: plan.manifest.project.humanLeadGithub,
    },
    manifestSha256: plan.manifest.sourceSha256,
    sourceLinks,
    assignee: options.assignee ?? null,
    githubPrLabels: plan.manifest.project.githubPrLabels,
    requiredLinearLabels: requiredLinearLabelsForPlan(plan),
    issuePayloads,
    relationPayloads,
  });
}

export function previewDagLinearLiveWrite(
  payload: DagLinearFanOutPayload,
  options: {
    readonly availableLabels: readonly LinearLabel[];
    readonly canCreateMissingLabels: boolean;
  }
): DagLiveWritePreview {
  const labelsByName = new Map(
    options.availableLabels.map((label) => [label.name, label])
  );
  const missingLabels = payload.requiredLinearLabels.filter(
    (labelName) => !labelsByName.has(labelName)
  );

  if (missingLabels.length > 0 && !options.canCreateMissingLabels) {
    throw new DagLinearPayloadError(
      "missing-required-label",
      `Missing required Linear labels and label creation is disabled: ${missingLabels.join(
        ", "
      )}`,
      missingLabels.join(",")
    );
  }

  const relationCreatePayloads = payload.relationPayloads
    .map((relation) => relation.issueRelationCreateInput)
    .filter(
      (
        relation
      ): relation is NonNullable<
        DagLinearRelationPayload["issueRelationCreateInput"]
      > => relation !== undefined
    );

  return withSchemaVersion({
    kind: "dag_linear_live_write_preview" as const,
    labelSetup: payload.requiredLinearLabels.map((labelName) => {
      const existingLabel = labelsByName.get(labelName);
      if (existingLabel) {
        return {
          name: labelName,
          status: "existing" as const,
          id: existingLabel.id,
        };
      }

      return {
        name: labelName,
        status: "create" as const,
      };
    }),
    issueCreatePayloads: payload.issuePayloads.map(
      (issue) => issue.issueCreateInput
    ),
    relationCreatePayloads,
  });
}

export function buildPostFanOutGraphRewrite(
  payload: DagLinearFanOutPayload,
  options: {
    readonly issueMappings: readonly DagPostFanOutIssueMapping[];
  }
): DagPostFanOutRewrite {
  const mappingsByPayloadKey = new Map<string, DagPostFanOutIssueMapping>();
  for (const mapping of options.issueMappings) {
    if (mappingsByPayloadKey.has(mapping.payloadKey)) {
      throw new DagLinearPayloadError(
        "duplicate-issue-mapping",
        `Duplicate issue mapping for ${mapping.payloadKey}`,
        mapping.payloadKey
      );
    }
    mappingsByPayloadKey.set(mapping.payloadKey, mapping);
  }

  for (const issuePayload of payload.issuePayloads) {
    if (!mappingsByPayloadKey.has(issuePayload.payloadKey)) {
      throw new DagLinearPayloadError(
        "missing-issue-mapping",
        `Missing post-fan-out issue mapping for ${issuePayload.payloadKey}`,
        issuePayload.payloadKey
      );
    }
  }

  return withSchemaVersion({
    kind: "dag_linear_post_fanout_rewrite" as const,
    issueMappings: options.issueMappings,
    relationPayloads: payload.relationPayloads.map((relation) => ({
      source: relation.source,
      blockerKey: rewriteIssueKey(relation.blockerKey, mappingsByPayloadKey),
      blockedKey: rewriteIssueKey(relation.blockedKey, mappingsByPayloadKey),
      relation: relation.relation,
    })),
  });
}

export function formatDagLinearPayloadJson(
  payload: DagLinearFanOutPayload
): string {
  return formatJsonOutput(payload);
}

function buildIssuePayload(
  plan: ProjectPlan,
  node: ProjectManifestNode,
  options: DagLinearPayloadOptions,
  sourceLinks: readonly DagSourceLink[]
): DagLinearIssuePayload {
  if (node.payloadKey === null || node.branch.template === null) {
    throw new DagLinearPayloadError(
      "invalid-issue-payload",
      `Node ${node.id} is not a generated issue payload node`,
      node.id
    );
  }

  const initialState = node.initialState ?? plan.manifest.defaults.initialState;
  if (initialState === null) {
    throw new DagLinearPayloadError(
      "invalid-issue-payload",
      `Node ${node.id} must declare an initial_state or use a default`,
      node.id
    );
  }

  const labelNames = uniqueStrings([
    ...plan.manifest.project.linearIssueLabels,
    ...node.labels,
  ]);
  const stateId = options.stateIdsByName
    ? readRequiredStateId(options.stateIdsByName, initialState)
    : undefined;
  const labelIdsByName = options.labelIdsByName;
  const labelIds = labelIdsByName
    ? labelNames.map((labelName) =>
        readRequiredLabelId(labelIdsByName, labelName)
      )
    : undefined;
  const githubLabels = uniqueStrings([
    ...plan.manifest.project.githubPrLabels,
    ...node.pr.labels,
  ]);

  return {
    nodeId: node.id,
    payloadKey: node.payloadKey,
    title: node.title,
    nodeType: node.type,
    difficulty: node.difficulty,
    initialState,
    labelNames,
    branch: {
      template: node.branch.template,
      baseBranch: node.branch.base,
      birth: node.branch.birth,
    },
    pr: {
      create: node.pr.create ?? "on_branch_birth",
      baseBranch: node.pr.base,
      draft: node.pr.draft === true,
      githubLabels,
    },
    assignee: options.assignee ?? null,
    sourceLinks,
    issueCreateInput: {
      ...(options.teamId ? { teamId: options.teamId } : {}),
      ...(options.projectId ? { projectId: options.projectId } : {}),
      title: node.title,
      description: renderIssueDescription(plan, node, options, sourceLinks),
      ...(stateId ? { stateId } : {}),
      ...(labelIds ? { labelIds } : {}),
      ...(options.assignee?.id ? { assigneeId: options.assignee.id } : {}),
    },
  };
}

function buildRelationPayload(
  payload: RelationPayload,
  issueIdsByKey: Readonly<Record<string, string>> | undefined
): DagLinearRelationPayload {
  if (!issueIdsByKey) {
    return payload;
  }

  const issueId = readRequiredIssueId(issueIdsByKey, payload.blockerKey);
  const relatedIssueId = readRequiredIssueId(issueIdsByKey, payload.blockedKey);
  return {
    ...payload,
    issueRelationCreateInput: {
      issueId,
      relatedIssueId,
      type: "blocks",
    },
  };
}

function requiredLinearLabelsForPlan(plan: ProjectPlan): readonly string[] {
  return uniqueStrings([
    ...plan.manifest.project.linearIssueLabels,
    plan.manifest.defaults.maturityLabel,
    ...plan.manifest.nodes.flatMap((node) => node.labels),
  ]);
}

function buildSourceLinks(
  options: DagLinearPayloadOptions
): readonly DagSourceLink[] {
  return [
    {
      label: "Accepted fan-out plan",
      target: options.sourcePlanPath,
    },
    ...(options.sourceIssueIdentifier
      ? [
          {
            label: options.sourceIssueIdentifier,
            target: options.sourceIssueUrl ?? options.sourceIssueIdentifier,
          },
        ]
      : []),
  ];
}

function renderIssueDescription(
  plan: ProjectPlan,
  node: ProjectManifestNode,
  options: DagLinearPayloadOptions,
  sourceLinks: readonly DagSourceLink[]
): string {
  return [
    `Generated from accepted DAG fan-out plan ${options.sourcePlanPath}.`,
    `Payload key: ${node.payloadKey}. Node type: ${node.type}. Difficulty: ${
      node.difficulty ?? "unspecified"
    }. Initial status: ${
      node.initialState ?? plan.manifest.defaults.initialState
    }.`,
    `Project code: ${plan.manifest.project.code}. ` +
      `Project color: ${plan.manifest.project.color}. ` +
      `Base branch: ${plan.manifest.project.baseBranch}.`,
    `Human lead: ${plan.manifest.project.humanLead}.`,
    `Branch template: ${node.branch.template}. Declared base: ${node.branch.base}. PR base: ${node.pr.base}.`,
    `GitHub PR labels: ${uniqueStrings([
      ...plan.manifest.project.githubPrLabels,
      ...node.pr.labels,
    ]).join(", ")}.`,
    `Source links: ${sourceLinks
      .map((link) => `${link.label} (${link.target})`)
      .join("; ")}.`,
  ].join("\n\n");
}

function readRequiredLabelId(
  labelIdsByName: Readonly<Record<string, string>>,
  labelName: string
): string {
  const labelId = labelIdsByName[labelName];
  if (!labelId) {
    throw new DagLinearPayloadError(
      "missing-required-label",
      `Missing Linear label id for ${labelName}`,
      labelName
    );
  }

  return labelId;
}

function readRequiredStateId(
  stateIdsByName: Readonly<Record<string, string>>,
  stateName: string
): string {
  const stateId = stateIdsByName[stateName];
  if (!stateId) {
    throw new DagLinearPayloadError(
      "missing-state-id",
      `Missing Linear state id for ${stateName}`,
      stateName
    );
  }

  return stateId;
}

function readRequiredIssueId(
  issueIdsByKey: Readonly<Record<string, string>>,
  issueKey: string
): string {
  const issueId = issueIdsByKey[issueKey];
  if (!issueId) {
    throw new DagLinearPayloadError(
      "missing-issue-id",
      `Missing Linear issue id for ${issueKey}`,
      issueKey
    );
  }

  return issueId;
}

function rewriteIssueKey(
  issueKey: string,
  mappingsByPayloadKey: ReadonlyMap<string, DagPostFanOutIssueMapping>
): string {
  return mappingsByPayloadKey.get(issueKey)?.issueIdentifier ?? issueKey;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values));
}
