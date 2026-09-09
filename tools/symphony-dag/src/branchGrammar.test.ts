import {
  BranchParseError,
  formatDagTaskBranchName,
  parseDagTaskBranch,
  sortTickets,
} from "./branchGrammar";

describe("DAG task branch grammar", () => {
  test("accepts numeric Linear team identifiers", () => {
    const name = "symphony/hackathon/100-12/first-ticket";
    expect(parseDagTaskBranch(name).ticket).toEqual({
      id: "100-12",
      prefix: "100",
      number: 12,
    });
    expect(
      formatDagTaskBranchName({
        projectCode: "hackathon",
        ticket: "100-12",
        slug: "first-ticket",
      })
    ).toBe(name);
  });
  test("accepts Symphony project-code issue slug branches", () => {
    const branch = parseDagTaskBranch(
      "symphony/sample-dag/DEMO-386/package-rename-prune"
    );

    expect(branch).toMatchObject({
      branchName: "symphony/sample-dag/DEMO-386/package-rename-prune",
      projectCode: "sample-dag",
      slug: "package-rename-prune",
    });
    expect(branch.ticket).toMatchObject({
      id: "DEMO-386",
      prefix: "DEMO",
      number: 386,
    });
  });

  test("formats task branch names from project metadata", () => {
    expect(
      formatDagTaskBranchName({
        projectCode: "sample-dag",
        ticket: "DEMO-386",
        slug: "package-rename-prune",
      })
    ).toBe("symphony/sample-dag/DEMO-386/package-rename-prune");
  });

  test.each([
    "feature/sample-dag/DEMO-386/package-rename-prune",
    "symphony/DAG-Planning/DEMO-386/package-rename-prune",
    "symphony/sample-dag/demo-386/package-rename-prune",
    "symphony/sample-dag/DEMO-386/",
    "symphony/sample-dag/DEMO-386/bad slug",
  ])("rejects malformed DAG task branch %s", (branchName) => {
    expectParseError(
      () => parseDagTaskBranch(branchName),
      "malformed-task-branch"
    );
  });
});

describe("ticket sorting", () => {
  test("sorts tickets by prefix and numeric issue number", () => {
    expect(sortTickets(["XYZ-1", "DEMO-10", "DEMO-2"])).toEqual([
      "DEMO-2",
      "DEMO-10",
      "XYZ-1",
    ]);
  });

  test("rejects duplicate tickets while sorting", () => {
    expectParseError(
      () => sortTickets(["DEMO-123", "DEMO-123"]),
      "duplicate-ticket"
    );
  });
});

function expectParseError(
  action: () => unknown,
  code: BranchParseError["code"]
) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BranchParseError);
    expect((error as BranchParseError).code).toBe(code);
    return;
  }

  throw new Error(`Expected BranchParseError with code ${code}`);
}
