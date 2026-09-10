# Hackathon readiness execution contract

This is required ticket content for the [100-7 plan](../fan-out-plan-100-7-hackathon-ready.md).
The accepted design at controller commit
`dc71026c35b7fc97f58e54cd03ce7fe513621e1f` defines the detailed requirements.
Its R/D/O identifiers are preserved below. These are implementation instructions
for later accepted tickets, not claims about the current deployment.

## Fan-out and common ticket rules

100-8 reads the human-accepted merged plan revision and pins links to this plan,
each item document, this contract and repository source documents. For each
manifest node, find the identically named YAML item in its `source_notes` link.
Copy that item's summary, file lists, resources, exclusions, acceptance checks,
commands, dependencies, delivery notes and temporary-seam metadata verbatim.
Copy its manifest labels/state/branch/PR policy and these common rules. No item
field is optional merely because the shared structural renderer omits it.
Show one completed body for inspection before live writes. Preserve empty lists
as `none`. Idempotently replace generated content rather than appending it.

Create exactly thirteen delivery issues and two monitor issues; do not duplicate
100-6, 100-7 or 100-8. CI/RUST and both monitors start Backlog; all other nodes
start Blocked. Initial issue label is `pink`, never `mature` or a wake label.
Jeremy assigns activation after fan-out review. Resolve all required label/state,
project/team/assignee IDs and selected branch refs before issue creation; resolve
all returned issue IDs before writing the exact sixteen directed relations.
Use blocker → blocked: `issueId`, `relatedIssueId`, `type: blocks`. No soft
sequencing relation or generated join is added. A partial API failure is recorded
with actual IDs; reconcile before retrying rather than duplicate issues.

Verify existing `pink` and `mature` Linear labels and `pink`/`symphony` GitHub
labels on each PR repository. Missing labels, compatible states, assignee mapping,
branch refs or ambiguous issue endpoints fail closed; no silent defaults, label
creation or scope expansion by the fan-out agent. DEPLOY explicitly owns later
daemon-state and `wake:15m` provisioning. Confirm no existing monitor before
fan-out; if one now exists, stop for an accepted reuse amendment, not a duplicate.

Every code/docs task branches from its repository's current `main` and opens a
draft PR against `main`, assigned to `jeremycarroll`, labeled `pink,symphony`.
Never commit predecessor work absent from that base. Hard predecessors provide
accepted results and landed code; maturity alone does not substitute for a needed
merge. Pin a single Codex workpad per issue and record exact source reads, scope,
ownership, target SHA, commands/results, PR/check URLs and human feedback ledger.
Publish one tested checkpoint at a time. Keep the issue Inactive during CI/review
and operator waits; no worker sleeps awaiting jobs as a monitoring strategy.

After check-contract cutover, AI acceptance means a fresh successful
`Cadence Review` from Cadence App `4866513` with durable workpad evidence.
It is never an automated APPROVE review. `ci_passes` and `ai_accepts`, current
head and human-feedback generation, a closed mandatory-feedback ledger, a clean
task branch and a ready PR are all required to label the blocker `mature`.
Remove maturity for request-changes, rejected acceptance, stale current-SHA
evidence or similarly severe downstream-invalidating regression. Ordinary edits
alone do not revoke it. Human approval/merge owns acceptance/Done. Bootstrap
uses the working reviewer until verified cutover; it never claims App/Codex proof.

## Validation shared by delivery nodes

Read each target's README, relevant toolchain/package files, adopter instructions
and `.github` workflows. Run relevant local tests first; a failing assertion
requires a fix. If those tests pass, record `Docker: skipped — passed locally`.
If the environment lacks a required tool/service, use its documented container
or a pinned compatible image. If neither environment works, publish available
proof and the precise limitation for repository CI; do not install every compiler
or claim a skipped test passed. Every published change, including documentation,
needs current-commit repository CI. Capture child jobs as well as the aggregate.

Controller: CI's `.github/workflows/ci.yml` runs existing build/lint/test plus
changed Markdown using locked Prettier. `CI Required` is a planned name, verified
from the first real run, with expected GitHub Actions App ID `15368`. Leaf jobs
and Markdown use 20-minute timeouts; aggregate execution uses five minutes.
Default run budget is 120 minutes. A job whose children skipped cannot pass.
CI's initial PR can run its branch push workflow using the existing identity;
future default-branch-only dispatch is never evidence for its creating PR.

