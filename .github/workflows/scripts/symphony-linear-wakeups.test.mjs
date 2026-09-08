import yaml from "js-yaml";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  parseCadenceWorkpad,
  renderCadenceWorkpad,
  renderCadenceWorkpadForLinear,
  resolveWorkpadInput,
} from "../../../scripts/cadence-linear-workpad.mjs";
import {
  applyWakeup,
  createGitHubClient,
  planWakeups,
  resolveIssue,
  runBridge,
  workflowTicket,
} from "./symphony-linear-wakeups.mjs";

const repo = "example-org/example-repo";
const head = "a".repeat(40);
const base = "b".repeat(40);
const branch = "symphony/sample-workpad/DEMO-502/github-linear-wakeups";
const runUrl = `https://github.com/${repo}/actions/runs/123`;
const pr = (overrides = {}) => ({
  number: 42,
  title: "[DEMO-502]: wake Linear",
  state: "open",
  html_url: `https://github.com/${repo}/pull/42`,
  labels: [{ name: "symphony" }, { name: "yellow" }],
  head: { sha: head, ref: branch, repo: { full_name: repo } },
  base: { sha: base, ref: "main", repo: { full_name: repo } },
  mergeable: false,
  mergeable_state: "dirty",
  ...overrides,
});
const check = (overrides = {}) => ({
  databaseId: 99,
  name: "tooling-check",
  conclusion: "FAILURE",
  detailsUrl: `${runUrl}/job/99`,
  checkSuite: {
    app: { databaseId: 15368 },
    workflowRun: { workflow: { id: "workflow-1" } },
  },
  isRequired: true,
  ...overrides,
});
const workflow = (overrides = {}) => ({
  id: 123,
  run_attempt: 1,
  name: "PR Checks",
  path: ".github/workflows/checks.yml",
  event: "pull_request",
  status: "completed",
  conclusion: "failure",
  head_sha: head,
  head_branch: branch,
  head_repository: { full_name: repo },
  pull_requests: [{ number: 42 }],
  html_url: runUrl,
  actor: { login: "example-symphony-bot" },
  ...overrides,
  // Model the rendered run-name in both fields when a display title is supplied.
  ...(overrides.display_title ? { name: overrides.display_title } : {}),
});
const event = (overrides = {}) => ({
  action: "completed",
  workflow_run: workflow(),
  ...overrides,
});
const github = (overrides = {}) => ({
  getPr: async () => pr(),
  listPrs: async () => [pr()],
  commitPrs: async () => [pr()],
  checks: async () => [check()],
  getRun: async () => workflow(),
  ...overrides,
});
const plan = (overrides = {}) =>
  planWakeups({
    repo,
    eventName: "workflow_run",
    payload: event(),
    github: github(),
    bridgeRunUrl: `${runUrl}4`,
    ...overrides,
  });

const active = { id: "active", name: "Active", type: "started" };
const inactive = { id: "inactive", name: "Inactive", type: "unstarted" };
const fixtureIssue = () => ({
  id: "issue-502",
  identifier: "DEMO-502",
  state: inactive,
  team: { states: { nodes: [active] } },
  labels: { nodes: [{ name: "yellow" }] },
  project: {
    id: "project",
    content:
      "project-code: sample-workpad\nproject-color: yellow\nhuman-lead: Example Lead",
  },
});
const response = (data, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => ({ data }),
});

function linearFixture(options = {}) {
  let issue = { ...fixtureIssue(), ...options.issue };
  let comment = options.noWorkpad
    ? null
    : {
        id: "cadence-pad",
        createdAt: "2026-09-07T00:00:00Z",
        body:
          options.body ||
          renderCadenceWorkpadForLinear({
            lastReviewedSha: "reviewed-sha",
            summary: "Keep review",
            coordination: { reviewHandoff: { keep: true } },
          }).body,
      };
  const calls = [];
  let reads = 0;
  return {
    calls,
    get issue() {
      return issue;
    },
    get comment() {
      return comment;
    },
    async fetchImpl(url, request) {
      assert.equal(url, "https://api.linear.app/graphql");
      const { query, variables } = JSON.parse(request.body);
      calls.push({ query, variables });
      if (query.includes("WakeupViewer"))
        return response({
          viewer: options.viewer || { id: "cadence-bot", name: "Example Review Bot" },
        });
      if (query.includes("CadenceWorkpadIssue"))
        return response({
          issue: {
            id: issue.id,
            identifier: issue.identifier,
            comments: {
              nodes: [
                ...(comment ? [comment] : []),
                { id: "codex", body: "## Codex Workpad\nDo not overwrite" },
                { id: "engine", body: "## Symphony Workpad\nLast run" },
              ],
              pageInfo: { hasNextPage: false },
            },
          },
        });
      if (query.includes("WakeupWorkpadCreate")) {
        if (options.createFailure)
          return response({ commentCreate: { success: false } });
        comment = { id: "cadence-pad", body: variables.body };
        return response({
          commentCreate: { success: true, comment: { id: comment.id } },
        });
      }
      if (query.includes("WakeupWorkpadUpdate")) {
        assert.equal(variables.id, "cadence-pad");
        if (options.writeFailure)
          return response({ commentUpdate: { success: false } });
        comment.body = variables.body;
        return response({
          commentUpdate: { success: true, comment: { id: comment.id } },
        });
      }
      if (query.includes("LinearWakeupIssueUpdate")) {
        if (options.mutationFailure)
          return response({ issueUpdate: { success: false } });
        issue = {
          ...issue,
          state: issue.team.states.nodes.find(
            (state) => state.id === variables.stateId
          ),
        };
        return response({
          issueUpdate: {
            success: true,
            issue: {
              ...issue,
              ...(options.wrongMutation ? { id: "wrong-issue" } : {}),
            },
          },
        });
      }
      if (query.includes("LinearWakeupIssue")) {
        reads++;
        if (options.cancelDuringWrite && reads === 2)
          issue.state = { id: "canceled", name: "Canceled", type: "canceled" };
        return response({ issue });
      }
      if (query.includes("WakeupProject")) return response({ issue });
      throw new Error(`Unexpected query: ${query}`);
    },
  };
}
const mutations = (fixture) =>
  fixture.calls.filter((call) =>
    call.query.includes("LinearWakeupIssueUpdate")
  );

