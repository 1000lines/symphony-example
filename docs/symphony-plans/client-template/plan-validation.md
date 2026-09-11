# 100-39 plan validation and payload inspection

This validates the [proposed plan](../fan-out-plan-100-39-client-template.md),
not the future template, deployed host or provider execution.

## Shared-tool checks

Use `$SYMPHONY_TOOLING_ROOT/tools/symphony-dag/` exports; no project-local
validator or schema is introduced. The existing package has no CLI. Run the
following from the issue checkout with its locked Node dependencies, or use the
equivalent already-built shared package. `TS_NODE_TRANSPILE_ONLY` loads the shared
TypeScript exports; it does not disable their runtime plan validation.

```bash
NODE_PATH="$PWD/node_modules" TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register <<'JS'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const shared = process.env.SYMPHONY_TOOLING_ROOT + '/tools/symphony-dag/src/';
const { parseProjectPlan } = require(shared + 'projectManifest.ts');
const { parseProjectGraph, parseRelationPayloadTable, formatRelationPayloadId } =
  require(shared + 'projectGraph.ts');
const { buildDagLinearPayload } = require(shared + 'dagLinearPayload.ts');
const file = 'docs/symphony-plans/fan-out-plan-100-39-client-template.md';
const markdown = fs.readFileSync(file, 'utf8');
const plan = parseProjectPlan(markdown);
assert.deepEqual(plan.graph,
  parseProjectGraph(fs.readFileSync(file.replace(/\.md$/, '.mmd'), 'utf8')));
assert.deepEqual(
  parseRelationPayloadTable(markdown).map(formatRelationPayloadId).sort(),
  plan.expectedRelationPayloads.map(formatRelationPayloadId).sort());
const preview = buildDagLinearPayload(plan, {
  teamKey: '100', projectName: 'Symphony client Copier template',
  sourcePlanPath: file, sourceIssueIdentifier: '100-39',
  sourceIssueUrl: 'https://linear.app/1000lines/issue/100-39',
  assignee: {name: 'Jeremy Carroll', githubLogin: 'jeremycarroll'}
});
console.log(JSON.stringify(preview, null, 2));
JS
```

The separate relation-table call is intentional: `parseProjectPlan` derives
expected relations from the manifest; it does not validate that Markdown table.
The APIs also do not prove acyclicity, ownership or live prerequisites. Manual
inspection checks that every edge goes to a strictly higher numbered round,
which proves this graph acyclic; I→M→T→L→U (or V)→F→A→Z attains eight rounds.
No graph edge has a redundant transitive alternative. CT-Q is disjoint from CT-I/M/C/R; CT-M/C/R are disjoint after
CT-I. Jeremy's PR #44 correction temporarily gives CT-M the two-list/inventory
amendment after CT-I and CT-C have merged; no concurrent list writer or new
hard dependency is introduced. CT-T has no C/R dependency; CT-L joins T/C/R; CT-O/U/V are disjoint after CT-L; CT-F directly joins U/V. All later overlapping files/resources have
explicit ownership handoffs. No new test or planning engine is needed.
Jeremy's 14:44 self-use decision changes node scope/labels, not edges: CT-U
owns root bootstrap/proof, CT-F takes that same repository for alpha migration
and final root proof, and CT-A still owns example adoption. CT-Q's delimiter and
ignore files remain disjoint from CT-I/M/C/R; CT-T consumes them after Q merges.

Local results from the proposed tree:

- Shared parse: one manifest, 14 nodes, 17 edges; standalone graph identical.
- Shared relation table: exactly the same 17 blocker→blocked edges.
- Shared dry-run renderer: CT-I/Q/M/C/R/T/L/O/U/V/F/A/Z, thirteen new issue payloads;
  existing 100-43 produces no create payload. Defaults are Active, main/main,
  draft, Jeremy, pink/symphony; existing 100-43 remains Misc/blue.
- Required source and D1–D9/AC1–AC13 ownership review performed; no unavailable
  required source. Both publication destinations and final live proof have owners.