Rust target: preserve `Test Suite (NCOLORS=3)` through `(NCOLORS=6)`,
`Clippy (Linting)` and `Format Check`, App ID `15368`, workflow `ci.yml`.
Verify each at the exact PR head after RUST lands; every job timeout is 60 minutes.
Use the existing release tests and doc tests for all four feature variants,
Clippy for default and `ncolors_5`, and `cargo fmt --all -- --check`.
DEPLOY proves both locally available tooling with Docker skipped, and a
Rust-unavailable host using Docker. A suitable observed host image is
`rust@sha256:7fa728f3678acf5980d5db70960cf8491aff9411976789086676bdf0c19db39e`
(`rust:1.90.0-slim`); verify compatibility with the target's toolchain contract
before using it. Run as the workspace UID/GID, mount only that issue workspace,
remove the task container and record the resolved image digest. No shared cache
resets, public test ports or pruning other workers' resources.

Every proof row names target ref, command/environment, R criterion, durable
artifact/run link, actual result, limitation and next handoff. Proposed new CLI
commands in items are interfaces their named producer must implement, not
existing commands or proof. Placeholder refs are populated from API readback.
No screenshot, deployment, timer, credential or passing check is inferred from
source inspection. Tests cover failures at actual public entry points, including
malformed/missing output, denied workpad writes and changing PR heads.

## Shared predicates and review behavior

GATE owns the trusted `.github/symphony/repositories.yml` mapping, loaded from
protected controller main. Include enabled flag, numeric repository/name,
team/project/human identity, both App and per-owner installation IDs, dispatch
workflow/ref, exact CI allowlist and waiting limits. Initially disable incomplete
entries. INSTALL records IDs in evidence; DEPLOY alone fills and enables entries.
Controller and host must share the mapping revision. Caller inputs cannot choose
installations, permissions or another project's identity.

`ci_passes` requires every nonempty allowlist member's latest applicable attempt
to complete successfully at the current head. Each member names check, owning
App ID, workflow path, allowed event/ref, tested head and child job IDs when
applicable. Verify Actions run/job provenance; App ID alone cannot distinguish
different Actions workflows. Reject ambiguous duplicates, missing, stale,
failed, canceled, timed-out, skipped, neutral, action_required or unknown results.
Review/router/label/deploy checks never implicitly enter required CI.

`ai_accepts` also requires open PR, valid labels/project, configured Cadence App,
`Cadence Review`, exact target head, latest required generation, valid output,
no open mandatory findings and matching persisted workpad. Generation includes
human GitHub/Linear feedback IDs/update times, base/config revisions and explicit
manual retry. Acquire all submitted reviews, conversation comments, inline
threads/replies and Linear comments; incomplete history forces full review.
Workpad bookkeeping cannot reset generation or the three-pass cap, even if it
uses a human-owned credential. Queue before dispatch; recheck live head and
watermark before publication. Old attempts cannot overwrite newer results.

CODEX preserves all accepted axes, stable finding IDs and classifications:
blocker and human-needed prevent acceptance; should-fix/suggestion remain
nonblocking unless the human makes them mandatory. Acquire from trusted base
code; assess bounded read-only evidence in a fresh Codex home; publish through
trusted code in a separate job. No PR script runs with provider/publication
credentials. Pin Action `86365089eb2b84e0a8fb0717b304f8bdcb13b20e`, CLI
`0.153.4`, model `gpt-6-astra`, effort `xhigh`, read-only sandbox, drop-sudo
and the Action API proxy. Changes to accepted pins require reviewed correction.

Check results: queued/in_progress is pending; clean validated/persisted assessment
is success; actionable blockers are failure; human-needed/cap is action_required;
provider/API/output/workpad failures are operational failure; superseded/canceled
or timed-out work cannot accept. ROUTE dispatches only authorized mapped targets
and explicitly trusted App actors, coalesces identical generations and retains
human-feedback resets. Human review requests use eligible human assignees only.

## Wait actions and persistent monitors

WAIT exports one reconciliation action path for event bridges, publication and
monitor scans. Observe live state before deciding and immediately before mutation;
persist actual readback, action key and failures. Do not claim distributed
exactly-once behavior: Linear has no compare-and-swap. Preserve terminal states
and categories, closed PRs, other projects, Backlog and Blocked. Never activate
the parked frontier through CI or maturity.