test("required failure from Actions workflow completion uses the current required check", async () => {
  const [result] = await plan();
  assert.equal(result.shouldWake, true);
  assert.equal(result.issueIdentifier, "DEMO-502");
  assert.equal(result.reason, "required-check-failed");
  assert.equal(result.checkName, "tooling-check");
  assert.equal(result.headSha, head);
});

test("external check and status failures match current required evidence", async () => {
  const [external] = await plan({
    eventName: "check_run",
    payload: {
      action: "completed",
      check_run: {
        id: 99,
        status: "completed",
        conclusion: "failure",
        head_sha: head,
      },
    },
  });
  assert.equal(external.shouldWake, true);
  const [status] = await plan({
    eventName: "status",
    payload: { state: "error", sha: head, context: "CI" },
    github: github({
      checks: async () => [
        { context: "CI", state: "ERROR", isRequired: true, targetUrl: runUrl },
      ],
    }),
  });
  assert.equal(status.shouldWake, true);
});

test("successful checks are no-ops without API reads", async () => {
  const [result] = await plan({
    payload: event({ workflow_run: workflow({ conclusion: "success" }) }),
    github: {},
  });
  assert.equal(result.shouldWake, false);
  assert.equal(result.skippedReason, "successful-or-nonfailure-check");
});

for (const [name, checks] of [
  ["optional check", [check({ isRequired: false })]],
  ["recovered check", [check({ conclusion: "SUCCESS" })]],
  ["different workflow", [check({ detailsUrl: `${runUrl}9/job/99` })]],
])
  test(`${name} does not wake from a failed workflow`, async () => {
    const [result] = await plan({
      github: github({ checks: async () => checks }),
    });
    assert.equal(result.shouldWake, false);
  });

test("current merge conflict wakes and schedule reads the current base", async () => {
  for (const eventName of ["pull_request_target", "schedule"]) {
    const [result] = await plan({
      eventName,
      payload: eventName === "schedule" ? {} : { pull_request: pr() },
    });
    assert.equal(result.shouldWake, true);
    assert.equal(result.reason, "merge-conflict");
    assert.equal(result.baseSha, base);
  }
});

test("persisting conflicts are not re-woken just because the base advances", async () => {
  const fixture = linearFixture();
  for (const sha of [base, "c".repeat(40)]) {
    const [result] = await runBridge({
      eventName: "schedule",
      payload: {},
      repo,
      linearToken: "fixture",
      fetchImpl: fixture.fetchImpl,
      github: github({
        getPr: async () => pr({ base: { ...pr().base, sha } }),
      }),
    });
    assert.equal(result.operation, sha === base ? "updated" : "skipped");
    fixture.issue.state = inactive;
  }
  assert.equal(mutations(fixture).length, 1);
});

test("stale conflict and stale check events never wake the new head", async () => {
  const newer = github({
    getPr: async () => pr({ head: { ...pr().head, sha: "c".repeat(40) } }),
  });
  const [conflict] = await plan({
    eventName: "pull_request_target",
    payload: { pull_request: pr() },
    github: newer,
  });
  const [ci] = await plan({ github: newer });
  assert.equal(conflict.skippedReason, "stale-pr-head");
  assert.equal(ci.skippedReason, "stale-pr-head");
});

test("unknown or clean mergeability is not a conflict", async () => {
  for (const overrides of [
    { mergeable: null, mergeable_state: "unknown" },
    { mergeable: true, mergeable_state: "clean" },
  ]) {
    const [result] = await plan({
      eventName: "schedule",
      payload: {},
      github: github({ getPr: async () => pr(overrides) }),
    });
    assert.equal(result.shouldWake, false);
  }
});

test("workflow marker resolves an explicit issue without inputs or PRs", async () => {
  const [result] = await plan({
    payload: event({
      workflow_run: workflow({
        event: "workflow_dispatch",
        display_title: "[linear:DEMO-600] Validate",
        pull_requests: [],
        conclusion: "success",
      }),
    }),
    github: github({ listPrs: async () => [] }),
  });
  assert.equal(result.shouldWake, true);
  assert.equal(result.issueIdentifier, "DEMO-600");
  assert.equal(result.identitySource, "ticket_number");
  assert.equal(result.reason, "workflow-completed");
});

