---
name: symphony-replan
description: Handle human feedback that changes an implementation approach, ticket boundaries, or an accepted Symphony plan; preserve useful work and coordinate revised ownership and follow-up tickets.
---

# Symphony Replan

Use when human feedback challenges the approach or decomposition, including an
ordinary PR comment. Routine implementation defects use normal rework.

Read `$SYMPHONY_TOOLING_ROOT/docs/engineering/symphony/replanning.md` and the
target's accepted plan. That guide defines how to choose between replacing a
ticket's internals, revising part of the plan, or replacing the plan; coordinate
running work; and account for already-merged code. Keep the current issue's
pinned `## Codex Workpad` as the execution record.

Use [the revision template](templates/revision.md) for substantive changes,
omitting fields that do not help this decision. It is a worker record, not a
special syntax the human must submit or a new controller API. A clear human
correction takes precedence over stale generated criteria. Preserve unresolved
feedback across turns and rewrites. Do not treat every design objection as a
reason to discard the PR or cancel the project.