| Observation                                             | Required action                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Required CI pending within deadlines                    | Inactive, pending names/URLs; release slot.                                                                                                      |
| Missing check before publication + 20m                  | Inactive; no passing evidence.                                                                                                                   |
| Actionable current-head CI or mandatory review finding  | Re-read and wake Inactive → Active once with diagnostic; already Active is no-op.                                                                |
| Confirmed merge conflict in opted-in Active/Inactive PR | Same bounded correction wake; do not wake parked work.                                                                                           |
| Green CI but absent/pending/stale AI                    | Inactive; ensure one current queued review.                                                                                                      |
| Both predicates and mandatory ledger closed             | One handoff-only Active wake keyed by issue/PR/head/generation/action; worker rechecks, marks ready/mature, requests human and returns Inactive. |
| Human-needed/cap, credential/configuration failure      | Inactive, exact named human/operator action; no invented code fix.                                                                               |
| Overdue/canceled/timed-out/neutral/skipped/unknown CI   | Inactive; at most one safe allowlisted retry, otherwise concrete operator handoff.                                                               |
| Human changes request/actionable comment                | Existing direct feedback wake; approval with notes queues a fresh review.                                                                        |

Evaluate terminal conclusions before deadlines. Missing threshold is 20 minutes;
runnable queued threshold is 60 minutes. Child-dependent waiting inherits child
progress. Running deadline is actual started_at + configured job timeout + two
minutes visibility grace; run creation + 120 minutes bounds the whole attempt.
Record deadline and observation time. New heads reset deadlines, repeated scans
do not. Retry requires same head, no active attempt, terminal run or verified
dispatchable allowlist entry and durable unused budget. Never retry a running
stuck job concurrently. Review timeout is 60 minutes and permits at most one
operational retry per generation, separately from the three-pass findings cap.

Each monitor copies this section and its exact repository/team/project allowlist,
human owner and nonempty CI requirements into its issue. It stays Backlog until
DEPLOY establishes prerequisites and Jeremy authorizes activation. Set
`active_states: [Active, Evaluating]`, `daemon_states: [Happy, Unhappy]`,
`daemon_dispatch_states: [Evaluating]`, default wake `15m`, and Evaluating
concurrency one. Happy/Unhappy are nonterminal resting states disjoint from
active/terminal; Evaluating is started. Discover/reuse compatible states, read
back IDs, and bind the two monitor IDs returned by 100-8. DEPLOY provisions and
applies `wake:15m`; fan-out never requires these future states/labels to exist.

Scan only that repository's opted-in waiting tickets and open Active/Inactive
PRs, including mergeability, complete feedback and stalled dispatches. Budget
five minutes, persist cursor/counts and resume without starvation. Run no product
tests/fixes. A completed healthy scan, including in-budget pending CI or zero
eligible work, rests Happy. Failing/stale/overdue checks, conflicts, access errors,
unreconciled handoffs or partial scans rest Unhappy even if the wake succeeded.
Both verdicts wake again. Use the monitor's Codex workpad for details; the engine
alone writes its Symphony anchor. Missing/duplicate anchors are visible failures.

Measure the real engine timer: anchor + 15 minutes with stable jitter
{-60,-30,0,30,60} seconds, then polling/capacity delay. No strict 15-minute SLA
or wake:5m. Existing runtime retries and restoration after three failed retries
are observed, not assumed; missing history may require Jeremy to restore state.
Persist/recheck action keys across event/monitor races, including terminal human
transitions. Serialize controlled fault injection with monitor access; normal
event/scan concurrency uses the same idempotent action contract.

## Ordered operator and resource handoffs

APP/GATE/CODEX/WAIT/ROUTE/GUIDE prepare code with mocks and local bundles, with
no live secret/host mutations. INSTALL owns initial App visibility, grants,
installations and protected secret destinations; its evidence file supplies
read-only inputs to DEPLOY. RUST owns only target workflow/docs changes and its
task CI. These preparation branches/files and mutable resources are disjoint.

DEPLOY takes exclusive setup/rehearsal custody after GUIDE/INSTALL/RUST. It owns
mapping completion, host install/reload, protected branch settings, live review
cutover, daemon setup, workflow enablement and rehearsal mutation. Before any
privileged smoke, identify actual caller permissions and give Jeremy exact
missing-admin steps in the prepared PR. Verify both Apps are public and approved
on both owners; never reuse an installation ID across owners. Verify neither bot
is a collaborator of the target and that no Jeremy/customer PAT participates.

The `cadence-controller` Environment restricts secrets to protected main:
`CADENCE_APP_PRIVATE_KEY`, `CADENCE_OPENAI_API_KEY`, `CADENCE_LINEAR_API_TOKEN`;
variables include App ID and controller installation ID. Implementation signing
material goes to AWS `symphony/github-apps/symphony` in `us-west-2` with narrow
host read access. Never put secrets in Terraform, target repositories or evidence.
Registration increases require operator approval; minting another token cannot
supply missing grants. Installation/preflight proof includes expiry renewal,
revoked/suspended/unselected/denied grants and write retry readback.