test("workflow completion resolves a PR title before branch with empty payload PR list", async () => {
  const [result] = await plan({
    payload: event({
      workflow_run: workflow({
        event: "workflow_dispatch",
        pull_requests: [],
        conclusion: "success",
      }),
    }),
    github: github({
      getPr: async () => pr({ title: "[DEMO-600]: validation" }),
    }),
  });
  assert.equal(result.issueIdentifier, "DEMO-600");
  assert.equal(result.identitySource, "pr-title");
});

test("workflow branch fallback supports issue-scoped validation without a PR", async () => {
  const [result] = await plan({
    payload: event({
      workflow_run: workflow({
        name: "Validate",
        event: "workflow_dispatch",
        pull_requests: [],
        conclusion: "success",
      }),
    }),
    github: github({ listPrs: async () => [] }),
  });
  assert.equal(result.issueIdentifier, "DEMO-502");
  assert.equal(result.identitySource, "branch");
});

test("unticketed manual runs and bridge completions are no-ops", async () => {
  const [manual] = await plan({
    payload: event({
      workflow_run: workflow({
        event: "workflow_dispatch",
        pull_requests: [],
        head_branch: "main",
      }),
    }),
    github: github({ listPrs: async () => [] }),
  });
  const [recursive] = await plan({
    payload: event({ workflow_run: workflow({ event: "workflow_run" }) }),
    github: {},
  });
  assert.equal(manual.skippedReason, "workflow-not-issue-scoped");
  assert.equal(recursive.skippedReason, "bridge-recursion");
});

test("missing, malformed and ambiguous issue candidates fail closed", async () => {
  for (const ticketNumber of [
    "502",
    "DEMO-1 DEMO-2",
    "demo-502",
    "DEMO-502] [linear:DEMO-2",
  ])
    assert.throws(() => resolveIssue({ ticketNumber }), /Invalid explicit/);
  assert.throws(
    () => workflowTicket({ display_title: "[linear:] Validate" }),
    /Invalid explicit/
  );
  assert.throws(() => resolveIssue({ branch: "main" }), /Missing or ambiguous/);
  assert.throws(() => resolveIssue({ branch: "DEMO-1-and-DEMO-2" }), /ambiguous/);
  assert.equal(
    resolveIssue({
      ticketNumber: "DEMO-3",
      pullRequests: [pr()],
      branch: "DEMO-1-DEMO-2",
    }).issueIdentifier,
    "DEMO-3"
  );
  await assert.rejects(
    plan({
      github: github({
        getPr: async (number) =>
          pr({ number, title: `[DEMO-${number}]: change` }),
      }),
      payload: event({
        workflow_run: workflow({
          pull_requests: [{ number: 42 }, { number: 43 }],
        }),
      }),
    }),
    /Ambiguous/
  );
});

test("fork, missing SHA, and stale workflow PR evidence fail closed", async () => {
  await assert.rejects(
    plan({
      payload: event({
        workflow_run: workflow({ head_repository: { full_name: "fork/repo" } }),
      }),
    }),
    /repository mismatch/
  );
  await assert.rejects(
    plan({ payload: event({ workflow_run: workflow({ head_sha: "" }) }) }),
    /Missing event head/
  );
  const [stale] = await plan({
    payload: event({ workflow_run: workflow({ event: "workflow_dispatch" }) }),
    github: github({
      getPr: async () => pr({ head: { ...pr().head, sha: "old" } }),
    }),
  });
  assert.equal(stale.skippedReason, "stale-workflow-head");
});

test("fixture proof: failed check, conflict and Symphony workflow completion wake Active", async (t) => {
  const cases = [
    { name: "required-check", eventName: "workflow_run", payload: event() },
    {
      name: "merge-conflict",
      eventName: "pull_request_target",
      payload: { pull_request: pr(), sender: { login: "example-symphony-bot" } },
    },
    {
      name: "validation-completion",
      eventName: "workflow_run",
      payload: event({
        workflow_run: workflow({
          path: ".github/workflows/validate.yml",
          event: "workflow_dispatch",
          pull_requests: [],
          conclusion: "success",
        }),
      }),
    },
  ];
  for (const item of cases) {
    const fixture = linearFixture();
    const [result] = await runBridge({
      ...item,
      repo,
      github: github({ getRun: async () => item.payload.workflow_run }),
      linearToken: "fixture-token",
      fetchImpl: fixture.fetchImpl,
      bridgeRunUrl: `${runUrl}4`,
    });
    assert.equal(result.operation, "updated", JSON.stringify(result));
    assert.equal(result.issueIdentifier, "DEMO-502");
    assert.equal(result.previousState, "Inactive");
    assert.equal(result.state, "Active");
    assert.deepEqual(mutations(fixture)[0].variables, {
      id: "issue-502",
      stateId: "active",
    });
    const saved = parseCadenceWorkpad(fixture.comment.body);
    assert.equal(saved.lastReviewedSha, "reviewed-sha");
    assert.deepEqual(saved.coordination.reviewHandoff, { keep: true });
    assert.equal(saved.coordination.lastNonReviewWakeup.mutation.success, true);
    t.diagnostic(`MOCK API FIXTURE ${item.name}: ${JSON.stringify(result)}`);
  }
});

