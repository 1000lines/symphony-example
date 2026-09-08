# Symphony Project Workflow

This document expands the state and handoff contract in
[WORKFLOW.md](../../../WORKFLOW.md). Hosted Symphony loads the
[runtime-bundle workflow](../../../scripts/symphony/runtime-bundle/workflow/WORKFLOW.md).
Their prose shares the same contract; configuration and hooks are
environment-specific.

## Required Project Metadata

Every Symphony Linear project needs this metadata before ticket work starts:

```yaml
project-code: short-project-code
project-color: blue
base-branch: main
human-lead: Full Name
```

`project-code`, `project-color`, and `human-lead` are required.
`base-branch` is optional and defaults to `main`. It is the branch point,
PR base, and validation target. Missing metadata requires a workpad question
before implementation.

The hosted ticket-start hook routes unprojected DEMO issues to the uniquely
resolved active project with `project-code: misc`, `project-color: blue`, and
`base-branch: main`. It preserves existing project assignments and non-DEMO
issues. Missing or ambiguous misc metadata fails visibly. The
[misc routing guide](./misc-project-routing.md) describes the helper and its
evidence; the helper does not create a project or guess from its display name.

## State Meanings

| State                    | Meaning and owner                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `Backlog`                | Outside the active pool; a human or accepted project action makes work eligible.          |
| `Active`                 | Symphony can implement or rework the issue, subject to its dependency gate.               |
| `Inactive`               | CI, deploy, AI review, human review, or missing input is pending outside the worker slot. |
| `Happy` / `Unhappy`      | Sleeping daemon verdicts; daemon scheduling owns the next evaluation.                     |
| `Evaluating`             | Configured daemon dispatch state in the current runtime.                                  |
| `Done`                   | Accepted work is complete; human or accepted merge automation owns completion.            |
| `Canceled` / `Duplicate` | Terminal work; event bridges do not reopen it.                                            |

Planning and review are phases of work, not extra required Linear states. The
runtime accepts `Todo`, `In Progress`, and `Rework` as legacy workable names.
`Waiting for CI`, `In Review`, and `Human Input Needed` are legacy external
waits. `Inactive` and those waiting names are outside normal active polling.

Waiting on another ticket uses accepted direct hard blocker relations. Optional
`waiting:ci`, `waiting:ai-review`, and `waiting:human` labels describe
external waits, can coexist, and can become stale. Agents inspect current
checks, reviews, and workpads; bridges do not require those labels to wake an
issue or maintain them as an authoritative state machine.

## Current-Team Fallbacks

The DEMO team provides `Active` and `Inactive`. Use them for new work and waits.
On teams missing a target state, record the exact fallback in `## Codex Workpad`.

| Missing target                                   | Supported compatibility action                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `Active`, before a PR                            | Agents use `Todo` -> `In Progress` when those states exist.                                                          |
| `Active`, post-PR work or a bridge wakeup        | Use `Rework`. The bridge fails if neither `Active` nor `Rework` exists; it never chooses an arbitrary started state. |
| `Inactive`, waiting for CI, deploy, or AI review | Agents use `Waiting for CI` and record the pending event.                                                            |
| `Inactive`, ready for human review               | Agents use `In Review` after required checks and AI review close.                                                    |
| `Inactive`, missing input                        | Agents use `Human Input Needed` with a concrete question.                                                            |

For example: `State setup gap: wanted Active, used Rework for review feedback`.
If no safe fallback exists, leave state unchanged and record the missing state
and required operator action. The shared
[wakeup helper](../../../scripts/linear-issue-wakeup.mjs) reports its actual
fallback and verifies the mutation response.

## Agent Transitions

| Event or condition                                            | State/action                                       | Required evidence                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Implementation or rework starts                               | `Active`                                           | Pinned Codex workpad, source reads, selected base, assumptions, and success criteria. |
| Hard prerequisite is incomplete                               | Keep dependency-gated work in the active pool      | Exact blocker and required upstream result.                                           |
| PR is opened or updated                                       | `Inactive`                                         | Draft PR URL, head SHA, labels, assignee, and local validation.                       |
| Checks or configured AI review are pending                    | Stay `Inactive`                                    | Pending checks/review and next actor; release the worker slot.                        |
| Known CI or review fix is required                            | `Active`                                           | Failed check or finding, current head, and next action.                               |
| A decision, source, credential, or environment is missing     | `Inactive`                                         | Specific question and exact missing prerequisite.                                     |
| Required checks pass and AI review has no actionable findings | Stay `Inactive` for human review                   | Current-head checks, review verdict, artifact links, and closed feedback ledger.      |
| A fix is pushed                                               | `Inactive`                                         | New head SHA and refreshed validation; old approval is not current-head evidence.     |
| Human accepts the work                                        | Human or accepted merge automation moves to `Done` | Approval, merge or acceptance evidence.                                               |