- The self-use contract assigns fixed `_envops`, root/output separation,
  expression-preservation tests, raw-template lint exclusions and both real
  consumer proofs. These are future implementation acceptance checks; this
  planning ticket does not execute Copier or claim operational root clients.
- Locked Prettier and diff whitespace checks run on all committed plan Markdown.
  Docker: skipped — passed locally. No application runtime was changed.

Exact committed head, command results, CI and review provenance are recorded in
the pinned [Codex workpad](https://linear.app/1000lines/issue/100-39/plan-project-seed-ticket#comment-3f6a3961).
Mandatory seed CI on the published head remains required; these local results
do not predict its result. Future live source/publishing/onboarding/CI-mode/
provider/advisory checks are requirements in the delivery items, not passed tests.

## Payload completeness and fan-out handoff

September 11 PR #42's human-authorized amendment adds the eighth answer,
`cadence_reviewer` (`claude`/`codex`), without changing the fourteen nodes or
seventeen edges. CT-Q validates both values and rejects omitted/invalid choices
with real Copier copies. D6 and the existing CT-R/T/L/O/U/F/A acceptance criteria
carry explicit selection through provider integration and consumer proof.
CT-L must check the actual provider artifact; the App-identity checkpoint in
merged PR #43 does not establish the full CT-R interface. Existing terminal
issue states remain untouched. These are revised acceptance criteria, not a
claim that provider integration or live execution has passed.

The current shared renderer emits identity, branch, labels, assignee and source
links. It **does not carry item scope, files, resources, acceptance or validation
content** into issue descriptions. Its JSON alone is not ready for live writes.
100-40 must copy the reviewed item content and execution contract into the
rendered descriptions before submitting them. This is an existing-tool/manual
composition step, not authorization to build a substitute renderer.

Compose each description in this stable order:

1. Item key/title, its scope and outcome, explicit repository (including CT-U/V/F
   overrides) and main/main. Copy the item content verbatim; do not invent scope.
2. Pinned plan and item-document GitHub links using the accepted merged plan SHA.
3. The complete item section, including owned files/resources, creates/edits/
   deletes/exclusions, dependencies, actions, acceptance and validation commands.
   Set-list expressions such as “every other owned path” are exact set subtraction
   from the listed creates; preserve them and the owned list together. CT-I's
   future inventory outputs govern later mechanical copy paths as explicitly
   planned. Do not guess those future filenames at fan-out.
4. Direct blockers and directly blocked keys from the shared payload/graph only.
   Replace placeholders with clickable actual Linear identifier/URL mappings
   after creation. 100-43 has an existing real link; no other live IDs are assumed.
5. Main plan's layout/self-use, alpha publication/evidence and ticket execution contracts, including
   moving branch semantics, actual consumed SHAs, pinned workpad, human review,
   current-head CI, mature rules, state handling, metadata and PR requirements.

Inspection example for CT-I: it owns the four inventory files, creates all four,
edits none, reads source files only, has no external mutable resource or direct
blocker, and directly blocks CT-M, CT-C and CT-R. Its formatting/source-path checks and
mandatory docs CI must be in its generated body. CT-V instead carries its explicit
workflow-repository override and reviewed-export import scope; neither description
may merely link a plan and omit the work.

This turn produces both raw shared payload JSON and complete inspection payloads
under the issue workspace's `.task-evidence/`, with no Linear writes. The latter
has the thirteen full item descriptions, common contract, direct relation keys and
actual committed plan links. This is ephemeral evidence, not a checked-in tool.
No future issue UUIDs are supplied, so live relation inputs intentionally remain
unresolved. The pinned workpad records the inspection results and artifact paths.

Before actual writes, 100-40 resolves all live metadata again, reuses 100-43,
changes creation state to Backlog for staging, creates/readbacks the exact edges,
then activates the complete new set. Do not send the raw Active preview directly.
Use the injected Linear API; this planning ticket does not invoke live fan-out.

The PR proposes the smallest shared-tool improvement: support carrying reviewed
node body content into generated descriptions. It is advisory and outside this
ticket; no shared schema, validation policy or implementation is changed here.
