import yaml from "js-yaml";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ensurePrLabels } from "../ensure-pr-labels.mjs";

const repository = "Example/app";
const issueIdentifier = "TASK-42";
const pr = (number = 42, overrides = {}) => ({
  number,
  title: "[TASK-42]: repair labels",
  head: { ref: "symphony/demo/TASK-42/labels" },
  base: { repo: { full_name: repository } },
  ...overrides,
});
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

function fixture({
  labels = [],
  pulls = [pr()],
  project = { content: "project-code: demo\nproject-color: blue" },
  attachments = { nodes: [], pageInfo: { hasNextPage: false } },
  readback,
  intercept = () => undefined,
} = {}) {
  let current = [...labels];
  let labelReads = 0;
  const requests = [];
  const env = {
    LINEAR_API_TOKEN: "linear-test-secret",
    GITHUB_TOKEN: "github-test-secret",
  };
  const fetchImpl = async (url, options) => {
    const request = {
      url: new URL(url),
      method: options.method,
      body: options.body && JSON.parse(options.body),
    };
    requests.push(request);
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.redirect, "error");
    const overridden = intercept(request, requests);
    if (overridden) return overridden;
    if (request.url.hostname === "api.linear.app") {
      assert.equal(options.headers.authorization, "linear-test-secret");
      assert.equal(request.method, "POST");
      assert.deepEqual(request.body.variables, { id: issueIdentifier });
      assert.doesNotMatch(request.body.query, /mutation/);
      return response({
        data: { issue: { identifier: issueIdentifier, project, attachments } },
      });
    }
    assert.equal(options.headers.authorization, "Bearer github-test-secret");
    assert.equal(request.url.hostname, "api.github.com");
    assert.ok(request.url.pathname.startsWith(`/repos/${repository}/`));
    const path = request.url.pathname.slice(`/repos/${repository}/`.length);
    if (path === "pulls") {
      assert.equal(request.method, "GET");
      assert.equal(request.url.searchParams.get("state"), "open");
      const page = Number(request.url.searchParams.get("page"));
      return response(pulls.slice((page - 1) * 100, page * 100));
    }
    if (path.startsWith("labels/")) {
      assert.equal(request.method, "GET");
      return response({
        name: decodeURIComponent(path.slice("labels/".length)),
      });
    }
    if (path === "issues/42/labels") {
      if (request.method === "POST") {
        current = [...new Set([...current, ...request.body.labels])];
      } else {
        assert.equal(request.method, "GET");
        labelReads++;
      }
      const page = Number(request.url.searchParams.get("page") || 1);
      return response(
        (labelReads > 1 && readback ? readback : current)
          .slice((page - 1) * 100, page * 100)
          .map((name) => ({
            name,
          }))
      );
    }
    assert.fail(`Unexpected request: ${request.method} ${url}`);
  };
  return {
    requests,
    run: (overrides = {}) =>
      ensurePrLabels({
        issueIdentifier,
        repository,
        env,
        fetchImpl,
        ...overrides,
      }),
    writes: () =>
      requests.filter(
        ({ url, method }) =>
          url.hostname === "api.github.com" && method !== "GET"
      ),
    labels: () => current,
  };
}

for (const [name, labels, added] of [
  ["both absent", [], ["symphony", "blue"]],
  ["symphony absent", ["blue"], ["symphony"]],
  ["project color absent", ["symphony"], ["blue"]],
  ["both present", ["symphony", "blue"], []],
  [
    "unrelated labels present",
    ["bug", "project-required", "green"],
    ["symphony", "blue"],
  ],
  ["case insensitive existing labels", ["Symphony", "Blue"], []],
]) {
  test(`repairs only missing labels: ${name}`, async () => {
    const f = fixture({ labels });
    const result = await f.run();
    assert.deepEqual(result.added, added);
    assert.deepEqual(result.verified, ["symphony", "blue"]);
    assert.equal(result.result, added.length ? "repaired" : "already-correct");
    assert.deepEqual(f.labels(), [...labels, ...added]);
    assert.equal(f.writes().length, added.length ? 1 : 0);
    if (added.length) {
      assert.equal(
        f.writes()[0].url.pathname,
        "/repos/Example/app/issues/42/labels"
      );
      assert.deepEqual(f.writes()[0].body, { labels: added });
    }
    const beforeRerun = f.writes().length;
    assert.equal((await f.run()).result, "already-correct");
    assert.equal(f.writes().length, beforeRerun, "rerun must not mutate");
    assert.equal(
      f.requests.at(-1).method,
      "GET",
      "verify via separate readback"
    );
  });
}

