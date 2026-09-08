import { readFileSync } from "fs";
import { resolve } from "path";

import {
  buildDagLinearPayloadFromMarkdown,
  buildPostFanOutGraphRewrite,
  DagLinearPayloadError,
  formatDagLinearPayloadJson,
  previewDagLinearLiveWrite,
  type DagLinearPayloadOptions,
} from "./dagLinearPayload";

const PLAN_PATH = resolve(__dirname, "__fixtures__/minimal-project-plan.md");

describe("DAG Linear fan-out payloads", () => {
  const plan = readFileSync(PLAN_PATH, "utf8");
  const options: DagLinearPayloadOptions = {
    teamKey: "DEMO",
    teamId: "demo-team-id",
    projectName: "DAG Planning v2",
    projectId: "dag-project-id",
    sourcePlanPath:
      "docs/symphony-plans/fan-out-plan-DEMO-381-sample-dag.md",
    sourceIssueIdentifier: "DEMO-381",
    sourceIssueUrl:
      "https://linear.app/example-workspace/issue/DEMO-381/sample-dag",
    assignee: {
      id: "example-human-linear-id",
      name: "Example Lead",
      githubLogin: "example-lead",
    },
    stateIdsByName: {
      Todo: "todo-state-id",
    },
    labelIdsByName: {
      cyan: "cyan-label-id",
    },
  };

  test("emits dry-run issue and direct relation counts", () => {
    const payload = buildDagLinearPayloadFromMarkdown(plan, options);

    expect(payload).toMatchObject({
      schemaVersion: "symphony-dag/v1",
      kind: "dag_linear_fanout_payload",
      team: {
        key: "DEMO",
        id: "demo-team-id",
      },
      project: {
        code: "sample-dag",
        color: "cyan",
        name: "DAG Planning v2",
        baseBranch: "main",
        humanLead: "Test Lead",
        humanLeadGithub: "test-lead",
      },
    });
    expect(payload.issuePayloads).toHaveLength(2);
    expect(payload.relationPayloads).toHaveLength(2);
    expect(payload.githubPrLabels).toEqual(["cyan", "symphony"]);
    expect(payload.requiredLinearLabels).toEqual(["cyan", "mature"]);
  });

  test("builds issueCreate payloads with assignee, labels, branch templates, and source links", () => {
    const payload = buildDagLinearPayloadFromMarkdown(plan, options);
    const firstIssue = payload.issuePayloads[0];

    expect(firstIssue).toMatchObject({
      nodeId: "SYNTHDAG_001",
      payloadKey: "SYNTHDAG-001",
      title: "Alpha work",
      nodeType: "task",
      difficulty: "small",
      initialState: "Todo",
      labelNames: ["cyan"],
      branch: {
        template: "symphony/sample-dag/${issue}/alpha",
        baseBranch: "main",
      },
      pr: {
        create: "on_branch_birth",
        baseBranch: "main",
        draft: true,
        githubLabels: ["cyan", "symphony"],
      },
      assignee: {
        id: "example-human-linear-id",
        name: "Example Lead",
        githubLogin: "example-lead",
      },
    });
    expect(firstIssue.sourceLinks).toEqual([
      {
        label: "Accepted fan-out plan",
        target: "docs/symphony-plans/fan-out-plan-DEMO-381-sample-dag.md",
      },
      {
        label: "DEMO-381",
        target: "https://linear.app/example-workspace/issue/DEMO-381/sample-dag",
      },
    ]);
    expect(firstIssue.issueCreateInput).toMatchObject({
      teamId: "demo-team-id",
      projectId: "dag-project-id",
      title: "Alpha work",
      stateId: "todo-state-id",
      labelIds: ["cyan-label-id"],
      assigneeId: "example-human-linear-id",
    });
    expect(firstIssue.issueCreateInput.description).toContain(
      "Branch template: symphony/sample-dag/${issue}/alpha"
    );
    expect(firstIssue.issueCreateInput.description).toContain(
      "Base branch: main"
    );
  });

  test("uses blocker issueId to blocked relatedIssueId for relation writes", () => {
    const payload = buildDagLinearPayloadFromMarkdown(plan, {
      ...options,
      issueIdsByKey: {
        "SYNTHDAG-001": "issue-SYNTHDAG-001",
        "SYNTHDAG-002": "issue-SYNTHDAG-002",
        "DEMO-383": "issue-DEMO-383",
      },
    });

    expect(payload.relationPayloads[0]).toMatchObject({
      source: "SYNTHDAG-001 -> SYNTHDAG-002",
      blockerKey: "SYNTHDAG-001",
      blockedKey: "SYNTHDAG-002",
      relation: "blocks",
      issueRelationCreateInput: {
        issueId: "issue-SYNTHDAG-001",
        relatedIssueId: "issue-SYNTHDAG-002",
        type: "blocks",
      },
    });
    expect(payload.relationPayloads[1]).toMatchObject({
      source: "SYNTHDAG-002 -> DEMO-383",
      issueRelationCreateInput: {
        issueId: "issue-SYNTHDAG-002",
        relatedIssueId: "issue-DEMO-383",
        type: "blocks",
      },
    });
  });

  test("live-write preview fails closed when required labels are missing and cannot be created", () => {
    const payload = buildDagLinearPayloadFromMarkdown(plan, {
      ...options,
      labelIdsByName: undefined,
    });

    expectDagLinearPayloadError(
      () =>
        previewDagLinearLiveWrite(payload, {
          availableLabels: [{ name: "cyan", id: "cyan-label-id" }],
          canCreateMissingLabels: false,
        }),
      "missing-required-label"
    );
  });

  test("live-write preview reports labels to create when creation is allowed", () => {
    const payload = buildDagLinearPayloadFromMarkdown(plan, {
      ...options,
      labelIdsByName: undefined,
    });
    const preview = previewDagLinearLiveWrite(payload, {
      availableLabels: [{ name: "cyan", id: "cyan-label-id" }],
      canCreateMissingLabels: true,
    });

    expect(preview.labelSetup).toEqual([
      {
        name: "cyan",
        status: "existing",
        id: "cyan-label-id",
      },
      {
        name: "mature",
        status: "create",
      },
    ]);
    expect(preview.issueCreatePayloads).toHaveLength(2);
  });

  test("records post-fan-out mappings for created issues only", () => {
    const payload = buildDagLinearPayloadFromMarkdown(plan, options);
    const rewrite = buildPostFanOutGraphRewrite(payload, {
      issueMappings: payload.issuePayloads.map((issue, index) => ({
        payloadKey: issue.payloadKey,
        issueId: `linear-${index}`,
        issueIdentifier: `DEMO-${400 + index}`,
        url: `https://linear.app/example-workspace/issue/DEMO-${400 + index}`,
      })),
    });

    expect(rewrite.issueMappings).toHaveLength(2);
    expect(rewrite.relationPayloads).toEqual([
      {
        source: "SYNTHDAG-001 -> SYNTHDAG-002",
        blockerKey: "DEMO-400",
        blockedKey: "DEMO-401",
        relation: "blocks",
      },
      {
        source: "SYNTHDAG-002 -> DEMO-383",
        blockerKey: "DEMO-401",
        blockedKey: "DEMO-383",
        relation: "blocks",
      },
    ]);
  });

  test("emits stable JSON for fan-out dry runs", () => {
    const payload = buildDagLinearPayloadFromMarkdown(plan, options);
    const json = JSON.parse(formatDagLinearPayloadJson(payload));

    expect(json).toMatchObject({
      schemaVersion: "symphony-dag/v1",
      kind: "dag_linear_fanout_payload",
      project: {
        code: "sample-dag",
        color: "cyan",
      },
    });
    expect(json.issuePayloads).toHaveLength(2);
    expect(json.relationPayloads).toHaveLength(2);
  });
});

function expectDagLinearPayloadError(
  action: () => unknown,
  code: DagLinearPayloadError["code"]
) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DagLinearPayloadError);
    expect((error as DagLinearPayloadError).code).toBe(code);
    return;
  }

  throw new Error(`Expected DagLinearPayloadError with code ${code}`);
}