for (const name of ["Canceled", "Done", "Duplicate"])
  test(`terminal ${name} is recorded without reopening`, async () => {
    const fixture = linearFixture({ issue: { state: { id: name, name } } });
    const [eventPlan] = await plan();
    const result = await applyWakeup({
      plan: eventPlan,
      github: github(),
      repo,
      token: "fixture",
      fetchImpl: fixture.fetchImpl,
    });
    assert.equal(result.skippedReason, `terminal-state:${name}`);
    assert.equal(mutations(fixture).length, 0);
    const writes = () =>
      fixture.calls.filter((call) => call.query.includes("WakeupWorkpadUpdate"))
        .length;
    const before = writes();
    const body = fixture.comment.body;
    const duplicate = await applyWakeup({
      plan: eventPlan,
      github: github(),
      repo,
      token: "fixture",
      fetchImpl: fixture.fetchImpl,
    });
    assert.equal(duplicate.skippedReason, "duplicate-event");
    assert.equal(writes(), before);
    assert.equal(fixture.comment.body, body);
  });

test("post-mutation evidence failures retain the confirmed outcome and retry only evidence", async () => {
  for (const permanent of [false, true]) {
    const fixture = linearFixture();
    let attempts = 0;
    const fetchImpl = async (url, request) => {
      const { query } = JSON.parse(request.body);
      if (mutations(fixture).length && query.includes("WakeupWorkpadUpdate")) {
        attempts++;
        if (permanent || attempts === 1)
          return response({ commentUpdate: { success: false } });
      }
      return fixture.fetchImpl(url, request);
    };
    const [eventPlan] = await plan();
    const result = await applyWakeup({
      plan: eventPlan,
      github: github(),
      repo,
      token: "fixture",
      fetchImpl,
    });
    assert.equal(result.operation, "updated");
    assert.equal(result.mutation.success, true);
    assert.match(
      result.evidenceError,
      /Could not update pinned bridge workpad/
    );
    assert.equal(mutations(fixture).length, 1);
    assert.equal(attempts, 2);
    if (!permanent) {
      fixture.issue.state = inactive;
      const duplicate = await applyWakeup({
        plan: eventPlan,
        github: github(),
        repo,
        token: "fixture",
        fetchImpl,
      });
      assert.equal(duplicate.skippedReason, "duplicate-event");
      assert.equal(mutations(fixture).length, 1);
    }
  }
});

test("large API errors cannot fill the bridge ledger", async () => {
  const fixture = linearFixture();
  const [eventPlan] = await plan();
  const result = await applyWakeup({
    plan: eventPlan,
    repo,
    token: "fixture",
    fetchImpl: fixture.fetchImpl,
    github: github({
      getPr: async () => {
        throw new Error("large API error ".repeat(10000));
      },
    }),
  });
  assert.equal(result.operation, "failed");
  assert.match(result.error, /truncated for Linear limit/);
  assert.ok(result.error.length <= 1200);
  assert.ok(fixture.comment.body.length < 15000);
  assert.equal(
    parseCadenceWorkpad(fixture.comment.body).coordination.lastNonReviewWakeup
      .error,
    result.error
  );
});

test("missing Active uses explicit legacy Rework fallback", async () => {
  const fixture = linearFixture({
    issue: { team: { states: { nodes: [{ id: "rework", name: "Rework" }] } } },
  });
  const [eventPlan] = await plan();
  const result = await applyWakeup({
    plan: eventPlan,
    github: github(),
    repo,
    token: "fixture",
    fetchImpl: fixture.fetchImpl,
  });
  assert.equal(result.state, "Rework");
  assert.equal(result.fallback, "Active missing; using legacy Rework");
});

test("missing safe state, project metadata, or required labels prevents a mutation", async () => {
  for (const issue of [
    { team: { states: { nodes: [] } } },
    { project: null },
    { labels: { nodes: [] } },
    {
      project: {
        ...fixtureIssue().project,
        content:
          "project-code: wrong\nproject-color: yellow\nhuman-lead: Example",
      },
    },
  ]) {
    const fixture = linearFixture({ issue });
    const [eventPlan] = await plan();
    const result = await applyWakeup({
      plan: eventPlan,
      github: github(),
      repo,
      token: "fixture",
      fetchImpl: fixture.fetchImpl,
    });
    assert.equal(result.operation, "failed");
    assert.equal(mutations(fixture).length, 0);
    assert.match(fixture.comment.body, /failed/);
  }
});

test("cancellation during evidence write is rechecked before mutation", async () => {
  const fixture = linearFixture({ cancelDuringWrite: true });
  const [eventPlan] = await plan();
  const result = await applyWakeup({
    plan: eventPlan,
    github: github(),
    repo,
    token: "fixture",
    fetchImpl: fixture.fetchImpl,
  });
  assert.equal(result.skippedReason, "terminal-state:Canceled");
  assert.equal(mutations(fixture).length, 0);
});

test("a changed head or recovered check before mutation is skipped", async () => {
  const [eventPlan] = await plan();
  for (const client of [
    github({ getPr: async () => pr({ head: { ...pr().head, sha: "new" } }) }),
    github({ checks: async () => [check({ conclusion: "SUCCESS" })] }),
  ]) {
    const fixture = linearFixture();
    const result = await applyWakeup({
      plan: eventPlan,
      github: client,
      repo,
      token: "fixture",
      fetchImpl: fixture.fetchImpl,
    });
    assert.equal(result.operation, "skipped");
    assert.match(result.skippedReason, /changed-before-wakeup/);
    assert.equal(mutations(fixture).length, 0);
  }
});

