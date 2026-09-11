# Client inventory and export selection

CT-I selection, September 11, 2026. The [accepted plan](../fan-out-plan-100-39-client-template.md)
and [design D1–D9](../client-template-design.md) govern this inventory. This is
preparation for copying and conversion, not a usable client or evidence of live
review. Source repository: `1000lines/symphony-example`; branch and PR base: `main`.
Freeze existing copy inputs and audit exports at
**`d5e9692b84c3f338014b964fd9713143fb723b55`**, the human-merged PR #43 on main.
The accepted plan remains PR #34 at `873f511aea3e1d858e216d1a890ed1cd9a709d61`.
The selected source includes 100-43's cleanup from
[PR #31](https://github.com/1000lines/symphony-example/pull/31), merged as
`ca5c37344df600468ee69e73c04c54197a5b062c`; no predecessor branch is imported.
The older required baseline `3de96c9f739d732cc7efd498225b4444b547cc57` is context,
not the copy ref. CT-R must separately verify 100-43's initial live proof.

### Human revision and recent merges

[Jeremy's September 11, 16:24 UTC comment](https://github.com/1000lines/symphony-example/pull/41#issuecomment-5637447356)
requires `.gitattributes` in every generated client and inspection of recent
merges. This supersedes its earlier publication-only disposition and the old
copy/source pin. It adds one D1 client artifact for readable planning diffs;
task ownership remains as planned. The later human-merged
[PR #42](https://github.com/1000lines/symphony-example/pull/42) adds the eighth
answer, `cadence_reviewer` (`claude` or `codex`, required without a default).
It supersedes key-presence selection: both keys present still runs the selected
reviewer; missing selection or its matching key fails before provider execution.

The complete `873f511..d5e9692` diff contains 16 paths, including two new files.
All eleven changed export paths were already selected. No new runtime helper,
test, instruction file or package dependency needs adding to either export list.

| Merged change                                                                                                                                | Inventory consequence                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#39](https://github.com/1000lines/symphony-example/pull/39), fan-out record                                                                 | `fan-out-100-40.md` is new seed-only planning evidence; the changed plan `.md`/`.mmd` remain source references. No client or workflow export.                                                                                                                                                      |
| [#40](https://github.com/1000lines/symphony-example/pull/40) and [#38](https://github.com/1000lines/symphony-example/pull/38), draft handoff | Already-listed events, trigger and manual workflows, advisory helper and its test, event boundary test and standing review guide carry the fixes. Preserve separate repository-token readiness and explicit failure reporting during extraction.                                                   |
| [#43](https://github.com/1000lines/symphony-example/pull/43), App identity                                                                   | Already-listed trigger/manual/handoff workflows, verifier, handoff helper, event boundary test, Cadence skill and standing guide carry the fix. `early-review-evidence.md` is new seed-only evidence; the changed `implementation-items.md` is a plan reference. Neither belongs in either export. |

The events and handoff copy blobs change at this pin; the other six copy inputs
retain their existing bytes, including the newly selected `.gitattributes`.
Re-expand imports at this ref; do not copy predecessor branch work. PR #43
implements native App identity only: its merge/100-49 Done state does not prove
the remaining CT-R reusable interfaces, provider selection or live proof.
Those planned additions below remain absent and required before CT-L integration.

## Generated paths and copy boundary

Paths in the first column are relative to the generated repository root. Their
staging destinations are `templates/symphony-client/template/<path>`; CT-U
publishes them as `template/<path>` and renders the **same paths** at its own
repository root. Template filenames may gain Copier's `.jinja` suffix during
conversion; the generated names below remain unchanged.

[client-copy.txt](client-copy.txt) is the complete CT-M input: eight existing
regular files, 678 lines, with per-row commit, Git mode, Git blob SHA-1, source
and destination. Hashes describe Git objects, not raw-file SHA-1 digests. CT-M
copies every byte/mode, including raw GitHub expressions, without substitutions
or formatting. All eight staging destinations are absent at the selected ref.
CT-M deliberately copies this recorded snapshot even if main advances; changing
the pin or any selected blob requires a reviewed inventory revision first.

| Generated path                                         | Existing copy source or planned origin                             | Why local; conversion owner                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/cadence-review-ingress.yml`         | Same source path                                                   | Native event admission and secret-free signal must execute in the target. CT-T converts identity defaults, preserves the ingress title contract and `Cadence Review Ingress` name; no helpers or credentials.                                                       |
| `.github/workflows/symphony-client-review.yml`         | `.github/workflows/cadence-ai-review-events.yml`                   | Target default-branch event listener and manual/explicit-review entry points. CT-T deletes the raw body; CT-L supplies thin calls to CT-R's events, manual and trigger workflows.                                                                                   |
| `.github/workflows/symphony-client-handoff.yml`        | `.github/workflows/cadence-linear-rework.yml`                      | Target native listener for feedback-to-Linear delivery. CT-T deletes the body; CT-L calls CT-R's reusable handoff with App/Linear secrets only.                                                                                                                     |
| `.github/workflows/symphony-client-review-cleanup.yml` | `.github/workflows/cadence-review-check-cleanup.yml`               | Target native completion listener closes abandoned advisory checks. CT-T deletes the body; CT-L calls CT-R's reusable cleanup with App key only.                                                                                                                    |
| `.github/workflows/symphony-client-wakeups.yml`        | `.github/workflows/symphony-linear-wakeups.yml`                    | Target check/status/CI/conflict events and configured completion filters. CT-T deletes the body; CT-L calls CT-C's reusable wakeup with Linear token only.                                                                                                          |
| `.github/workflows/symphony-client-ci.yml`             | `.github/workflows/ci.yml`                                         | Optional target command CI when existing application CI does not cover it. CT-T deletes the tooling-specific body; CT-L calls CT-C's new command runner without reviewer secrets. Omit when existing CI suffices; no additional answer.                             |
| `.symphony.cfg.json`                                   | Same source path                                                   | Target commands, instruction paths, Linear team and observed required-check provenance. CT-T converts immediately, defaults to native by omitting mode, replaces seed npm commands and never invents required checks. CT-L adds the accepted optional mode support. |
| `.gitattributes`                                       | Same source path                                                   | GitHub reads attributes in the target to collapse per-project AI bookkeeping while keeping Mermaid and top-level plans visible. CT-T retains these generic rules immediately; existing target attributes require a reviewed merge preserving unrelated rules.       |
| `SYMPHONY.md`                                          | New in CT-T; no suitable short existing client file                | Target worker instructions referenced by config, including commands, review context, usage/source/license links and the skill delivery locations below. Preserve existing AGENTS/CLAUDE content; do not copy the hosted runtime instructions.                       |
| `.github/symphony/REVIEW.md`                           | New in CT-T                                                        | Target review context for both providers. Keep generic reviewer implementation/instructions central.                                                                                                                                                                |
| `.github/symphony/cadence-app-manifest.json`           | New in CT-T; no App registration manifest exists at the source ref | Inert direct-path registration document: metadata/contents/actions read, pull_requests/issues/checks write; no host or org-admin grant. Forks use the accepted existing App. CT-O verifies actual grants/IDs separately.                                            |
| `.copier-answers.yml`                                  | New Copier metadata supplied by CT-Q's package, consumed by CT-T/L | Local source/version and the eight nonsecret answers; preserve `_src_path`/`_commit`. No copy row, fabricated source, credential, project key or extra question.                                                                                                    |

Ingress, config and `.gitattributes` can be converted from these snapshots immediately.
The five other copied workflows are inert **only while staged**: CT-T must
remove them before rendering its initial client. They contain source bodies,
seed assumptions or unavailable interfaces and must never leak into output.
CT-T's PROVENANCE records those five exact CT-L additions; their absence gates
publication/onboarding, not CT-T's initial conversion. New CT-T instructions and
App manifest use the reviewed requirements, not invented copies. No generic
Dockerfile or provider implementation is a client artifact.

### Listener and caller contract

Keep ingress named `Cadence Review Ingress`; both the review and handoff local
`workflow_run` listeners consume it. Name the generated review caller **`Symphony
Client Review`**. Keep its event, manual `workflow_dispatch` (PR numbers/label),
and `pull_request_target` review-request/closed compatibility routes in that one
local file, delegating to CT-R's existing central entry points. This preserves
manual review without another generated file or copied dispatch body. CT-R/L
must test each route, including closure and single-PR manual selection.

Name the cleanup caller `Symphony Client Review Cleanup`; its local native
`workflow_run.workflows` list is **`[Symphony Client Review]`**, `types:
[completed]`. The monitored name belongs to the caller run, not the central
reusable workflow. CT-L must test this against the actual generated names and
forward target/run/attempt identity to CT-R's cleanup. If CT-R requires another
local review entry, amend this inventory and listener list together before
release. Extracting a reusable body does not install a native event listener in
a consumer. Retain the seed's three-name listener until CT-A/Z's migration census.

Review explicitly maps App, Linear and optional OpenAI/Anthropic secrets;
handoff maps App/Linear; cleanup App only; wakeup Linear only; CI/ingress none.
App IDs/slugs and target identity are nonsecret inputs. Native review source at
the selected ref uses the minted App; no legacy bot PAT is required.
CT-R preserves trusted App-login verification in outcome checks and handoff.
The remaining `secrets: inherit` and protected-environment assumptions require
conversion at the reusable boundary; they are not adopter requirements. Review
callers must permit the trusted finish job's repository `GITHUB_TOKEN`
`contents: write` and `pull-requests: write` for draft readiness, with narrow
permissions elsewhere. CT-R/L preserve the separate App check/review identity,
current-head guards and failed-readiness diagnostic; do not expand App grants.
Helpers must come from trusted workflow-source commits, separately from the
target PR/config.

## Collisions and exclusions

At the frozen source ref, generated-path collisions in `symphony-example` are
exactly `.github/workflows/cadence-review-ingress.yml`, `.symphony.cfg.json`
and `.gitattributes`.
The other nine generated paths are absent. Existing `.github/workflows/ci.yml`
already covers seed CI: adoption should omit the optional client CI caller,
preserve that workflow and its observed check provenance, and merge config
instruction/command changes. The differently named native review, trigger,
manual, handoff, cleanup and wakeup sources are **behavioral collisions** even
without filename collisions: CT-A/Z retire or forward duplicate triggers only
after replacement runs and consumer inspection. Historical refs stay available.

The seed `.gitattributes` already contains the selected rules, so CT-A retains
them without duplication. For another target, CT-T/O preserve existing
attributes and add the two generic Linguist rules through an ordinary reviewed
merge. Keep `docs/symphony-plans/**/*.mmd -linguist-generated` after the broader
bookkeeping rule, leave top-level plans visible, and retain unrelated target
attributes. CT-T render fixtures cover both a new file and an existing file
with unrelated rules; no merge hook or application-wide attributes are added.
These rules cover the factory's `docs/symphony-plans/` convention. CT-T's fixture
must place a plan there and check the actual attributes; a target choosing another
planning directory needs corresponding reviewed globs, not assumed coverage.

New targets are not assumed empty. CT-T/L render fixtures preserve unrelated
application files and existing instructions, config, answers and license. CT-O/U/A
inspect actual collisions before reviewed merges. Root `LICENSE`, `NOTICE`,
`README.md`, package files and existing application CI are never overwritten by
participant output. CT-T carries source/license links and the existing NOTICE
attribution in the short generated guidance without replacing the target license.

Excluded from participant output and workflow publication: Terraform/AWS,
`infra/`, host installers and credentials, `tools/symphony-host/`,
`tools/symphony-dag/`, personal skills/settings, the runtime profile and host
AGENTS file, application payloads, build artifacts and local evidence. CT-C may
edit its existing runtime instructions/tests in the seed; that does not put them
in an export. `scripts/symphony/workflow.test.mjs` exercises host render/install
paths and stays seed-only. The standalone config reader is the explicit exception
to the runtime-bundle exclusion because active review/wakeup code imports it.

Do not export `scripts/cadence-codex-review.mjs`, its tests, `.github/codex/`,
the dormant controller/dispatch/acquisition machinery, or TypeScript workspaces.
The active imports of `scripts/symphony/review-contract.mjs` require that one
file and its tests; they do not authorize exporting its unused controller callers.
`cadence-pr-output-cleanup.mjs` and its tests have no retained runtime import or
instruction reference and are excluded. `design-review/SKILL.md` and the old
`design-DEMO-247-process-hardening.md` string are exclusion/fixture labels in
the verifier, not files it reads. Operator skills have the explicit delivery
contract below; exclusion from generated files does not make them optional.

### Skill census and delivery

[Jeremy's September 11, 16:47 UTC Linear comment](https://linear.app/1000lines/issue/100-47/inventory-client-files-and-justify-export-lists#comment-c5ca647d)
requires accounting for client skills, especially creating another Symphony
project. The frozen tree contains **eleven** `SKILL.md` files: three under
`.agents/skills/`, one each under `.claude/skills/` and `.codex/skills/`, and six
under `scripts/symphony/runtime-bundle/skills/`. Their paths and bytes are also
unchanged at merged PR #42 (`7fa922639706f3437de8b1c1ccc0b0e383cc8ac1`).
The table inventories source availability, not installation or live execution.

| Existing skill source                                                       | Purpose and delivery                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/symphony-project-factory/SKILL.md`                          | **Required human-operated project setup**, for the first and later projects using the same client. CT-O uses the reviewed tooling checkout and its resources below; Jeremy/parent onboarding owns making it available and invoking it. It is intentionally absent from the unattended host profile. |
| `.agents/skills/karpathy-guidelines/SKILL.md`                               | Implementation discipline. The runtime manifest installs this shared skill for workers; the operator tooling checkout also supplies the factory's required read.                                                                                                                                    |
| `.agents/skills/linear-graphql/SKILL.md`                                    | Generic Linear access guidance and fallback helper. Installed as the other shared worker skill; project creation requires the injected `linear_graphql` tool under the factory's own contract.                                                                                                      |
| `scripts/symphony/runtime-bundle/skills/symphony-repository/SKILL.md`       | Worker repository discovery, credentials and target config. Installed on the shared host; only its imported `scripts/config.mjs` belongs in the workflow export.                                                                                                                                    |
| `scripts/symphony/runtime-bundle/skills/symphony-replan/SKILL.md`           | Worker changes to accepted plans, using the shared replanning guide/templates. Installed on the host.                                                                                                                                                                                               |
| `scripts/symphony/runtime-bundle/skills/symphony-proof-of-work/SKILL.md`    | Worker evidence and review handoff. Installed on the host.                                                                                                                                                                                                                                          |
| `scripts/symphony/runtime-bundle/skills/symphony-finalize-project/SKILL.md` | Worker finalization audit after accepted upstream work. Installed on the host; does not create a project.                                                                                                                                                                                           |
| `scripts/symphony/runtime-bundle/skills/symphony-linear-api/SKILL.md`       | Worker direct Linear/attachment access when authorized and needed. Installed on the host; prefer the injected API.                                                                                                                                                                                  |
| `scripts/symphony/runtime-bundle/skills/symphony-google-docs/SKILL.md`      | Conditional worker source-document access. Bundled on the host, but usable only with configured document access; no Google credential is a client requirement or copy.                                                                                                                              |
| `.claude/skills/cadence-ai-review/SKILL.md`                                 | Central reviewer instructions, already selected with references in review-export. CT-R preserves the shared review contract across both providers; target-specific context is `.github/symphony/REVIEW.md`.                                                                                         |
| `.codex/skills/symphony-update-hosted-runtime/SKILL.md`                     | Human-only shared-host maintenance. Excluded from clients, workflow publication and the unattended profile; onboarding does not authorize host updates.                                                                                                                                             |

CT-O's planned `.agents/skills/symphony-onboard/SKILL.md` and
`references/fork.md`, `references/direct.md`, `references/walkthrough.md` beneath
that directory are **absent**, not missed existing skills. They provide the
human-operated `onboard <repo-url>` entry point in the seed. The operator may
create another project through the existing factory without onboarding or
regenerating the repository again. Per-project metadata stays in Linear.

The project-factory resource closure is the existing
`.agents/skills/symphony-project-factory/` directory: `SKILL.md`,
`templates/project-description.md`, and `templates/tickets/` containing
`requirements-and-design.md`, `plan-project.md`, `trigger-fan-out.md`,
`broaden-fanout-integration.md` and `standup.md`. The first three ticket templates
are the default seed set; the last two require a specific human request. Retain
them in the tooling checkout; their presence never authorizes extra tickets.
Its required reads also include the runtime `workflow/WORKFLOW.md`, Karpathy
skill, actual project/source documents and verified color-helper output from
`scripts/symphony/project-colors.ts`. Seed templates refer to the shared
proof-of-work, project-workflow and review guides under `docs/engineering/`.
Accepted fan-out uses the existing `tools/symphony-dag/` later. CT-O resolves
these through the reviewed tooling checkout, including its dependencies, instead
of assuming they exist in an adopter's application or copying that tooling tree.

**CT-O acceptance:** its existing initial/repeat/additional-project dry runs must
show the factory's complete seven-file directory is available in the human
operator's session, record the tooling ref/location and injected Linear access,
and verify the color/helper and shared-document references resolve. The initial
case plans exactly three seeds/two relations; repeat reuses existing resources;
an additional project uses the same repo config without a repository project
key. Missing factory/resources/access must identify the operator's setup action
before dependent project creation. A link to the source alone is not this proof.
CT-A records the actual invocation/readback in its live walkthrough;
Jeremy/parent retains installation and participant operation ownership.

This makes D1/D7's existing skill delivery explicit without adding Copier output
or a new implementation node. CT-T links these locations from `SYMPHONY.md`;
CT-U preserves them in its root instance. The eight copy rows and twelve
generated paths remain sufficient: workers use installed generic skills and
humans initiate project setup through the operator tooling. Neither review nor
CI export executes project creation. Do not install the factory in the default
unattended profile, generate a second copy of it, or claim a source census proves
the host's installed/loaded ref. The runtime bundle manifest/README document the
eight worker skills (six bundled plus two shared); installation readback remains
an operational proof obligation.

### Root dotfile census

`git ls-tree` at the frozen ref contains exactly these nine root dotfiles (all
regular blobs). Every file has a disposition below. Existing adopter dotfiles
are preserved unless the generated-path table explicitly calls for a reviewed
merge; publication metadata is not an additional participant artifact.

| Source dotfile       | Publication / staging disposition                                                                                                                                                                                                              | Participant disposition and reason                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `.eslintrc.agent.js` | Excluded: imports the seed ESLint config and requires the excluded agent guardrail rule.                                                                                                                                                       | Preserve target lint policy; no client runtime dependency.                                                                  |
| `.eslintrc.js`       | Excluded: depends on the seed TypeScript/ESLint stack, absent from the minimal publication package.                                                                                                                                            | Preserve target lint policy; remote workflows do not require this config locally.                                           |
| `.gitattributes`     | CT-M copies into `template/`; CT-T retains its generic rules and CT-U renders the root instance. Also listed once in review-export for CT-V's root.                                                                                            | Generated for every client to collapse AI bookkeeping in planning diffs; merge with existing attributes as specified above. |
| `.gitignore`         | CT-V adaptation in review-export: retain ignores for `node_modules/`, `.env`, `.env.*` and `.local/`; omit seed Terraform, TypeScript and build-output patterns unless its actual package needs them.                                          | Excluded from rendering; preserve application ignore rules. CT-O inspects target hygiene before enabling workflows.         |
| `.npmrc`             | Excluded: seed engine/save/release-age policy is not required by the exported helpers. CT-V uses the reviewed Node pin, minimal lock and `npm ci`.                                                                                             | Preserve target package-manager policy; a client can use another language.                                                  |
| `.nvmrc`             | Copy once through review-export for CT-V's Node 20.20.0 helper/test toolchain.                                                                                                                                                                 | Excluded from rendering; the application's runtime is target-owned.                                                         |
| `.prettierignore`    | Seed file excluded: its blanket `.claude/` skip is unsuitable for exported reviewer guidance. CT-Q generates its owned package-root ignore file for raw `template/`; CT-V formats explicit exported paths through its minimal package scripts. | Excluded from rendering; preserve application formatter scope. Dedicated template render tests remain required.             |
| `.prettierrc`        | Excluded: loads the intentionally excluded organize-imports plugin. CT-V uses locked Prettier defaults on its explicit path selection.                                                                                                         | Preserve application formatting policy; no client dependency.                                                               |
| `.symphony.cfg.json` | CT-M copies the frozen source; CT-T converts it. CT-U renders its root instance; CT-V creates its reviewed publication config.                                                                                                                 | Generated and merged as specified above: target-owned commands, team and required-check provenance replace seed values.     |

The four root dot-directories are not wholesale copy units: `.agents/` and
`.codex/` remain excluded, while `.claude/` reviewer resources and `.github/`
workflows/instructions use only the individually enumerated paths. New
`.copier-answers.yml` is absent at this ref and remains CT-Q metadata, not an
omitted source dotfile.

## Review and CI export closure

[review-export.txt](review-export.txt) and [ci-export.txt](ci-export.txt) contain
one relative path per noncomment line, no globs. Their sets are disjoint. Section
comments distinguish existing sources, **planned absent CT-R/C files**, and
CT-V's explicit root package adaptations. They are selection inputs, not a
command to copy absent files. CT-R and CT-C update only their own list after
merge; CT-V consumes the final union after CT-L verifies it. Exported source
paths map to identical paths at the workflow repository root, never to either
client `template/` or participant output.

The shared section in review-export assigns membership once, not new write
ownership: CT-C still owns the config reader; review-contract, actor, Linear
and workpad helpers are read-only common inputs under the plan. An unexpected
shared edit requires the existing ownership/replan procedure first.

| Entry / dependency              | Expanded source paths and reason                                                                                                                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review event and handoff        | Events/handoff import `cadence-forwarded-event.mjs`; routing uses `cadence-ai-review-route-event.mjs` → `scripts/github-actor-classification.mjs`. Handoff runs `scripts/cadence-linear-rework.mjs`, importing that router, actor, workpad and Linear wake helper.                                       |
| Review trigger and manual       | Manual calls trigger. Trigger executes `scripts/fetch-pr-review-state.mjs`, route helper, `scripts/cadence-linear-workpad.mjs`, `scripts/cadence-linear-rework.mjs`, `request-pr-reviewer.mjs`, verifier and advisory helper. `request-pr-reviewer.mjs` → `cadence-review-request-receipt.mjs` → router. |
| Advisory lifecycle              | Trigger/cleanup import `cadence-review-check.mjs`. Export its test plus all six native review/ingress workflow paths read by boundary tests. Recovery artifacts are run data, never exported source.                                                                                                     |
| Shared ledger and configuration | Review-state/workpad import `scripts/symphony/review-contract.mjs` → actor and config reader. `scripts/linear-issue-wakeup.mjs` also imports actor/config reader. All transitive code imports are explicitly listed, including tests and five workpad Markdown fixtures.                                 |
| CI wakeup                       | YAML imports `scripts/linear-issue-wakeup.mjs`, `scripts/cadence-linear-workpad.mjs` and its own wakeup helper. That helper imports the same common files. CI list includes its workflow/helper/test and the existing config-reader test; common files occur only in review-export.                      |
| Reviewer loadout                | Verifier reads the trigger, Cadence skill, `review-CLAUDE.md` and standing-docs axis. Export the skill's three references, axis test/fixture, acquisition helpers (`fetch-linear-issue.mjs`, `fetch-google-doc.mjs` and the latter's test), ledger/acceptance/actor docs and workflow AGENTS guidance.   |

Tests also read `.symphony.cfg.json` and `.github/workflows/ci.yml`: the advisory
test asserts seed aggregate children, Linear helper tests load the root config,
and the wakeup test asserts the seed CI name. These are **reference inputs**, not
exports of seed metadata. CT-R adapts its owned advisory test and CT-C its owned
wakeup test to portable configured-CI fixtures before final export. CT-V supplies
its own reviewed root config/CI for remaining generic reads; seed CI evidence
does not establish publication CI. Preserve the no-required-advisory assertion.
Links from exported reference docs to broader host/planning guidance can remain
pinned links to the seed; CT-V's path adaptation must resolve them (including the
skill's existing relative acceptance-contract link), not recursively copy the host.

### Dependencies and planned additions

Existing runtime helpers use Node built-ins, native `fetch`, Git/`gh`, shell/`jq`
and the API clients supplied by maintained Actions. The only bare npm import in
the selected tests is **`js-yaml` 4.3.2**, with locked **`argparse` 2.0.1**.
Publication formatting can use locked **Prettier 2.8.8**. Existing root
`package.json`/`package-lock.json` are listed once as CT-V adaptation inputs:
derive a minimal root manifest/lock for those dependencies and explicit exported
test paths, with no workspaces, TypeScript/Jest/ESLint stack or organize-imports
plugin merely to run these MJS/CJS tests. Do not copy the seed npm scripts/lock
wholesale. `.nvmrc` supplies the existing Node 20.20.0 pin. CT-R must enumerate
any actually needed provider dependency in its final list; none is assumed now.

- CT-C creates `.github/workflows/symphony-client-commands.yml` and
  `.github/workflows/scripts/symphony-client-commands.test.mjs`; both are absent
  at this ref. Its native/Docker/remote config and wakeup edits remain at the
  listed existing paths. Client-supplied Dockerfiles belong to targets/fixtures,
  not to either export or the copy manifest.
- CT-R creates `scripts/cadence-provider-result.mjs`, its `.test.mjs`, and
  `.github/symphony/cadence-provider-review.md`; all are absent at this ref.
  It converts the existing events/manual/trigger/handoff/cleanup entry points,
  keeps Claude and adds Codex with explicit `cadence_reviewer` selection and
  the accepted shared verdict/ledger; no automatic provider fallback.
  `early-review-evidence.md` stays a seed evidence document, linked by provenance.

## Publication assets and source attribution

CT-Q owns the new staging root `copier.yml`, `README.md`, `LICENSE`,
`PROVENANCE.md`, `tests/requirements.txt`, `tests/test_answers.py`,
`.github/workflows/ci.yml` and `.prettierignore`, plus the seed render workflow
`.github/workflows/client-template-test.yml` and raw-template ignore entry.
CT-T adds `tests/test_render.py`; CT-L closes the pending caller list and registers
the observed render check. None of these package/test/CI files is a CT-M copy.
CT-U maps the accepted **entire staging package** to the template repo root,
then renders its own concrete root client separately. Its package `ci.yml`
already tests the template, so it should omit redundant client-command CI.

Only `template/` is selected by root `_subdirectory`. CT-Q's `[[ ]]` variables
and `[% %]` blocks preserve native `${{ ... }}` expressions. Root workflow,
config, instructions, answers, tests and root-only sentinels must stay out of
participant output. Ordinary lint/format excludes raw templates; dedicated
render tests still run on template-only changes. CT-Q supplies ordinary answers
metadata per [Copier's configuration contract](https://copier.readthedocs.io/en/latest/configuring/).

CT-V creates its destination `README.md`, `PROVENANCE.md`, `.symphony.cfg.json`
and `.github/workflows/ci.yml`, uses the two package adaptation paths above, and
copies `LICENSE`/`NOTICE` from review-export. Its CI installs that minimal lock,
runs the listed tests from both exports (including planned tests once merged),
checks workflow/config syntax and formatting, and records actual required
check/workflow/App provenance. The seed tooling build/lint/test reusables stay
seed-only; they require the excluded tooling workspaces. No publication CI or
required-check name is claimed observed by CT-I.

CT-V also copies `.gitattributes` to the workflow repository root from the shared
section of review-export, once for both review and CI work. This is distinct
from the client-copy mapping into `template/.gitattributes`: CT-U renders that
file at its own root and participants receive the same generated path. Both
repositories and every client retain readable planning diffs; existing adopter
rules survive a reviewed merge. Root-only files still remain outside participant
output.

Source attribution is Apache-2.0 `LICENSE` plus `NOTICE`: “Orchestra Bio
symphony-example / Copyright 2026 Orchestra Bio, Inc.” CT-Q includes the license
and NOTICE attribution in its owned PROVENANCE; CT-U preserves them. CT-V carries
both files and records per-source commits, mapping and changes. CT-T/L retain
attribution/source links in generated guidance; adopter licenses survive.

CT-R verifies maintenance and full SHA pins for checkout, GitHub script, App
token, upload/download artifact and provider Actions. CT-C owns the currently
unpinned `actions/github-script@v8` wakeup use and its new command runner pins.
CT-Q/U/V own publication/test Action pins; CT-L checks every final caller boundary
and CT-F checks migration refs. These are assignments, not completed pin checks.
CT-L initially uses accepted full seed workflow refs; CT-F later emits literal
`1000lines/symphony-client-workflows/.github/workflows/<file>@alpha` in both
template and root callers. CT-U/V/F verify no `alpha` tag collision and record
actual template/workflow/helper commits; no self-referential SHA is required.

## Verification and handoff

CT-I checks locked Prettier on this inventory, `git diff --check`, `git ls-tree`
for every existing copy/export path, and `rg` for workflow/helper imports and
test file reads at the frozen ref. The five planned CT-C/R paths are explicitly
absent; package reductions and fixture adaptations are future reviewed work.
CI must include Changed Markdown and CI Required on this PR's actual head;
source inspection is not workflow execution or publication proof.

After human merge: CT-M receives frozen client-copy; CT-T receives the conversion
map after CT-M/Q; CT-R and CT-C receive their respective export lists. CT-L
verifies the complete generated set and final exports before CT-U/V publication.
CT-A/Z check both real consumers before seed-body retirement. No copy, workflow
implementation, custom validator, settings mutation or merge is performed here.
