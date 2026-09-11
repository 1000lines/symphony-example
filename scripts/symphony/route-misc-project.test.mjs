import assert from "node:assert/strict";
import test from "node:test";

import {
  applyMiscProjectRoute,
  buildRouteMutationPayload,
  planMiscProjectRoute,
  readMiscProjectRoutingInput,
  resolveActiveMiscProject,
  routeMiscProjectOnTicketStart,
} from "./route-misc-project.mjs";

const actor = {
  id: "viewer-id",
  name: "Symphony Bot",
  email: "linear-bot@example.invalid",
};

test("routes a no-project 100 issue to the active misc project", () => {
  const plan = routePlan();

  assert.equal(plan.action, "route");
  assert.equal(plan.shouldMutate, true);
  assert.equal(plan.previousProject, null);
  assert.equal(plan.newProject.id, "misc-project-id");
  assert.equal(plan.newProject.projectCode, "misc");
  assert.equal(plan.newProject.projectColor, "blue");
  assert.equal(plan.newProject.baseBranch, "main");
  assert.deepEqual(plan.labels, [
    { id: "blue-label-id", name: "blue", operation: "add" },
  ]);
  assert.equal(plan.actor.email, "linear-bot@example.invalid");
  assert.equal(plan.reason, "eligible-team-issue-without-project");
  assert.equal(plan.linearApiResult.operation, "dry-run");
  assert.deepEqual(plan.linearApiResult.mutations, [
    "issueUpdate",
    "issueLabelAdd",
  ]);
});

test("routes by the configured example team when the identifier prefix differs", () => {
  const plan = planMiscProjectRoute({
    issue: demoIssue({ identifier: "ENG-123", team: { key: "100" } }),
    projects: [miscProject()],
    issueLabels: [blueLabel()],
    actor,
  });
  assert.equal(plan.action, "route");
  assert.equal(plan.newProject.id, "misc-project-id");
});

test("already-project 100 issues are no-ops", () => {
  const plan = planMiscProjectRoute({
    issue: demoIssue({
      project: {
        id: "existing-project-id",
        name: "Existing Project",
        url: "https://linear.app/project/existing",
      },
    }),
    projects: [],
    issueLabels: [],
    actor,
  });

  assert.equal(plan.action, "skipped");
  assert.equal(plan.shouldMutate, false);
  assert.equal(plan.reason, "issue-already-has-project");
  assert.deepEqual(plan.previousProject, {
    id: "existing-project-id",
    name: "Existing Project",
    url: "https://linear.app/project/existing",
  });
  assert.equal(plan.newProject, null);
  assert.equal(plan.linearApiResult.operation, "skipped");
});

test("non-100 issues are no-ops", () => {
  const plan = planMiscProjectRoute({
    issue: {
      id: "issue-eng",
      identifier: "ENG-123",
      title: "Not 100",
      team: { key: "ENG", name: "Engineering" },
      project: null,
      labels: { nodes: [] },
    },
    projects: [],
    issueLabels: [],
    actor,
  });

  assert.equal(plan.action, "skipped");
  assert.equal(plan.shouldMutate, false);
  assert.equal(plan.reason, "different-team");
});

test("retired or missing misc project metadata fails closed", () => {
  assert.throws(
    () =>
      planMiscProjectRoute({
        issue: demoIssue(),
        projects: [miscProject({ state: "completed" })],
        issueLabels: [blueLabel()],
        actor,
      }),
    /Active misc project with project-code "misc" for 100-123 was not found/
  );
});

test("ambiguous misc metadata fails closed", () => {
  assert.throws(
    () =>
      resolveActiveMiscProject(
        [
          miscProject({ id: "misc-project-a" }),
          miscProject({ id: "misc-project-b" }),
        ],
        { issue: demoIssue() }
      ),
    /Ambiguous active misc project metadata for 100-123/
  );
});

test("missing misc project metadata fails closed", () => {
  assert.throws(
    () =>
      planMiscProjectRoute({
        issue: demoIssue(),
        projects: [
          miscProject({
            content: metadata({
              "project-code": "misc",
              "base-branch": "main",
            }),
          }),
        ],
        issueLabels: [blueLabel()],
        actor,
      }),
    /missing project-color/
  );
});