test("workpad creation and update failures block state changes", async () => {
  for (const options of [
    { noWorkpad: true },
    { noWorkpad: true, createFailure: true },
    { writeFailure: true },
  ]) {
    const fixture = linearFixture(options);
    const [eventPlan] = await plan();
    const result = await applyWakeup({
      plan: eventPlan,
      github: github(),
      repo,
      token: "fixture",
      fetchImpl: fixture.fetchImpl,
    });
    assert.equal(
      result.operation,
      options.createFailure || options.writeFailure ? "failed" : "updated"
    );
    if (result.operation === "failed")
      assert.equal(mutations(fixture).length, 0);
  }
});

test("bot identity and missing token fail closed", async () => {
  const [eventPlan] = await plan();
  for (const token of [undefined, "fixture"]) {
    const fixture = linearFixture({
      viewer: { id: "human", name: "Example Lead" },
    });
    const result = await applyWakeup({
      plan: eventPlan,
      github: github(),
      repo,
      token,
      fetchImpl: fixture.fetchImpl,
    });
    assert.equal(result.operation, "failed");
    assert.equal(mutations(fixture).length, 0);
  }
});

test("mutation rejection and wrong returned issue preserve attempted mutation evidence", async () => {
  for (const options of [{ mutationFailure: true }, { wrongMutation: true }]) {
    const fixture = linearFixture(options);
    const [eventPlan] = await plan();
    const result = await applyWakeup({
      plan: eventPlan,
      github: github(),
      repo,
      token: "fixture",
      fetchImpl: fixture.fetchImpl,
    });
    assert.equal(result.operation, "failed");
    assert.equal(result.mutation.success, false);
    assert.equal(result.state, "Inactive");
  }
});

test("repeat delivery is deduplicated without replacing existing evidence", async () => {
  const fixture = linearFixture();
  const [eventPlan] = await plan();
  const options = {
    plan: eventPlan,
    github: github(),
    repo,
    token: "fixture",
    fetchImpl: fixture.fetchImpl,
  };
  await applyWakeup(options);
  const result = await applyWakeup(options);
  assert.equal(result.skippedReason, "duplicate-event");
  assert.equal(mutations(fixture).length, 1);
});

test("bounded ledger preserves review state, migrates full records, and survives review updates", async () => {
  const [eventPlan] = await plan();
  const fixture = linearFixture({
    body: renderCadenceWorkpad({
      lastReviewedSha: "reviewed-sha",
      summary: "Keep review",
      findings: [{ id: "F1", summary: "Keep this finding" }],
      coordination: {
        reviewHandoff: { keep: true },
        nonReviewWakeups: Array.from({ length: 15 }, (_, i) => ({
          ...eventPlan,
          key: `legacy-${i}`,
          operation: "updated",
        })),
      },
    }),
  });
  const before = parseCadenceWorkpad(fixture.comment.body);
  for (let i = 0; i < 40; i++) {
    fixture.issue.state = inactive;
    const result = await applyWakeup({
      plan: { ...eventPlan, key: `event-${i}` },
      github: github(),
      repo,
      token: "fixture",
      fetchImpl: fixture.fetchImpl,
    });
    assert.equal(result.operation, "updated");
    assert.ok(fixture.comment.body.length < 15000);
    const saved = parseCadenceWorkpad(fixture.comment.body);
    assert.equal(saved.summary, before.summary);
    assert.equal(saved.lastReviewedSha, before.lastReviewedSha);
    assert.deepEqual(saved.findings, before.findings);
    assert.deepEqual(saved.coordination.reviewHandoff, { keep: true });
    assert.equal(saved.coordination.nonReviewWakeups.length, 10);
    for (const item of saved.coordination.nonReviewWakeups)
      assert.ok(
        Object.keys(item).every((key) =>
          [
            "key",
            "operation",
            "reason",
            "skippedReason",
            "issueIdentifier",
            "at",
          ].includes(key)
        )
      );
    assert.equal(saved.coordination.lastNonReviewWakeup.key, `event-${i}`);
    assert.equal(saved.coordination.lastNonReviewWakeup.mutation.success, true);
  }
  // A review-gate write and a human parking the issue must not undo dedup.
  fixture.comment.body = renderCadenceWorkpad(
    resolveWorkpadInput({
      existingBody: fixture.comment.body,
      incomingWorkpad: {
        status: "review-requested",
        coordination: { trigger: "review" },
      },
    })
  );
  fixture.issue.state = inactive;
  const result = await applyWakeup({
    plan: { ...eventPlan, key: "event-38" },
    github: github(),
    repo,
    token: "fixture",
    fetchImpl: fixture.fetchImpl,
  });
  assert.equal(result.skippedReason, "duplicate-event");
  assert.equal(mutations(fixture).length, 40);
  assert.equal(fixture.issue.state.name, "Inactive");
});

