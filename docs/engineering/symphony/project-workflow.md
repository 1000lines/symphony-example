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

The hosted ticket-start hook routes unprojected issues from the configured team to the uniquely
resolved active project with `project-code: misc`, `project-color: blue`, and
`base-branch: main`. It preserves existing project assignments and issues from other teams. Missing or ambiguous misc metadata fails visibly. The
[misc routing guide](./misc-project-routing.md) describes the helper and its
evidence; the helper does not create a project or guess from its display name.

## State Meanings

| State                    | Meaning and owner                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `Backlog`                | Outside the active pool; a human or accepted project action makes work eligible.      |
| `Active`                 | Symphony can implement or rework the issue, subject to its dependency gate.           |
| `Inactive`               | Deploy, AI review, human review, or missing input is pending outside the worker slot. |
| `Unhappy`                | CI is pending; `wake:15m` schedules another evaluation.                               |
| `Evaluating`             | The server wakes one sleeping ticket to check its current PR.                         |
| `Done`                   | Accepted work is complete; human or accepted merge automation owns completion.        |
| `Canceled` / `Duplicate` | Terminal work; event bridges do not reopen it.                                        |

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

Read the team from the target repository's `.symphony.cfg.json`. The CI timer
requires `Active`, `Inactive`, `Unhappy`, `Evaluating`, and the `wake:15m` label.
It does not substitute legacy states for its sleeping and evaluation states.
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
| PR is opened or updated                                       | `Unhappy` with `wake:15m` while CI is pending      | Draft PR URL, head SHA, labels, assignee, and local validation.                       |
| CI is pending                                                 | `Unhappy` with `wake:15m`                          | Pending checks/review and next actor; release the worker slot.                        |
| Known CI or review fix is required                            | `Active`                                           | Failed check or finding, current head, and next action.                               |
| A decision, source, credential, or environment is missing     | `Inactive`                                         | Specific question and exact missing prerequisite.                                     |
| Required checks pass and AI review has no actionable findings | Stay `Inactive` for human review                   | Current-head checks, review verdict, artifact links, and closed feedback ledger.      |
| A fix is pushed                                               | `Unhappy` with `wake:15m` while CI is pending      | New head SHA and refreshed validation; old approval is not current-head evidence.     |
| Human accepts the work                                        | Human or accepted merge automation moves to `Done` | Approval, merge or acceptance evidence.                                               |

Before rework, read submitted GitHub reviews, inline comments and thread status,
top-level PR comments, current checks, and fresh Linear comments. Direct verified
human-writer feedback is actionable without Cadence repeating it. Read `## Cadence Workpad`
for the AI handoff and update only the pinned `## Codex Workpad` with execution
progress and the incoming/addressed/deferred/blocked feedback ledger.

Feedback that changes an approach or decomposition follows
[Replanning From Human Feedback](./replanning.md). A normal comment is enough:
the worker records the interpretation and revises the implementation or plan
at the smallest coherent scope. An unchanged DAG can still need new decision
and acceptance text. Unresolved comments survive workpad updates and rewrites.

## GitHub Event Bridges

The [Cadence event router](../../../.github/workflows/cadence-ai-review-events.yml)
requests `example-cadence-bot` after Symphony pushes and human review activity.
The review-request workflow reviews the current head. The separate
[review handoff bridge](../../../scripts/cadence-linear-rework.mjs) and
[CI wakeup workflow](../../../.github/workflows/symphony-linear-wakeups.yml)
perform these actions:

| Event                                                                                              | Implemented action                                                                                                    |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Actionable Cadence review                                                                          | Wake to `Active`, or the explicit legacy `Rework` fallback.                                                           |
| Nonempty human PR conversation comment or non-approved review body; human changes-requested review | Wake directly. The review bridge requires an open, Symphony-authored PR with the `symphony` label.                    |
| Clean Cadence approval or human-needed finding                                                     | Request eligible human PR assignees; record a no-assignee gap when absent. This bridge leaves Linear state unchanged. |
| Human approval with notes                                                                          | The event router requests Cadence again; the review bridge does not directly wake Linear.                             |
| Failed required external check on the current PR head                                              | Move a waiting ticket to `Active`; ignore optional or stale failures.                                                 |
| Confirmed conflict on an `Inactive` ticket                                                         | Record the fix instruction in the Cadence workpad and move to `Active`.                                               |
| Current PR CI completes                                                                            | `Inactive` on success, `Active` on failure; remove `wake:15m`.                                                        |

Human review/comment routes first verify the current content author and their
effective repository write access through GitHub's permission API. Creation,
submission, and edit events require fresh evidence; sender identity and author
association do not grant permission. Inline comments pass the same check before
requesting Cadence. Denied or unavailable evidence causes no wake or request and
is recorded as untrusted. See the
[permission gate and App rollout requirements](../review/github-actor-classification.md#human-feedback-permission-gate).

The CI wakeup workflow listens to PR updates, CI workflow completions, external
check failures, and failing commit statuses. It finds the ticket using the
configured team key in the PR title or branch and checks the current PR head.
An Active worker gets up to one minute to finish; if it is still Active, the
workflow leaves it alone. Pending CI uses `Unhappy` with `wake:15m`.

The server's existing timer wakes `Unhappy` into `Evaluating` after approximately
15 minutes, allowing for jitter, polling, dependency gates, and capacity. The
profiles limit concurrent evaluations to one. An Evaluating worker checks only
its current ticket's PR and records the result in the Codex workpad: conflict or
failure becomes Active, success becomes Inactive, and pending checks return to
Unhappy with wake:15m. It preserves unrelated labels and rereads the issue and
PR before changing state. Active outcomes can continue into normal rework;
waiting outcomes end the turn. No repository scan or worker sleep is required.
See the profile's **CI Timer Evaluation** section for the complete instructions.

These transitions do not complete or reopen terminal tickets. The runtime owns
the Symphony workpad and timer anchor; agents update the Codex workpad. The
GitHub workflow records conflict instructions in the Cadence workpad and state
results in its run log. Cadence review handoffs remain independent; the final
issue-state reread preserves observed concurrent changes, but Linear offers no
atomic compare-and-swap for these updates.

The hosted profile changes take effect when the accepted runtime bundle is
installed and its configuration reloaded. Committing the files alone does not
change a running server.

## Branching And Finalization

Task branches start from the selected base and PRs target that same base. DAG
edges describe dispatch dependencies, not branch ancestry. Required upstream
code lands on the selected base before dependent validation unless the accepted
plan supplies an explicit temporary seam. Finalization audits the accepted
project target SHA and named cleanup obligations.