The wakeups workflow is currently `disabled_fork` and has no proven recovery
coverage. Jeremy enables `.github/workflows/symphony-linear-wakeups.yml` with
`gh workflow enable symphony-linear-wakeups.yml --repo 1000lines/symphony-example`
when accepted code/credentials are installed; read back active state and prove a
completion run. Do not call its old cron a verified rollback path. Once a monitor
is proven, exclude that mapping from the existing `17,47` sweep; legacy coverage
remains only where enabled and actually verified. Rollback parks the monitor
and restores coverage only after verifying the replacement path works.

Keep production legacy review selected while rehearsing the new flow on the
isolated Rust target. For every opted-in open PR, inventory and dismiss only
legacy Cadence bot approvals/remove its pending requests, record IDs/readback,
then queue fresh checks before check-only cutover. Preserve human reviews. A
denied dismissal blocks that target with the exact operator action. Temporary
legacy selectors carry HACKATHON_LEGACY_AUTH/HACKATHON_LEGACY_REVIEW markers;
RETIRE removes them after proof, without a mixed-signal acceptance mode.

RETIRE then owns legacy-path/secret retirement and hands off the entire
`symphony/keys` JSON write lease to ROTATE. ROTATE re-reads the latest object,
changes only OPENAI_API_KEY, and preserves every other field. This shared object
is why RETIRE → ROTATE is hard despite distinct key fields. ROTATE drains
workers/reviews, updates `cadence-controller:CADENCE_OPENAI_API_KEY`, runs
`install-runtime.sh --only 40-credentials` from the accepted checkout and restarts
Symphony. Record refreshed `/etc/symphony/runtime.env`, Codex auth materialization,
service/polling and fresh host/Cadence execution, never values. If the event key
has not arrived, earlier rollout proceeds and final readiness waits on Jeremy.

FINAL takes final host/rehearsal custody after ROTATE. Ensure retirement changes
are actually deployed, rerun combined smoke at recorded controller/Rust/runtime
refs, and consolidate MIGRATION.md. Preserve durable repository `enabled`
opt-in; remove temporary markers and all specifically introduced stubs/adapters.
The disabled AMI updater's PAT dependence is explicitly deferred and not a
working App-only recovery route. No bot-account deletion. Jeremy owns ongoing
monitors; their resting states are not unfinished delivery tasks.

## Live rehearsal and closure matrix

DEPLOY's smoke harness records assertions and evidence; it is project-specific
implementation tooling permitted by the brief, not planning infrastructure.
Use dedicated reversible readiness fixture files and clean main-based rehearsal
branches, with pink/symphony labels and Jeremy assignment. Intentionally failing
code stays in the isolated rehearsal PR and is corrected before acceptance;
never merge intentional failure. Clean up fixtures after retaining durable proof.

| Requirement | Evidence owner and required scenario                                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01/R05     | CODEX fixtures and DEPLOY real pinned review, structured findings, exact target App/check/head/generation/workpad; provider/output/persistence failures reject.                                 |
| R02         | ROTATE new secret versions, reload and newly started successful host and Cadence tasks. Missing external key blocks FINAL.                                                                      |
| R03/R04     | INSTALL identity/grants plus DEPLOY App-authored clone/push/workflow PR/labels/CI/review/handoff, no bot collaborators or hidden PAT; lifecycle denial/renewal cases.                           |
| R06/R07     | CI/RUST caller evidence plus DEPLOY docs/code current-head runs and both validation paths; capture all child checks, App identity and branch-secret denial.                                     |
| R08         | DEPLOY failed CI → one Active correction → fresh green head/review → ready/human; pending work releases slot, old/same-head-stale evidence rejected.                                            |
| R09         | WAIT fixtures and DEPLOY real dropped-event timer, anchor/due/dispatch/verdict, conflict recovery, scan cursor, crash/history/API failure and duplicate/terminal interleavings.                 |
| R10         | DEPLOY actual accepted refs/install/reload, RETIRE obsolete active dependencies, ROTATE provider change, FINAL composed proof and MIGRATION inventory/operator limits.                          |
| R11         | 100-7 human-reviewed topology and 100-8 exact issue/label/assignment/Backlog/Blocked/relation readback. No live rehearsal substitutes for this planning criterion.                              |
| R12         | DEPLOY selected Rust target through controller dispatch at target head, both-owner installation evidence and complete handoff; unknown target/caller installation/project substitutions denied. |

No future task claims success from this matrix alone. FINAL requires artifact
links and actual results for each row or a specific human-approved scope change.