test("read input fetches active projects and resolves identity by project-code", async () => {
  const requests = [];
  const input = await readMiscProjectRoutingInput("100-123", {
    token: "linear-token",
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      assert.equal(request.variables.miscProjectName, undefined);
      assert.deepEqual(request.variables.activeProjectStates, [
        "planned",
        "started",
        "in progress",
      ]);
      assert.equal(request.variables.labelName, "blue");
      assert.doesNotMatch(request.query, /name:\s*\{\s*eq:/);

      return jsonResponse({
        data: {
          viewer: actor,
          issue: demoIssue(),
          projects: {
            nodes: [miscProject()],
            pageInfo: { hasNextPage: false },
          },
          issueLabels: {
            nodes: [blueLabel()],
            pageInfo: { hasNextPage: false },
          },
        },
      });
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(input.projects[0].name, "Misc 2026-06");
});

test("missing write token fails before mutation", async () => {
  await assert.rejects(
    () =>
      applyMiscProjectRoute({
        plan: routePlan(),
        env: {},
        fetchImpl: async () => {
          throw new Error("should not fetch");
        },
      }),
    /Set LINEAR_API_TOKEN or LINEAR_API_KEY to write Linear misc project routing/
  );
});

test("expected mutation payload assigns the project and missing label", async () => {
  const plan = routePlan();
  const requests = [];
  const result = await applyMiscProjectRoute({
    plan,
    token: "linear-token",
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);

      if (request.query.includes("issueUpdate")) {
        return jsonResponse({
          data: {
            issueUpdate: {
              success: true,
              issue: {
                id: "issue-demo",
                identifier: "100-123",
                project: { id: "misc-project-id", name: "Misc 2026-06" },
              },
            },
          },
        });
      }

      return jsonResponse({
        data: {
          issueLabelAdd: {
            success: true,
            issue: {
              id: "issue-demo",
              identifier: "100-123",
              labels: { nodes: [{ id: "blue-label-id", name: "blue" }] },
            },
          },
        },
      });
    },
  });

  assert.equal(result.operation, "mutated");
  assert.deepEqual(requests[0].variables, {
    id: "issue-demo",
    projectId: "misc-project-id",
  });
  assert.deepEqual(requests[1].variables, {
    issueId: "issue-demo",
    labelId: "blue-label-id",
  });
  assert.deepEqual(plan.mutationPayload, {
    issueUpdate: {
      id: "issue-demo",
      input: { projectId: "misc-project-id" },
    },
    issueLabelAdd: [
      {
        input: {
          issueId: "issue-demo",
          labelId: "blue-label-id",
        },
      },
    ],
    mutations: [
      {
        name: "issueUpdate",
        variables: { id: "issue-demo", projectId: "misc-project-id" },
      },
      {
        name: "issueLabelAdd",
        variables: { issueId: "issue-demo", labelId: "blue-label-id" },
      },
    ],
  });
});

test("buildRouteMutationPayload skips label mutation when label already exists", () => {
  const payload = buildRouteMutationPayload({
    issue: demoIssue({
      labels: { nodes: [{ id: "blue-label-id", name: "blue" }] },
    }),
    project: resolvedMiscProject(),
    labels: [{ id: "blue-label-id", name: "blue", operation: "present" }],
  });

  assert.deepEqual(payload.issueLabelAdd, []);
  assert.deepEqual(payload.mutations, [
    {
      name: "issueUpdate",
      variables: { id: "issue-demo", projectId: "misc-project-id" },
    },
  ]);
});

test("ticket-start routing skips already-project issues without invoking the router", async () => {
  let routeCalls = 0;
  const existingProject = {
    id: "existing-project-id",
    name: "Existing Project",
    url: "https://linear.app/project/existing",
  };

  const result = await routeMiscProjectOnTicketStart("100-123", {
    token: "linear-token",
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.equal(request.variables.issueId, "100-123");
      assert.match(request.query, /SymphonyMiscProjectTicketStartDecision/);

      return jsonResponse({
        data: {
          issue: demoIssue({ project: existingProject }),
        },
      });
    },
    routeIssue: async () => {
      routeCalls += 1;
      throw new Error("router should not be called");
    },
  });

  assert.equal(routeCalls, 0);
  assert.equal(result.action, "skipped");
  assert.equal(result.shouldMutate, false);
  assert.equal(result.dryRun, false);
  assert.equal(result.reason, "issue-already-has-project");
  assert.deepEqual(result.previousProject, existingProject);
});

test("ticket-start routing invokes the router once for no-project issues", async () => {
  let routeCalls = 0;
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.variables.issueId, "100-123");
    assert.match(request.query, /SymphonyMiscProjectTicketStartDecision/);

    return jsonResponse({
      data: {
        issue: demoIssue(),
      },
    });
  };

  const result = await routeMiscProjectOnTicketStart("100-123", {
    token: "linear-token",
    fetchImpl,
    routeIssue: async (issueId, options) => {
      routeCalls += 1;
      assert.equal(issueId, "100-123");
      assert.equal(options.dryRun, false);
      assert.equal(options.token, "linear-token");
      assert.equal(options.fetchImpl, fetchImpl);

      return {
        action: "route",
        shouldMutate: true,
        dryRun: false,
        reason: "eligible-team-issue-without-project",
        linearApiResult: { operation: "mutated", success: true },
      };
    },
  });

  assert.equal(routeCalls, 1);
  assert.equal(result.action, "route");
  assert.equal(result.dryRun, false);
  assert.equal(result.linearApiResult.operation, "mutated");
});

function routePlan() {
  return planMiscProjectRoute({
    issue: demoIssue(),
    projects: [miscProject()],
    issueLabels: [blueLabel()],
    actor,
  });
}

function demoIssue(overrides = {}) {
  return {
    id: "issue-demo",
    identifier: "100-123",
    title: "Route me",
    url: "https://linear.app/example-workspace/issue/100-123/route-me",
    team: { key: "100", name: "Symphony" },
    project: null,
    labels: { nodes: [] },
    ...overrides,
  };
}

function miscProject(overrides = {}) {
  return {
    id: "misc-project-id",
    name: "Misc 2026-06",
    url: "https://linear.app/example-workspace/project/misc-2026-06",
    state: "started",
    content: metadata({
      "project-code": "misc",
      "project-color": "blue",
      "base-branch": "main",
      "human-lead": "Example Lead",
    }),
    description: "",
    ...overrides,
  };
}

function resolvedMiscProject() {
  return resolveActiveMiscProject([miscProject()], { issue: demoIssue() });
}

function blueLabel() {
  return { id: "blue-label-id", name: "blue" };
}

function metadata(values) {
  return Object.entries(values)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}