test("near-limit review display never prevents evidence writes or loses canonical state", async () => {
  const template = {
    summary: "",
    lastReviewedSha: "reviewed-head",
    findings: [{ id: "F1", summary: "Preserve the full finding" }],
  };
  const empty = renderCadenceWorkpad(template);
  for (const size of [42000, 45000, 47615, 49800]) {
    const original = {
      ...template,
      summary: "r".repeat(Math.floor((size - empty.length) / 2)),
    };
    const fixture = linearFixture({ body: renderCadenceWorkpad(original) });
    assert.ok(fixture.comment.body.length <= size);
    const before = parseCadenceWorkpad(fixture.comment.body);
    const [eventPlan] = await plan();
    // Fill the complete ledger, then update it again on the lossless layout.
    for (let index = 0; index < 12; index++) {
      fixture.issue.state = inactive;
      const result = await applyWakeup({
        plan: { ...eventPlan, key: `size-${size}-${index}` },
        github: github(),
        repo,
        token: "fixture",
        fetchImpl: fixture.fetchImpl,
      });
      assert.equal(result.operation, "updated", JSON.stringify(result));
      assert.ok(fixture.comment.body.length <= 50000);
      const saved = parseCadenceWorkpad(fixture.comment.body);
      assert.deepEqual({ ...saved, coordination: before.coordination }, before);
      assert.equal(
        saved.coordination.lastNonReviewWakeup.mutation.success,
        true
      );
    }
    assert.equal(mutations(fixture).length, 12);
    assert.equal(
      parseCadenceWorkpad(fixture.comment.body).coordination.nonReviewWakeups
        .length,
      10
    );
  }
});

test("bridge evidence retains a textual Cadence coordination summary", async () => {
  const fixture = linearFixture({
    body: renderCadenceWorkpad({ coordination: "Review awaiting evidence" }),
  });
  const [eventPlan] = await plan();
  const result = await applyWakeup({
    plan: eventPlan,
    github: github(),
    repo,
    token: "fixture",
    fetchImpl: fixture.fetchImpl,
  });
  assert.equal(result.operation, "updated");
  assert.equal(
    parseCadenceWorkpad(fixture.comment.body).coordination.reviewCoordination,
    "Review awaiting evidence"
  );
});

test("canonical state that cannot fit still fails before data loss or issue mutation", async () => {
  const body = renderCadenceWorkpad({
    summary: "r".repeat(51000),
  });
  const fixture = linearFixture({ body });
  const [eventPlan] = await plan();
  const result = await applyWakeup({
    plan: eventPlan,
    github: github(),
    repo,
    token: "fixture",
    fetchImpl: fixture.fetchImpl,
  });
  assert.equal(result.operation, "failed");
  assert.match(result.error, /would compact Cadence review state/);
  assert.equal(fixture.comment.body, body);
  assert.equal(mutations(fixture).length, 0);
  assert.equal(
    fixture.calls.filter((call) => call.query.includes("WakeupWorkpadUpdate"))
      .length,
    0
  );
});

test("schedule skips unmanaged and unresolvable PRs and still wakes a later valid conflict", async () => {
  const prs = [
    pr({ number: 1, labels: [] }),
    pr({ number: 2, head: { ...pr().head, repo: { full_name: "fork/repo" } } }),
    pr({
      number: 3,
      title: "Missing identifier",
      head: { ...pr().head, ref: "symphony/missing" },
    }),
    pr(),
  ];
  const results = await plan({
    eventName: "schedule",
    payload: {},
    github: github({
      listPrs: async () => prs,
      getPr: async (n) => prs.find((p) => p.number === n),
    }),
  });
  assert.equal(results.length, 3);
  assert.deepEqual(
    results.filter((p) => p.shouldWake).map((p) => p.prNumber),
    [42]
  );
  assert.ok(
    results
      .slice(0, 2)
      .every((p) => p.skippedReason === "unresolvable-scheduled-pr")
  );
  assert.match(results[0].error, /repository mismatch/);
  assert.match(results[1].error, /Missing or ambiguous/);
});

test("a fork PR cannot pass the mutation-time repository guard", async () => {
  const fixture = linearFixture();
  const [eventPlan] = await plan();
  const result = await applyWakeup({
    plan: eventPlan,
    repo,
    token: "fixture",
    fetchImpl: fixture.fetchImpl,
    github: github({
      getPr: async () =>
        pr({ head: { ...pr().head, repo: { full_name: "fork/repo" } } }),
    }),
  });
  assert.match(result.error, /repository mismatch/);
  assert.equal(mutations(fixture).length, 0);
});

test("errors redact both credentials before evidence persistence and output", async () => {
  const fixture = linearFixture();
  let reads = 0;
  const [result] = await runBridge({
    repo,
    token: "github-secret",
    linearToken: "linear-secret",
    eventName: "workflow_run",
    payload: event(),
    fetchImpl: fixture.fetchImpl,
    github: github({
      getPr: async () => {
        if (++reads > 1)
          throw new Error("API failure github-secret linear-secret");
        return pr();
      },
    }),
  });
  assert.equal(result.operation, "failed");
  assert.match(result.error, /API failure \[REDACTED\] \[REDACTED\]/);
  assert.doesNotMatch(
    JSON.stringify(result) + fixture.comment.body,
    /github-secret|linear-secret/
  );
  assert.equal(mutations(fixture).length, 0);
});

