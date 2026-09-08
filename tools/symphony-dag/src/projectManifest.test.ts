import { readFileSync } from "fs";
import { resolve } from "path";

import {
  formatProjectPlanJson,
  parseProjectManifestFromMarkdown,
  parseProjectPlan,
  ProjectManifestError,
} from "./projectManifest";

const FIXTURE_PLAN_PATH = resolve(
  __dirname,
  "__fixtures__/minimal-project-plan.md"
);

describe("project DAG manifest validation", () => {
  const fixturePlan = readFileSync(FIXTURE_PLAN_PATH, "utf8");

  test("validates a DAG v2 manifest fixture", () => {
    const parsed = parseProjectPlan(fixturePlan);

    expect(parsed.manifest.schema).toBe("symphony-dag-manifest/v1");
    expect(parsed.manifest.project).toMatchObject({
      code: "sample-dag",
      color: "cyan",
      baseBranch: "main",
      humanLead: "Test Lead",
      humanLeadGithub: "test-lead",
    });
    expect(parsed.manifest.defaults).toMatchObject({
      initialState: "Todo",
      maturityLabel: "mature",
      relationType: "blocks",
    });
    expect(parsed.manifest.sourceSha256).toHaveLength(64);
    expect(parsed.graph.nodes).toHaveLength(3);
    expect(parsed.graph.edges).toHaveLength(2);
    expect(parsed.manifest.nodes).toHaveLength(3);
    expect(parsed.manifest.edges).toHaveLength(2);
    expect(parsed.issuePayloadNodes.map((node) => node.payloadKey)).toEqual([
      "SYNTHDAG-001",
      "SYNTHDAG-002",
    ]);
    expect(parsed.relationPayloads).toEqual([
      {
        source: "SYNTHDAG-001 -> SYNTHDAG-002",
        blockerKey: "SYNTHDAG-001",
        blockedKey: "SYNTHDAG-002",
        relation: "blocks",
      },
      {
        source: "SYNTHDAG-002 -> DEMO-383",
        blockerKey: "SYNTHDAG-002",
        blockedKey: "DEMO-383",
        relation: "blocks",
      },
    ]);
    expect(parsed.expectedRelationPayloads).toHaveLength(2);
    expect(parsed.decisions).toHaveLength(2);
  });

  test("requires migration before replaying an obsolete synthetic plan", () => {
    const obsoletePlan = fixturePlan
      .replace(
        "project:\n",
        "project:\n  integration_branch: symphony/cyan/integration\n"
      )
      .replace(
        "defaults:\n",
        "defaults:\n  frontier_blocked_label: frontier-blocked\n"
      );

    expectManifestError(
      () => parseProjectPlan(obsoletePlan),
      "removed-manifest-field"
    );
  });

  test("keeps the synthetic graph and manifest counts aligned after field migration", () => {
    const obsoletePlan = fixturePlan
      .replace(
        "project:\n",
        "project:\n  integration_branch: symphony/cyan/integration\n"
      )
      .replace(
        "defaults:\n",
        "defaults:\n  frontier_blocked_label: frontier-blocked\n"
      );
    const migratedPlan = obsoletePlan
      .replace(/^ {2}integration_branch:.*\n/m, "")
      .replace(/^ {2}frontier_blocked_label:.*\n/m, "");
    const parsed = parseProjectPlan(migratedPlan);

    expect(parsed.graph.nodes).toHaveLength(3);
    expect(parsed.graph.edges).toHaveLength(2);
    expect(parsed.manifest.nodes).toHaveLength(parsed.graph.nodes.length);
    expect(parsed.manifest.edges).toHaveLength(parsed.graph.edges.length);
    expect(parsed.issuePayloadNodes).toHaveLength(2);
    expect(parsed.relationPayloads).toHaveLength(2);
    expect(parsed.decisions.length).toBeGreaterThan(0);
  });

  test.each([
    ["project", "integration_branch", "symphony/cyan/integration"],
    ["defaults", "frontier_blocked_label", "frontier-blocked"],
  ])("rejects removed %s.%s before fan-out", (section, field, value) => {
    const obsoletePlan = fixturePlan.replace(
      `${section}:\n`,
      `${section}:\n  ${field}: ${value}\n`
    );

    expectManifestError(
      () => parseProjectPlan(obsoletePlan),
      "removed-manifest-field"
    );
    expect(() => parseProjectPlan(obsoletePlan)).toThrow(
      `${section} uses removed field ${field}; update and re-approve the plan`
    );
  });

  test("continues to reject the v1 integration branch policy", () => {
    const obsoletePlan = fixturePlan.replace(
      "defaults:\n",
      "defaults:\n  integration_branch_policy: born_on_work_frontier\n"
    );

    expectManifestError(
      () => parseProjectPlan(obsoletePlan),
      "unsupported-v1-field"
    );
  });

  test("emits stable JSON for later command surfaces", () => {
    const parsed = parseProjectPlan(fixturePlan);
    const json = JSON.parse(formatProjectPlanJson(parsed));

    expect(json).toMatchObject({
      schemaVersion: "symphony-dag/v1",
      project: {
        code: "sample-dag",
        color: "cyan",
      },
      graph: {
        nodeCount: 3,
        edgeCount: 2,
      },
    });
    expect(json.manifestSha256).toBe(parsed.manifest.sourceSha256);
    expect(json.relationPayloads).toHaveLength(2);
  });

  test("rejects a plan without a manifest", () => {
    const missingManifest = fixturePlan.replace(
      /## Manifest\n\n```yaml[\s\S]*?```\n\n## Decisions/,
      "## Decisions"
    );

    expectManifestError(
      () => parseProjectManifestFromMarkdown(missingManifest),
      "missing-manifest-block"
    );
  });

  test("rejects graph and manifest edge mismatch", () => {
    const missingManifestEdge = fixturePlan.replace(
      "  - from: SYNTHDAG_002\n    to: SYNTHDAG_003\n```",
      "```"
    );

    expectManifestError(
      () => parseProjectPlan(missingManifestEdge),
      "graph-manifest-edge-mismatch"
    );
  });

  test("rejects generated join nodes", () => {
    const generatedJoin = fixturePlan.replace(
      "    type: task",
      "    type: generated_join"
    );

    expectManifestError(
      () => parseProjectPlan(generatedJoin),
      "unsupported-v1-field"
    );
  });

  test("rejects branch base_node declarations", () => {
    const baseNode = fixturePlan.replace(
      "      base: main\n      birth: on_dispatch",
      "      base_node: SYNTHDAG_001\n      birth: on_dispatch"
    );

    expectManifestError(
      () => parseProjectPlan(baseNode),
      "unsupported-v1-field"
    );
  });

  test("rejects stack labels", () => {
    const stackLabel = fixturePlan.replace(
      "    labels: [cyan]",
      "    labels: [cyan, stack:after-review]"
    );

    expectManifestError(
      () => parseProjectPlan(stackLabel),
      "unsupported-v1-field"
    );
  });
});

function expectManifestError(
  action: () => unknown,
  code: ProjectManifestError["code"]
) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectManifestError);
    expect((error as ProjectManifestError).code).toBe(code);
    return;
  }

  throw new Error(`Expected ProjectManifestError with code ${code}`);
}
