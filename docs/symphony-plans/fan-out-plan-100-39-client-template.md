# Client template fan-out plan — 100-39

```yaml
project_code: client-template
project_color: pink
repository: 1000lines/symphony-example
base_branch: main
seed_issue: 100-39
target_project: Symphony client Copier template
human_lead: Jeremy Carroll
human_lead_github: jeremycarroll
human_lead_linear: c65b9fbe-e740-47e9-b444-3172d3526ff2
linear_issue_labels: [pink]
github_pr_labels: [pink, symphony]
```

Proposed September 11, 2026 for human review. This ticket publishes a plan only.
[100-40](https://linear.app/1000lines/issue/100-40) applies it only after Jeremy
approves and merges this plan and 100-39 is Done. No downstream issue exists yet
except the reused 100-43. Payload keys below are placeholders, never Linear IDs.

The result is a small client for Jeremy's shared host: build in the example,
publish the template and workflows separately, then adopt the published pair
back into the example. The thirteen new tasks and one reused task require **nine
minimum dependency rounds**, counting nodes on the longest path, not elapsed
time or worker availability. Every task begins and opens its PR against `main`
in its explicitly named target repository. No predecessor branch is a PR base.

| Key    | Outcome / owned surface                                    | Estimated additions / deletions                               | Difficulty |
| ------ | ---------------------------------------------------------- | ------------------------------------------------------------- | ---------- |
| CT-I   | Four inventories and extraction boundaries                 | +180 / -0                                                     | easy       |
| 100-43 | Existing PR #31; advisory lifecycle and readiness          | Existing work; no new estimate or ticket                      | hard       |
| CT-C   | Existing config reader, CI/wakeup workflow and tests       | +450 / -220                                                   | hard       |
| CT-R   | Native review workflows, provider result and tests         | +650 / -350                                                   | hard       |
| CT-Q   | Seven-answer package and isolated question tests           | +180 / -0                                                     | easy       |
| CT-M   | Exact copy of every reviewed client-list path              | +500–1,500 / -0, entirely copy                                | easy       |
| CT-T   | Convert copied files and test the initial template         | +300 / -400–1,300                                             | hard       |
| CT-L   | Add final CI/review callers and register render CI         | +170 / -50                                                    | hard       |
| CT-O   | One onboarding entry skill and fork/direct resources       | +240 / -0                                                     | hard       |
| CT-U   | Whole reviewed template root into public repository        | +650 / -0, primarily copy                                     | easy       |
| CT-V   | Reviewed workflow/helper export into public repository     | +2,000–5,000 / -0, primarily copy; ≤250 behavior/pin/CI lines | hard       |
| CT-F   | Final workflow pins and release provenance                 | +60 / -30                                                     | easy       |
| CT-A   | Generated callers/config/guidance, proof, staging deletion | +250 / -650                                                   | hard       |
| CT-Z   | Evidence and obsolete bodies after consumer checks         | +100 / -500–1,500                                             | easy       |

Estimates include tests and docs, are not quotas, and must not motivate extra code.
CT-M may exceed 1,000 lines only as an exact whole-list copy; CT-T removes raw
bodies while introducing the template in a separate behavioral PR. CT-R is the
largest workflow behavior change; native execution and a small common result
keep one reviewable owner for the shared trigger. CT-V's larger diff is justified
only for copying the exact reviewed lists from CT-I/C/R. Selection or behavior
changes must be distinguished from that copy and reviewed before publication.

## Sources, precedence and assumptions

- Required [MVP source](https://linear.app/1000lines/document/hackathon-mvp-scope-client-template-source-c5a644291330): full Linear document
  `c69b0b0d-39fb-4b20-b7e9-1da1372b6863`, updated `2026-09-11T12:47:03.100Z`, read via injected GraphQL.
- Full [project brief](https://linear.app/1000lines/project/symphony-client-copier-template-0b2d70d81c4f)
  and current 100-39/100-40 seed context. The parent owns participant operation,
  credentials, host concurrency and the three-repo rehearsal; this plan owns
  skill artifacts and one owner-controlled walkthrough, not that wider rehearsal.
- [Human-approved merged design](https://github.com/1000lines/symphony-example/blob/99d401cf7653e4297569c29e62c4ec265fd84e1c/docs/symphony-plans/client-template-design.md),
  D1–D9 / AC1–AC13: PR #30 merged at `2026-09-11T13:33:50Z`, merge `99d401cf7653e4297569c29e62c4ec265fd84e1c`; 100-38 Done.
- Jeremy's [workflow publication](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5634828727),
  [multi-project, skills and modes](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5634926972),
  [accepted public-fork App](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5634958976),
  [advisory check](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5635132545)
  and [readiness](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5635138859)
  comments read in full; GitHub readback confirms his admin access.
- Newer Linear history on 100-39 at `2026-09-11T13:40:02.547Z`, actor Jeremy Carroll,
  removes the 100-43 blocker and adds `related`; current relation readback agrees.
  This supersedes the design's requirement to wait before writing this plan.
  Do not restore that old blocker. Reuse 100-43 as a hard input to CT-R, where
  its merged source and initial live proof are actually consumed.
- [Jeremy's PR #34 decomposition decision](https://github.com/1000lines/symphony-example/pull/34#issuecomment-5635719306),
  September 11 at 14:12 UTC, supersedes the combined CT-T and its CT-C/R gate.
  Make list → straight copy → template conversion separate PRs, run the seven
  answers independently and integrate late Docker/Codex additions afterward.
  Verified GitHub admin authority; this revises the existing unaccepted plan,
  with no new planning seed or live downstream ticket.
- [100-43 / PR #31](https://github.com/1000lines/symphony-example/pull/31): refreshed
  September 11, now Done; PR merged at 14:02:53Z as
  `ca5c37344df600468ee69e73c04c54197a5b062c`. CT-R still reads its workpad and
  verifies required initial live proof; Done alone is not execution evidence.
- Required baseline `3de96c9f739d732cc7efd498225b4444b547cc57` and selected main
  `99d401c` (initial); refreshed main `77b6b687e2213157ccfde75fef3867a4b886367c`
  retains the same team/CI contract. README, config, native workflow/AGENTS guidance, runtime WORKFLOW,
  package/toolchain, CI, review contract, shared [schema](fan-out-plan-schema.md),
  [criteria](fan-out-criteria.md), proof/PR/replan guidance and DAG APIs read.
  PR #29's inheritance workaround and closed/unmerged #24 are context only.
- Official [Copier configuration](https://copier.readthedocs.io/en/latest/configuring/)
  and [GitHub reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
  read. Use ordinary Copier source/ref metadata and explicit per-hop secrets.

Required sources unavailable: **none**. Downloads and `orc-app` are optional.
No product decision remains open. Repository-name availability, grants, toolchain
versions and emitted CI provenance are execution lookups owned below, not invented
values or reasons to block independent preparation.

Two design statements need implementation precision. The existing reader requires
`ci.requiredChecks` entries with a verified check `appId`; prohibit credentials,
Linear project binding and installation IDs in config, not that check provenance.
Also, current wakeup YAML hardcodes `workflows: [CI]` / `workflow_id: ci.yml` and
ignores generic successful external checks. CT-C must make the existing path use
the target's actual required checks. AC8/AC12 already require compatibility; this
plan neither claims it exists nor commissions another controller.

## Breakdown and dependency rationale

The original combined CT-T offered ten new tasks/eight rounds, but mixed copying
with template behavior and waited for all Docker/Codex work. A fully serial
list/copy/questions/conversion plan would separate review but unnecessarily hold
question authoring. The chosen split has thirteen new tasks/nine rounds: CT-Q
owns package metadata/question tests in parallel with CT-I and CT-M's file work;
CT-M is only exact copying, then CT-T introduces the template. CT-C/R progress
alongside those lanes, and CT-L adds their completed interfaces before release.
This preserves all final acceptance criteria while accepting one extra minimum
round and three more focused PRs. The large copy diff contains no hidden changes.

The explicit preparation path is I → M → T. Q → T joins the independently
implemented seven-answer package only for the actual conversion/render tests.
Neither Q, M nor T waits on C/R; their later additions join at L. I/Q/M/C/R own
disjoint writable paths and isolated fixtures when unordered: copied source is
pinned and read-only even while C/R edit their own workflow sources. T takes M's
tree and Q's README/provenance only after both merges. L then takes T's tree/tests
and consumes C/R without editing their implementations. O/U are disjoint after L.
No live shared secret or proof resource is used by Q/M/T/L.

Every drawn edge is hard: its downstream outcome needs a reviewed artifact on the
selected base (or an accepted published ref), or relinquished write ownership.
U → V also preserves the near-end workflow-publication sequence; O → A supplies
the actual skill for its walkthrough. Transitive edges are omitted. The longest
path is I → M → T → L → U → V → F → A → Z, nine nodes. No no-op joins.
Publication, final pins, real adoption and consumer-aware retirement stay intact.

## DAG

```mermaid
%% symphony-dag/v1
flowchart LR
  I["Round 1: CT-I · Review exact client-copy manifest and export lists"]
  Q["Round 1: CT-Q · Define seven answers independently"]
  CHECK["Round 1: 100-43 · Reuse accepted advisory check and ready handoff"]
  M["Round 2: CT-M · Straight copy of every listed file in its own PR"]
  C["Round 2: CT-C · Support native Docker remote CI and portable config"]
  R["Round 2: CT-R · Add reusable explicit-secret Codex and Claude review"]
  T["Round 3: CT-T · Convert copied files into initial template in its own PR"]
  L["Round 4: CT-L · Add late CI and Codex parts before release"]
  O["Round 5: CT-O · Deliver fork direct and repeat onboarding skill"]
  U["Round 5: CT-U · Publish complete template repository"]
  V["Round 6: CT-V · Publish reusable workflows and required helpers"]
  F["Round 7: CT-F · Release template pinned to published workflows"]
  A["Round 8: CT-A · Adopt published pair and prove live consumer paths"]
  Z["Round 9: CT-Z · Retire migrated bodies and finalize evidence"]
  I --> M
  I --> C
  I --> R
  CHECK --> R
  M --> T
  Q --> T
  T --> L
  C --> L
  R --> L
  L --> O
  L --> U
  U --> V
  V --> F
  O --> A
  F --> A
  A --> Z
```

[Standalone matching graph](fan-out-plan-100-39-client-template.mmd).

## Manifest and branch declarations

The following is the branch manifest as well as the DAG manifest. `${issue}` is
replaced only with the real assigned identifier. CT-U/F target the template repo;
CT-V targets the workflow repo; all others target the example. The existing
100-43 branch/PR and Misc project/color are preserved, not relabeled or recreated.

```yaml
schema: symphony-dag-manifest/v1
project:
  code: client-template
  color: pink
  base_branch: main
  human_lead: Jeremy Carroll
  human_lead_github: jeremycarroll
  linear_issue_labels: [pink]
  github_pr_labels: [pink, symphony]
defaults:
  initial_state: Active
  maturity_label: mature
  task_branch_base: main
  task_pr_base: main
  task_pr_draft: true
  issue_assignee: Jeremy Carroll
  pr_assignee: jeremycarroll
  edge_semantics: direct_blocker_to_blocked
  relation_type: blocks
  mutation_policy: fail_closed
nodes:
  - id: I
    payload_key: CT-I
    title: Inventory client files and justify export lists
    type: task
    difficulty: easy
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/inventory
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: CHECK
    existing_issue: 100-43
    issue_id: 57d7cdf2-4283-4baa-8a36-5a1194615160
    title: Inherit advisory Cadence check and ready handoff
    type: existing_task
    difficulty: hard
    labels: [blue]
    branch:
      ref: symphony/misc/100-43/cadence-advisory-check
      base: main
      birth: existing
    pr:
      url: https://github.com/1000lines/symphony-example/pull/31
      base: main
      draft: true
      labels: [blue, symphony]
  - id: C
    payload_key: CT-C
    title: Support portable config and native Docker remote CI
    type: task
    difficulty: hard
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/compatibility
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: R
    payload_key: CT-R
    title: Make native review reusable with explicit secrets and Codex
    type: task
    difficulty: hard
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/review
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: Q
    payload_key: CT-Q
    title: Define and test the seven Copier answers
    type: task
    difficulty: easy
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/answers
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: M
    payload_key: CT-M
    title: Copy every listed client file without changes
    type: task
    difficulty: easy
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/copy
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: T
    payload_key: CT-T
    title: Convert the copied files into the initial template
    type: task
    difficulty: hard
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/template
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: L
    payload_key: CT-L
    title: Integrate late CI and Codex additions before release
    type: task
    difficulty: hard
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/integrate-template
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: O
    payload_key: CT-O
    title: Deliver fork direct and repeat onboarding skill
    type: task
    difficulty: hard
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/onboarding
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: U
    payload_key: CT-U
    title: Publish the reviewed template repository
    type: task
    difficulty: easy
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/publish-template
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: V
    payload_key: CT-V
    title: Publish reusable workflows and required helpers
    type: task
    difficulty: hard
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/publish-workflows
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: F
    payload_key: CT-F
    title: Release template pinned to published workflows
    type: task
    difficulty: easy
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/release
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: A
    payload_key: CT-A
    title: Adopt published template and prove live consumer paths
    type: task
    difficulty: hard
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/adopt
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
  - id: Z
    payload_key: CT-Z
    title: Retire migrated bodies and finalize evidence
    type: task
    difficulty: easy
    labels: [pink]
    branch:
      template: symphony/client-template/${issue}/finalize
      base: main
      birth: on_dispatch
    pr:
      create: on_branch_birth
      base: main
      draft: true
      labels: [pink, symphony]
edges:
  - from: I
    to: M
  - from: I
    to: C
  - from: I
    to: R
  - from: CHECK
    to: R
  - from: M
    to: T
  - from: Q
    to: T
  - from: T
    to: L
  - from: C
    to: L
  - from: R
    to: L
  - from: L
    to: O
  - from: L
    to: U
  - from: U
    to: V
  - from: V
    to: F
  - from: O
    to: A
  - from: F
    to: A
  - from: A
    to: Z
```

## Linear Relation Payloads

Resolve each key to its actual issue UUID after creation/reuse; then submit exactly
`{issueId: blockerUUID, relatedIssueId: blockedUUID, type: "blocks"}`. This table
and the graph/manifest have the same sixteen direct edges. There are no live UUIDs
for future tasks yet; do not submit a placeholder or reverse an endpoint.

| Source    | issueId (blocker key) | relatedIssueId (blocked key) | type     |
| --------- | --------------------- | ---------------------------- | -------- |
| I → M     | `CT-I`                | `CT-M`                       | `blocks` |
| I → C     | `CT-I`                | `CT-C`                       | `blocks` |
| I → R     | `CT-I`                | `CT-R`                       | `blocks` |
| CHECK → R | `100-43`              | `CT-R`                       | `blocks` |
| M → T     | `CT-M`                | `CT-T`                       | `blocks` |
| Q → T     | `CT-Q`                | `CT-T`                       | `blocks` |
| T → L     | `CT-T`                | `CT-L`                       | `blocks` |
| C → L     | `CT-C`                | `CT-L`                       | `blocks` |
| R → L     | `CT-R`                | `CT-L`                       | `blocks` |
| L → O     | `CT-L`                | `CT-O`                       | `blocks` |
| L → U     | `CT-L`                | `CT-U`                       | `blocks` |
| U → V     | `CT-U`                | `CT-V`                       | `blocks` |
| V → F     | `CT-V`                | `CT-F`                       | `blocks` |
| O → A     | `CT-O`                | `CT-A`                       | `blocks` |
| F → A     | `CT-F`                | `CT-A`                       | `blocks` |
| A → Z     | `CT-A`                | `CT-Z`                       | `blocks` |

## Decisions

1. **List, copy, conversion are separate PRs.** Jeremy's PR #34 decision is
   enforced by CT-I's fixed copy manifest, CT-M's byte/mode-identical copy and
   CT-T's template conversion. CT-Q owns the independent seven-answer package;
   CT-L integrates late CT-C/R additions before publication. CT-C/R update only
   their own export lists; CT-U/V compare against the final accepted lists.
2. **Keep native review and one small verdict.** CT-R wires Codex/Claude into the
   existing workflow, preserving author checks, freshness, feedback and 100-43.
   OpenAI wins when present; Anthropic alone selects Claude; neither fails early.
   API failures do not switch providers. No dormant controller is revived.
3. **Explicit least-secret boundaries.** CT-R/L/V/F map App, Linear and optional
   provider secrets at every review call; handoff has App/Linear; wakeups have
   Linear only; CI and ingress have none. IDs/slugs are named config inputs.
4. **Seven answers and many projects per repo.** CT-Q/T/L/O keep only repo slug,
   default branch, Linear team, two App slugs, build and test commands. Optional
   `ci.mode` belongs to existing config, not an eighth question; project metadata
   comes from the issue. Preserve actual required-check name/workflow/App values.
5. **Native, client Dockerfile, remote.** CT-C implements the accepted existing
   reader/wakeup compatibility; CT-A proves real mode behavior and failure/recovery.
   Remote records missing tooling and publishes for mandatory CI. No new host
   orchestration, validator or compulsory host toolchain installation.
6. **Two public repositories and final proof.** CT-U publishes template content;
   CT-V publishes workflows/helpers; CT-F releases final pins; CT-A proves that
   exact pair. CT-Z retires old bodies only after a consumer census and replacement
   runs. Preserve historical refs, manual paths and needed forwarders.
7. **Onboarding is a small skill.** CT-O owns entry/fork/direct/repeat procedures;
   CT-A owns one owner-controlled walkthrough. Jeremy/parent owns installation,
   invocation, participant credentials and wider rehearsal. Public forks use the
   existing App with accepted contents/actions/metadata read and PR/issues/checks
   write authority across the installation. No new key service/isolation gate;
   direct/private adopters use owner-created Apps and separate guidance.
8. **Current-head human handoff.** Reuse 100-43; clean current-head verdict with
   no newer accepted feedback readies a draft, findings stay draft, already-ready
   PRs stay ready. `Cadence review` remains advisory, outside required CI and merge
   gates. No AI verdict authorizes merge or human acceptance.
9. **Clean main branches and explicit ownership.** All tasks use main/main;
   cross-repo publications use their own main. Hard predecessors must be accepted
   on that base/ref before dependent implementation; independent notes may still
   be published as drafts. No committed unmerged predecessor work.
10. **Reuse seeds and fail closed.** 100-38 is accepted design; 100-39 plans;
    existing 100-40 fans out; existing 100-43 supplies shared behavior. No duplicate
    advisory implementation, planning seed, validator or no-op join ticket.

## Ticket source and execution contract

Copy this section, the item's complete section and its incoming relation rows
into every generated description. The per-task files are part of this plan:

- [CT-I/Q/M/C/R/T/L/O: implementation items](client-template/implementation-items.md).
- [100-43 and CT-U/V/F/A/Z: delivery and reuse items](client-template/delivery-items.md).
- [Validation and dry-run rendering](client-template/plan-validation.md).

Use the item's explicit repository override when opening a publication task.
Set project `client-template`, assignee Jeremy and Linear `pink`; each new PR
requires `symphony` and `pink`, assigned `jeremycarroll`. Difficulty is descriptive,
not an invented Linear label. The reused 100-43 retains Misc/blue and its owner.

Before live fan-out, 100-40 resolves states Backlog/Active/Inactive/Unhappy/Evaluating,
labels pink/mature/wake:15m, both GitHub labels in each actual destination, assignee,
selected branch refs, existing issue/PR associations and every relation endpoint.
Missing or conflicting values fail closed before affected writes. Do not create
labels or expand credentials to make a preflight pass. If a new publication repo
is absent, its future owner creates/verifies it during its task; that absence
gates only destination operations, not unrelated ticket creation.

Generate temporarily in Backlog, record actual IDs, create/read back exactly the
hard relations, and only then move all new tickets to Active unless Jeremy asks
for a hold. Preserve terminal/existing issues. Verify the complete DAG before
activation; on partial failure leave staged issues parked, record exact IDs and
resume without duplicates. Blocking is a relation property, never a workflow
status. 100-39 creates none of these tickets.

Open each PR draft against main. Use `[<issue>]: <brief-title>`, a short business
purpose, linked current progress diagram, selected base and actual evidence.
Validate **local → Docker if needed → mandatory current-head CI**, even docs-only
changes. Run the item's targeted commands, then the target's required checks;
fix actionable failures before publication. Passing local checks means
`Docker: skipped — passed locally`. For a host environment gap, use its documented
container or a pinned compatible image, recording digest, command and result.
Mount only the issue workspace, use its UID/GID, remove task containers and do
not publish ports. The specifically accepted remote mode instead runs available
checks, records missing tools and hands the prepared head to GitHub CI; it does
not call skipped tests passes or waive known failures.

Seed CI is `CI Required` / `.github/workflows/ci.yml` / GitHub Actions App `15368`,
with build, lint, test and Changed Markdown children. CT-Q creates render CI; CT-L registers the completed template check.
Publication repos must carry reviewed CI for the actual package, discover its
real check/workflow/App provenance and record required checks before activation;
never assume seed job names are universal. Record target SHA, local commands,
container skip/digest, workflow/event/ref/run/attempt and required child results,
artifacts, acceptance criterion, limitations and next owner per the proof standard.

Pending/missing CI: Unhappy + wake:15m; failed current-head CI/conflict: Active;
passed CI waiting for review/operator: Inactive without wake:15m. Recheck head and
issue state before mutations and preserve newer/terminal state. Cadence findings
with known fixes are rework; missing access gates only dependent work. For an
unavailable admin operation, deliver its reviewable PR first and name repository,
App, exact failed operation, required permission, Jeremy/target-owner action and
readback. Do not claim deployment from source or bundle fixtures.

Set blocker-side `mature` only after required CI and configured Cadence approve
the current head, mandatory feedback is closed, branch contains no unmerged
predecessor work and PR is ready. Record reviewer, SHA, verdict and workpad;
inspect new human feedback before handoff. Remove only for request-changes,
rejected/stale acceptance evidence or comparably severe regression, not ordinary
edits alone. An unsatisfied hard artifact/merge dependency still pauses dependent
implementation even if the runtime dispatches on maturity. Planning seeds cannot
be mature before human approval and merge. Human acceptance owns Done; this plan
authorizes no merge or admin override.

## Completion gates

CT-Z must account for every design AC: CT-I/M/Q/T/L (AC1/2), CT-R/L (AC3/4), CT-R early
and CT-A final real Codex review (AC5), CT-U (AC6), CT-A (AC7), CT-C/L/A (AC8),
CT-O/A (AC9), all delivery owners (AC10), CT-V/F/A (AC11), CT-C/A (AC12), and
100-43 plus CT-R/V/A (AC13). Missing live evidence leaves the responsible delivery
open; it cannot be relabeled as a documentation pass.

No project completion until both public refs resolve, final consumers run those
refs, mandatory CI/review and owner-controlled onboarding/mode evidence exist,
staging is gone, old entry points are retained or retired with consumer evidence,
and project-scoped temporary work is resolved. Preserve historical plans as dated
records. Parent rehearsal/concurrency, application deployments, Terraform,
`copier update`, upstream submission and new shared process machinery are excluded.