test("no open PR succeeds before requiring project metadata", async () => {
  const f = fixture({ pulls: [], project: null });
  assert.equal((await f.run()).result, "no-open-pr");
  assert.equal(f.writes().length, 0);
});

test("required labels on a later label page are a no-op and unrelated labels survive", async () => {
  const labels = [
    ...Array.from({ length: 100 }, (_, i) => `label-${i}`),
    "symphony",
    "blue",
  ];
  const f = fixture({ labels });
  assert.equal((await f.run()).result, "already-correct");
  assert.equal(f.writes().length, 0);
  assert.deepEqual(f.labels(), labels);
});

test("mismatched Linear issue identity cannot edit a PR", async () => {
  const f = fixture({
    intercept: ({ url }) =>
      url.hostname === "api.linear.app"
        ? response({ data: { issue: { identifier: "TASK-43" } } })
        : undefined,
  });
  await assert.rejects(f.run, /does not match the requested issue/);
  assert.equal(f.writes().length, 0);
});

test("supports the existing token environment aliases", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.run({
        env: {
          LINEAR_API_KEY: "linear-test-secret",
          GH_TOKEN: "github-test-secret",
        },
      })
    ).result,
    "repaired"
  );
});

test("exact issue matching ignores other tickets, body mentions and other repositories' attachments", async () => {
  const f = fixture({
    pulls: [
      pr(7, {
        title: "[TASK-420]: unrelated",
        head: { ref: "symphony/demo/TASK-420/work" },
        body: "Follow-up for TASK-42",
      }),
    ],
    attachments: {
      nodes: [{ url: "https://github.com/Other/app/pull/7" }],
      pageInfo: { hasNextPage: false },
    },
  });
  assert.equal((await f.run()).result, "no-open-pr");
  assert.equal(f.writes().length, 0);
});

test("Linear attachment verifies a PR on a nonstandard branch", async () => {
  const f = fixture({
    pulls: [pr(42, { title: "Repair labels", head: { ref: "label-fix" } })],
    attachments: {
      nodes: [{ url: "https://github.com/example/APP/pull/42#discussion" }],
      pageInfo: { hasNextPage: false },
    },
  });
  assert.equal((await f.run()).result, "repaired");
});

for (const [name, options, pattern] of [
  [
    "multiple PRs",
    { pulls: [pr(), pr(43)] },
    /Ambiguous issue\/PR association/,
  ],
  [
    "conflicting title",
    { pulls: [pr(42, { title: "[TASK-43]: other issue" })] },
    /conflicting issue\/PR association/,
  ],
  [
    "conflicting branch",
    { pulls: [pr(42, { head: { ref: "symphony/demo/TASK-43/work" } })] },
    /conflicting issue\/PR association/,
  ],
  [
    "title-only association",
    { pulls: [pr(42, { head: { ref: "unverified" } })] },
    /Unverified/,
  ],
  [
    "wrong target repository",
    { pulls: [pr(42, { base: { repo: { full_name: "Other/app" } } })] },
    /Unverified/,
  ],
  [
    "truncated attachments",
    { attachments: { nodes: [], pageInfo: { hasNextPage: true } } },
    /attachments are incomplete/,
  ],
  ["no project", { project: null }, /missing project-color/],
  [
    "missing color",
    { project: { content: "project-code: blue" } },
    /missing project-color/,
  ],
  [
    "conflicting content/description",
    {
      project: {
        content: "project-color: blue",
        description: "project-color: green",
      },
    },
    /ambiguous project-color/,
  ],
  [
    "conflicting declarations",
    { project: { content: "project-color: blue\nproject_color: green" } },
    /ambiguous project-color/,
  ],
  [
    "empty color",
    { project: { content: "project-color:" } },
    /invalid project-color/,
  ],
  [
    "invalid color",
    { project: { content: "project-color: ../../labels" } },
    /invalid project-color/,
  ],
]) {
  test(`rejects ${name} before writing`, async () => {
    const f = fixture(options);
    await assert.rejects(f.run, pattern);
    assert.equal(f.writes().length, 0);
  });
}