test("workflow rerun invalidates completion before any Linear write", async () => {
  const run = workflow({
    event: "workflow_dispatch",
    display_title: "[linear:DEMO-502] Validate",
  });
  const [eventPlan] = await plan({ payload: event({ workflow_run: run }) });
  const fixture = linearFixture();
  const result = await applyWakeup({
    plan: eventPlan,
    repo,
    token: "fixture",
    fetchImpl: fixture.fetchImpl,
    github: github({
      getRun: async () => ({ ...run, run_attempt: 2, status: "in_progress" }),
    }),
  });
  assert.equal(result.skippedReason, "workflow-changed-before-wakeup");
  assert.equal(fixture.calls.length, 0);
});

test("changed PR ticket prefix cannot wake the previously resolved issue", async () => {
  const [eventPlan] = await plan();
  const fixture = linearFixture();
  const result = await applyWakeup({
    plan: eventPlan,
    repo,
    token: "fixture",
    fetchImpl: fixture.fetchImpl,
    github: github({
      getPr: async () => pr({ title: "[DEMO-700]: changed owner" }),
    }),
  });
  assert.match(result.error, /identity changed/);
  assert.equal(mutations(fixture).length, 0);
});

test("production GitHub and Linear adapters route a failed workflow fixture end to end", async () => {
  const fixture = linearFixture();
  const paths = [];
  const fetchImpl = async (url, request) => {
    if (url === "https://api.linear.app/graphql")
      return fixture.fetchImpl(url, request);
    paths.push(url);
    if (url === `https://api.github.com/repos/${repo}/pulls/42`)
      return { ok: true, json: async () => pr() };
    assert.equal(url, "https://api.github.com/graphql");
    return response({
      repository: {
        pullRequest: {
          headRefOid: head,
          commits: {
            nodes: [
              {
                commit: {
                  statusCheckRollup: {
                    contexts: {
                      nodes: [check()],
                      pageInfo: { hasNextPage: false },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    });
  };
  const [result] = await runBridge({
    repo,
    token: "github-fixture",
    linearToken: "linear-fixture",
    fetchImpl,
    eventName: "workflow_run",
    payload: event(),
    bridgeRunUrl: `${runUrl}4`,
  });
  assert.equal(result.operation, "updated", JSON.stringify(result));
  assert.equal(result.state, "Active");
  assert.equal(paths.filter((url) => url.endsWith("/graphql")).length, 2);
  assert.equal(mutations(fixture).length, 1);
});

test("GitHub permission failure produces durable run evidence with no Linear mutation", async () => {
  const [result] = await runBridge({
    repo,
    token: "github-fixture",
    linearToken: "linear-fixture",
    eventName: "workflow_run",
    payload: event(),
    bridgeRunUrl: `${runUrl}4`,
    fetchImpl: async (url) => {
      assert.ok(url.startsWith("https://api.github.com/"));
      return {
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      };
    },
  });
  assert.equal(result.operation, "failed");
  assert.match(result.error, /HTTP 403/);
  assert.equal(result.headSha, head);
  assert.equal(result.runUrl, runUrl);
});

test("GitHub adapter paginates current-head checks and newer reruns supersede failures", async () => {
  const calls = [];
  const client = createGitHubClient({
    repo,
    token: "fixture",
    fetchImpl: async (url, request) => {
      assert.equal(url, "https://api.github.com/graphql");
      const body = JSON.parse(request.body);
      calls.push(body.variables);
      const second = body.variables.after === "next";
      return response({
        repository: {
          pullRequest: {
            headRefOid: head,
            commits: {
              nodes: [
                {
                  commit: {
                    statusCheckRollup: {
                      contexts: {
                        nodes: [
                          second
                            ? check({ databaseId: 100, conclusion: null })
                            : check(),
                          // Same Actions app and job name, different workflow.
                          ...(!second
                            ? [
                                check({
                                  databaseId: 101,
                                  checkSuite: {
                                    app: { databaseId: 15368 },
                                    workflowRun: {
                                      workflow: { id: "workflow-2" },
                                    },
                                  },
                                }),
                              ]
                            : []),
                        ],
                        pageInfo: {
                          hasNextPage: !second,
                          endCursor: second ? null : "next",
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      });
    },
  });
  const checks = await client.checks(42, head);
  assert.equal(calls.length, 2);
  assert.equal(checks.length, 2);
  assert.equal(checks[0].conclusion, null);
  assert.equal(checks[1].conclusion, "FAILURE");
});

test("actual job condition rejects irrelevant events before runner allocation", async (t) => {
  const wake = yaml.load(
    readFileSync(
      new URL("../symphony-linear-wakeups.yml", import.meta.url),
      "utf8"
    )
  );
  // Evaluate the actual YAML expression's boolean operators and functions.
  // Only Actions array projections need translating for the JS fixture VM;
  // payload data is passed separately and is never interpolated as code.
  const expression = wake.jobs.wake.if
    .replace(
      "github.event.branches.*.name",
      "github.event.branches.map(x => x.name)"
    )
    .replace(
      "github.event.pull_request.labels.*.name",
      "github.event.pull_request.labels.map(x => x.name)"
    );
  const evaluate = (eventName, payload) =>
    Boolean(
      runInNewContext(expression, {
        github: { repository: repo, event_name: eventName, event: payload },
        contains: (value, item) =>
          Array.isArray(value)
            ? value.some(
                (x) => String(x).toLowerCase() === String(item).toLowerCase()
              )
            : String(value || "")
                .toLowerCase()
                .includes(String(item).toLowerCase()),
        startsWith: (value, prefix) =>
          String(value || "")
            .toLowerCase()
            .startsWith(prefix.toLowerCase()),
        fromJSON: JSON.parse,
        join: (value, separator) => value.join(separator),
        format: (value, item) => value.replace("{0}", item),
      })
    );
  const workflowCases = [
    ["failed Symphony check", {}, true],
    ["successful Symphony check", { conclusion: "success" }, false],
    [
      "Symphony validation completion",
      { event: "workflow_dispatch", conclusion: "success" },
      true,
    ],
    ["main failure with PR association", { head_branch: "main" }, false],
    ["main success", { head_branch: "main", conclusion: "success" }, false],
    ["human branch failure", { head_branch: "human/DEMO-502/fix" }, false],
    [
      "lookalike Symphony branch",
      { head_branch: "other-symphony/DEMO-502" },
      false,
    ],
    [
      "unrelated main validation with marker",
      {
        head_branch: "main",
        event: "workflow_dispatch",
        display_title: "[linear:DEMO-502] Validate",
      },
      false,
    ],
    ["recursive workflow", { event: "workflow_run" }, false],
    [
      "bridge itself with custom run name",
      {
        path: ".github/workflows/symphony-linear-wakeups.yml",
        display_title: "Bridge reconciliation on a custom run title",
      },
      false,
    ],
    ["fork workflow", { head_repository: { full_name: "fork/repo" } }, false],
  ];
  for (const conclusion of [
    "failure",
    "error",
    "timed_out",
    "cancelled",
    "action_required",
    "startup_failure",
  ]) {
    workflowCases.push([`required check ${conclusion}`, { conclusion }, true]);
  }
  for (const [name, overrides, expected] of workflowCases) {
    const payload = event({ workflow_run: workflow(overrides) });
    assert.equal(evaluate("workflow_run", payload), expected, name);
    if (expected) {
      const [result] = await plan({ payload });
      assert.equal(result.shouldWake, true, name);
    }
    if (!expected && name !== "fork workflow") {
      const [result] = await plan({ payload, github: {} });
      assert.equal(result.shouldWake, false, name);
    }
  }
  const external = {
    check_run: {
      conclusion: "failure",
      check_suite: { head_branch: branch, app: { slug: "external-ci" } },
    },
  };
  assert.equal(evaluate("check_run", external), true);
  assert.equal(
    evaluate("check_run", {
      check_run: { ...external.check_run, conclusion: "success" },
    }),
    false
  );
  assert.equal(
    evaluate("check_run", {
      check_run: {
        ...external.check_run,
        check_suite: { head_branch: "main", app: { slug: "external-ci" } },
      },
    }),
    false
  );
  assert.equal(
    evaluate("check_run", {
      check_run: {
        ...external.check_run,
        check_suite: { head_branch: branch, app: { slug: "github-actions" } },
      },
    }),
    false
  );
  assert.equal(
    evaluate("status", {
      state: "failure",
      branches: [{ name: "main" }, { name: branch }],
    }),
    true
  );
  assert.equal(
    evaluate("status", { state: "success", branches: [{ name: branch }] }),
    false
  );
  assert.equal(
    evaluate("status", {
      state: "failure",
      branches: [{ name: "main" }, { name: "other-symphony/DEMO-502" }],
    }),
    false
  );
  assert.equal(evaluate("pull_request_target", { pull_request: pr() }), true);
  assert.equal(
    evaluate("pull_request_target", { pull_request: pr({ labels: [] }) }),
    false
  );
  assert.equal(
    evaluate("pull_request_target", {
      pull_request: pr({
        head: { ...pr().head, repo: { full_name: "fork/repo" } },
      }),
    }),
    false
  );
  assert.equal(evaluate("schedule", {}), true);
  t.diagnostic(
    `${workflowCases.length} workflow completion cases plus check/status/PR/schedule gates evaluated from jobs.wake.if; no live runner or workflow dispatched.`
  );
});

test("workflow syntax keeps trusted checkout and generic completion triggers", () => {
  const read = (name) =>
    yaml.load(readFileSync(new URL(`../${name}.yml`, import.meta.url), "utf8"));
  const wake = read("symphony-linear-wakeups");
  assert.deepEqual(wake.on.workflow_run, {
    workflows: ["*"],
    types: ["completed"],
  });
  assert.ok(wake.on.schedule.length);
  assert.deepEqual(wake.on.check_run, { types: ["completed"] });
  assert.ok(Object.hasOwn(wake.on, "status"));
  assert.deepEqual(wake.on.pull_request_target, {
    types: ["opened", "synchronize", "reopened", "edited", "labeled"],
  });
  assert.match(wake.jobs.wake.steps[0].with.ref, /repository.default_branch/);
  assert.equal(wake.jobs.wake.steps[0].with["persist-credentials"], false);
  assert.equal(wake.permissions.contents, "read");
  assert.deepEqual(wake.jobs.wake.concurrency, {
    group: "symphony-linear-wakeups-${{ github.repository }}",
    "cancel-in-progress": false,
    queue: "max",
  });
});
