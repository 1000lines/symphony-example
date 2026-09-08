import { readFileSync } from "fs";
import { resolve } from "path";

import {
  parsePlanDecisions,
  parseProjectGraph,
  parseProjectGraphFromMarkdown,
  ProjectGraphError,
} from "./projectGraph";

const FIXTURE_PLAN_PATH = resolve(
  __dirname,
  "__fixtures__/minimal-project-plan.md"
);
const FIXTURE_MERMAID_PATH = resolve(
  __dirname,
  "__fixtures__/minimal-project-plan.mmd"
);

describe("project DAG graph parsing", () => {
  const plan = readFileSync(FIXTURE_PLAN_PATH, "utf8");
  const standaloneMermaid = readFileSync(FIXTURE_MERMAID_PATH, "utf8");

  test("parses a symphony-dag/v1 Mermaid graph fixture", () => {
    const graph = parseProjectGraphFromMarkdown(plan);

    expect(graph).toMatchObject({
      schema: "symphony-dag/v1",
      direction: "LR",
    });
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
    expect(graph.nodes.find((node) => node.id === "SYNTHDAG_001")).toMatchObject({
      label: "SYNTHDAG-001 task: alpha work",
      typeHint: "task",
    });
    expect(graph.edges[0]).toEqual({ from: "SYNTHDAG_001", to: "SYNTHDAG_002" });
  });

  test("parses the standalone Mermaid fixture with the same graph counts", () => {
    const graph = parseProjectGraph(standaloneMermaid);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
  });

  test("parses decision table rows deterministically", () => {
    const decisions = parsePlanDecisions(plan);

    expect(decisions).toEqual([
      {
        number: 1,
        title: "Use direct blocker relations",
      },
      {
        number: 2,
        title: "Keep task PRs based on main",
      },
    ]);
  });

  test("rejects duplicate graph nodes", () => {
    const source = `
%% symphony-dag/v1
flowchart LR
  SYNTHDAG_001["SYNTHDAG-001 task: one"]
  SYNTHDAG_001["SYNTHDAG-001 task: two"]
`;

    expectGraphError(() => parseProjectGraph(source), "duplicate-graph-node");
  });

  test("rejects malformed graph edges", () => {
    const source = `
%% symphony-dag/v1
flowchart LR
  SYNTHDAG_001["SYNTHDAG-001 task: one"]
  SYNTHDAG_002["SYNTHDAG-002 task: two"]
  SYNTHDAG_001 -> SYNTHDAG_002
`;

    expectGraphError(() => parseProjectGraph(source), "malformed-mermaid");
  });
});

function expectGraphError(
  action: () => unknown,
  code: ProjectGraphError["code"]
) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectGraphError);
    expect((error as ProjectGraphError).code).toBe(code);
    return;
  }

  throw new Error(`Expected ProjectGraphError with code ${code}`);
}