test("uses authoritative project metadata without restricting colors to a project-specific enum", async () => {
  const f = fixture({
    project: {
      description: "- project_color: `Amber`",
      content: "project-color: amber",
    },
  });
  assert.deepEqual((await f.run()).verified, ["symphony", "amber"]);
});

test("a linked PR with conflicting issue identity is not edited", async () => {
  const f = fixture({
    pulls: [pr(42, { title: "[TASK-43]: other", head: { ref: "unverified" } })],
    attachments: {
      nodes: [{ url: "https://github.com/Example/app/pull/42" }],
      pageInfo: { hasNextPage: false },
    },
  });
  await assert.rejects(f.run, /conflicting issue\/PR association/);
  assert.equal(f.writes().length, 0);
});

test("discovery checks subsequent pages before mutating", async () => {
  const unrelated = Array.from({ length: 99 }, (_, i) =>
    pr(i + 100, { title: "Unrelated", head: { ref: "other" } })
  );
  const f = fixture({ pulls: [pr(), ...unrelated, pr(43)] });
  await assert.rejects(f.run, /Ambiguous/);
  assert.equal(f.writes().length, 0);
  assert.equal(f.requests.at(-1).url.searchParams.get("page"), "2");
});

test("PR discovery has a bounded page limit and fails before mutation", async () => {
  const f = fixture({
    pulls: Array.from({ length: 1000 }, (_, i) => pr(i + 1)),
  });
  await assert.rejects(f.run, /List open PRs: pagination limit exceeded/);
  assert.equal(f.writes().length, 0);
  assert.equal(f.requests.length, 11);
});

test("nonexistent required label fails preflight without creating or partially applying labels", async () => {
  const f = fixture({
    intercept: ({ url }) =>
      url.pathname.endsWith("/labels/blue")
        ? response({ message: "github-test-secret" }, 404)
        : undefined,
  });
  await assert.rejects(f.run, /Verify required label blue exists: HTTP 404/);
  assert.equal(f.writes().length, 0);
});

for (const [phase, matches] of [
  ["Linear lookup", ({ url }) => url.hostname === "api.linear.app"],
  ["PR discovery", ({ url }) => url.pathname.endsWith("/pulls")],
  ["label read", ({ url }) => url.pathname.endsWith("/issues/42/labels")],
  ["label preflight", ({ url }) => url.pathname.endsWith("/labels/symphony")],
  [
    "label write",
    ({ url, method }) => url.hostname === "api.github.com" && method === "POST",
  ],
]) {
  test(`reports ${phase} API failure without secrets or retries`, async () => {
    let failures = 0;
    const f = fixture({
      intercept: (request) => {
        if (!matches(request)) return undefined;
        failures++;
        return response(
          { message: "linear-test-secret github-test-secret" },
          403
        );
      },
    });
    await assert.rejects(f.run, (error) => {
      assert.match(error.message, /HTTP 403/);
      assert.doesNotMatch(error.message, /test-secret/);
      return true;
    });
    assert.equal(failures, 1);
    assert.equal(f.writes().length, phase === "label write" ? 1 : 0);
  });
}

test("GraphQL errors and network failures omit response details", async () => {
  for (const intercept of [
    () => response({ errors: [{ message: "linear-test-secret" }] }),
    () => {
      throw new Error("github-test-secret");
    },
    () => ({
      ok: true,
      json: async () => {
        throw new Error("linear-test-secret");
      },
    }),
  ]) {
    const f = fixture({ intercept });
    await assert.rejects(f.run, (error) => {
      assert.match(
        error.message,
        /GraphQL API errors|request failed|invalid API JSON/
      );
      assert.doesNotMatch(error.message, /test-secret/);
      return true;
    });
    assert.equal(f.writes().length, 0);
  }
});