Before rework, read submitted GitHub reviews, inline comments and thread status,
top-level PR comments, current checks, and fresh Linear comments. Direct human
feedback is actionable without Cadence repeating it. Read `## Cadence Workpad`
for the AI handoff and update only the pinned `## Codex Workpad` with execution
progress and the incoming/addressed/deferred/blocked feedback ledger.

## GitHub Event Bridges

The [Cadence event router](../../../.github/workflows/cadence-ai-review-events.yml)
requests `example-cadence-bot` after Symphony pushes and human review activity.
The review-request workflow reviews the current head. The separate
[review handoff bridge](../../../scripts/cadence-linear-rework.mjs) and
[non-review bridge](../../../.github/workflows/scripts/symphony-linear-wakeups.mjs)
perform these actions:

| Event                                                                                              | Implemented action                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actionable Cadence review                                                                          | Wake to `Active`, or the explicit legacy `Rework` fallback.                                                                                                          |
| Nonempty human PR conversation comment or non-approved review body; human changes-requested review | Wake directly. The review bridge requires an open, Symphony-authored PR with the `symphony` label.                                                                   |
| Clean Cadence approval or human-needed finding                                                     | Request eligible human PR assignees; record a no-assignee gap when absent. This bridge leaves Linear state unchanged.                                                |
| Human approval with notes                                                                          | The event router requests Cadence again; the review bridge does not directly wake Linear.                                                                            |
| Failed required check on the current PR head                                                       | Wake with check name, result, head SHA, and run/check URL. Nonrequired, stale, and successful ordinary checks do not wake.                                           |
| Confirmed current PR merge conflict                                                                | Wake only for `mergeable: false` and `mergeable_state: dirty`. PR events and the sweep at minutes 17 and 47 handle base changes and previously unknown mergeability. |
| Issue-scoped `workflow_dispatch` completion                                                        | Wake on success or failure with run id/attempt, conclusion, workflow head SHA, and URL. Completion requests follow-up; it does not prove acceptance.                 |

The non-review workflow listens to failed Actions `workflow_run` completions,
external `check_run` completions, commit statuses, selected PR events, and its
conflict sweep. Its job gate excludes unrelated runs before allocating a runner.
It excludes its own workflow and `workflow_run`-triggered runs to avoid recursion.

Dispatched completions qualify on `symphony/` branches. Resolution uses the
anchored `[linear:<issue>] ` run-name marker first, then the PR title prefix
or a unique branch identifier. An adopter-owned workflow can carry its
`ticket_number` input in that marker; `workflow_run` does not include dispatch
inputs. Keep the marker, PR/branch identifiers and configured team recognizers
consistent. The [tooling setup guide](./tooling-setup.md#pr-labels-and-non-review-wakeups)
documents event permissions, credential-owner setup and retained runtime gaps.

Missing or ambiguous identity, missing project metadata/labels, mismatched
repository/project, or missing SHA/evidence prevents a non-review mutation.
PR-backed events are checked against the current PR head again before mutation.

Both state bridges preserve terminal names (`Done`, `Canceled`, `Cancelled`,
`Duplicate`) and terminal Linear categories. They re-read state before waking;
Linear does not provide an atomic compare-and-swap here. They record confirmed
mutations, fallbacks, skips, and errors in `## Cadence Workpad` and the workflow
summary. Non-review deduplication is bounded to ten recent records; independent
Cadence writers are not serialized with the bridge. See the
[workpad contract](../review/cadence-linear-workpad.md) for persistence limits and
the [review guide](../review/cadence-ai-review.md) for trigger coalescing.

## Branching And Finalization

Task branches start from the selected base and PRs target that same base. DAG
edges describe dispatch dependencies, not branch ancestry. Required upstream
code lands on the selected base before dependent validation unless the accepted
plan supplies an explicit temporary seam. Finalization audits the accepted
project target SHA and named cleanup obligations.
