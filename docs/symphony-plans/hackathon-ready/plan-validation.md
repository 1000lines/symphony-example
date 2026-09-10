# 100-7 plan validation

This record covers planning artifacts, not implemented hackathon readiness.
The tested commit and published review/check links are recorded in the 100-7
Codex workpad and PR. No downstream issue or relation was written by this ticket.

## Local evidence

- `npm run symphony-dag:build`: passed.
- `npm test -w @example/symphony-dag -- --runInBand`: passed, 5 suites and
  36 tests. These exercise the existing parser and renderer.
- `npm run symphony-dag:check`: failed at its formatting stage on unchanged
  `tools/symphony-dag/src/dagLinearPayload.test.ts` and `projectGraph.test.ts`.
  Both match the selected base; this plan does not change shared tooling or fix
  unrelated formatting. This is a baseline failure, not a passing combined check.
- The shared parser accepts 15 nodes and 16 edges. The Markdown graph and
  standalone `.mmd` are identical. The shared relation-table parser's directed
  payload set matches the manifest-derived set exactly.
- The shared payload renderer emits 15 issue payloads and 16 relation records,
  with required Linear labels `pink,mature`, the declared parked/dependent states,
  Jeremy assignment and main-based draft PR metadata. No downstream UUIDs were
  invented; relation keys remain symbolic until 100-8 creates the issues.
- Diagram/ownership review: nine delivery rounds; independent RUST branch;
  APP/GATE fan-in to CODEX/WAIT; INSTALL/GUIDE/RUST fan-in to DEPLOY; sequential
  secret retirement/rotation; two parked monitors. Repeated file and mutable
  resource ownership has explicit ordering or controlled activation in the
  accepted item records and execution contract.
- Docker is skipped: local build, tests and plan parsing ran successfully;
  the combined check's formatting failure is not a missing toolchain.

Run formatting and whitespace checks over these changed artifacts before each
published checkpoint:

```bash
npx prettier --check docs/symphony-plans/fan-out-plan-100-7-hackathon-ready.md docs/symphony-plans/hackathon-ready/*.md
git diff --check
```

## Reproduce the structural preview

Build the shared package, then invoke its existing functions directly from the
repository root. This snippet performs no network access or live writes. It is
a use of the shared library, not new project-local planning infrastructure.

````bash
node <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { parseProjectPlan } = require('./tools/symphony-dag/dist/projectManifest');
const { parseRelationPayloadTable } = require('./tools/symphony-dag/dist/projectGraph');
const { buildDagLinearPayload } = require('./tools/symphony-dag/dist/dagLinearPayload');
const path = 'docs/symphony-plans/fan-out-plan-100-7-hackathon-ready.md';
const markdown = fs.readFileSync(path, 'utf8');
const plan = parseProjectPlan(markdown);
const graph = markdown.match(/```mermaid\n([\s\S]*?)```/)[1].trim();
assert.equal(graph, fs.readFileSync(path.replace('.md', '.mmd'), 'utf8').trim());
const key = row => `${row.blockerKey}->${row.blockedKey}:${row.relation}`;
assert.deepEqual(parseRelationPayloadTable(markdown).map(key).sort(),
  plan.expectedRelationPayloads.map(key).sort());
const payload = buildDagLinearPayload(plan, {
  teamKey: '100',
  projectName: 'Symphony hackathon readiness',
  sourcePlanPath: path,
  sourceIssueIdentifier: '100-7',
  sourceIssueUrl: 'https://linear.app/1000lines/issue/100-7/plan-project-seed-ticket',
  assignee: { name: 'Jeremy Carroll', githubLogin: 'jeremycarroll' },
});
console.log(JSON.stringify(payload, null, 2));
NODE
````

At fan-out, replace source links with GitHub blob permalinks at the accepted
merged plan SHA and resolve real team/project/label/state/assignee IDs. Resolve
actual issue UUIDs before converting relation keys to mutation inputs. Validate
required metadata before any live issue write, as the existing 100-8 contract
requires; successful structural rendering is not authorization or a full
preflight. The renderer's optional label-setup helper must not create missing
labels in this project.

## Actual renderer limitations and handoff

`parseProjectManifest` retains structural fields only, and
`renderIssueDescription` currently emits only source/project/branch/PR metadata.
Even rich fields supplied inline are omitted; it does not load item references.
The actual HR-CI description begins:

```text
Generated from accepted DAG fan-out plan docs/symphony-plans/fan-out-plan-100-7-hackathon-ready.md.

Payload key: HR-CI. Node type: task. Difficulty: hard. Initial status: Backlog.

Project code: hackathon-ready. Project color: pink. Base branch: main.

Human lead: Jeremy Carroll.

Branch template: symphony/hackathon-ready/${issue}/ci-caller. Declared base: main. PR base: main.

GitHub PR labels: pink, symphony.
```

That is a successful structural preview, **not a complete generated ticket**.
100-8 must prepend the identically named accepted item content and common
contract, include live direct-relation links and accepted-SHA source permalinks,
and inspect the resulting full body before writes. The existing 100-8 scope
already authorizes that content-copying work. No product interpretation or new
ticket decomposition is needed. The same limitation covers DEPLOY's explicit
second-repository rehearsal branch and the monitors' no-PR operation policy.

The PR proposes the smallest shared-tool improvement: preserve/render accepted
item content and required execution metadata, with a fixture showing a complete
ticket. Human review decides whether to commission that process work separately.
This ticket changes no shared schema, criterion, parser, renderer or workflow.

## CI and review boundary

At the planning baseline, symphony-build/lint/test expose only `workflow_call`
and have no automatic caller. Wakeups and optional AMI workflows are
`disabled_fork`; enabled Cadence review workflows are not build/test evidence.
The accepted design's bootstrap section explicitly permits planning artifacts
with the current reviewer and available local checks while recording this gap.
CI is still missing, never claimed passing. CI's implementation node adds the
caller; DEPLOY and FINAL must close the bootstrap gap with real current-ref runs.

100-7 publishes a draft, inspects checks on its actual head, records that result
and waits Inactive for configured review/human acceptance. Neither a metadata
preview nor existing provider review proves project readiness. No mature label
or successful CI claim follows from this planning exception.