test("unsuccessful readback fails even after a successful POST", async () => {
  const f = fixture({ readback: ["symphony"] });
  await assert.rejects(f.run, /PR label readback failed/);
  assert.equal(f.writes().length, 1);
});

test("readback API failure is reported after the write", async () => {
  let reads = 0;
  const f = fixture({
    intercept: ({ url, method }) => {
      if (
        url.pathname.endsWith("/issues/42/labels") &&
        method === "GET" &&
        ++reads === 2
      )
        return response({}, 503);
    },
  });
  await assert.rejects(f.run, /Read PR labels: HTTP 503/);
  assert.equal(f.writes().length, 1);
});

test("invalid inputs and missing credentials fail without requests", async () => {
  for (const overrides of [
    { issueIdentifier: "bad/42" },
    { repository: "https://github.com/Example/app" },
    { env: {} },
  ]) {
    const f = fixture();
    await assert.rejects(() => f.run(overrides), /required/);
    assert.equal(f.requests.length, 0);
  }
});

test("hosted hooks support an empty arbitrary-repository workspace without invoking controller tools", async () => {
  const source = await readFile(
    new URL("../runtime-bundle/workflow/WORKFLOW.md", import.meta.url),
    "utf8"
  );
  const { hooks } = yaml.load(source.split("---")[1]);
  const root = await mkdtemp(join(tmpdir(), "symphony-pr-labels-"));
  try {
    const workspace = join(root, "100-11");
    const bin = join(root, "bin");
    await mkdir(workspace);
    await mkdir(bin);
    await writeFile(
      join(bin, "node"),
      '#!/bin/sh\nprintf "%s\\n" "$@"\nexit "${TEST_HOOK_EXIT:-0}"\n'
    );
    await chmod(join(bin, "node"), 0o755);
    for (const hook of [hooks.after_create, hooks.after_run]) {
      const result = spawnSync("bash", ["-c", hook], {
        cwd: workspace,
        encoding: "utf8",
        env: { PATH: `${bin}:/usr/bin:/bin`, TEST_HOOK_EXIT: "17" },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("numeric issue labels use renewable App API calls without a GitHub PAT", async () => {
  const paths = [];
  let labels = [];
  const result = await ensurePrLabels({ issueIdentifier: "100-11", repository,
    env: { LINEAR_API_TOKEN: "linear-test-secret", SYMPHONY_GITHUB_AUTH_MODE: "app" },
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://api.linear.app/graphql");
      assert.equal(JSON.parse(init.body).variables.id, "100-11");
      return response({ data: { issue: { identifier: "100-11", project: { content: "project-color: pink" }, attachments: { nodes: [], pageInfo: { hasNextPage: false } } } } });
    },
    appClient: async (path, options) => {
      paths.push(path);
      if (path.startsWith("/pulls?")) return new Response(JSON.stringify([{ ...pr(), title: "[100-11]: App credentials", head: { ref: "symphony/hackathon-ready/100-11/app-credentials" } }]));
      if (path.startsWith("/labels/")) return new Response(JSON.stringify({ name: path.split("/").at(-1) }));
      assert.ok(path.startsWith("/issues/42/labels"));
      if (options.method === "POST") {
        labels = options.body.labels.map((name) => ({ name }));
        const outcome = await options.readback(async (readPath) => {
          assert.equal(readPath, "/issues/42/labels?per_page=100");
          return new Response(JSON.stringify(labels));
        });
        assert.equal(outcome.applied, true);
        return outcome.response;
      }
      return new Response(JSON.stringify(labels));
    },
  });
  assert.equal(result.result, "repaired");
  assert.deepEqual(result.verified, ["symphony", "pink"]);
  assert.ok(paths.length >= 5);
});
