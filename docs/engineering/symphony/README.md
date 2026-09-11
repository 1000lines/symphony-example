# Symphony Project Workflow Docs

Current local Symphony project workflow docs live here and in adjacent
engineering and testing sections. Use these docs for active project execution,
handoffs, validation evidence, and finalization.

## Current Runtime Docs

- [Runtime workflow](../../../scripts/symphony/runtime-bundle/workflow/WORKFLOW.md) - authoritative Symphony execution
  contract for issue states, branch handling, PR handoff, and human review.
- [`project-workflow.md`](./project-workflow.md) - project factory workflow,
  state transitions, fallback states, branch handling, and handoffs.
- [`project-colors.md`](./project-colors.md) - project color metadata,
  supported color labels, lane assignment rules.
- [`hosted-runtime-tooling.md`](./hosted-runtime-tooling.md) - hosted runtime
  loader install/refresh/provenance, common-path cutover.
- [`../review/cadence-ai-review.md`](../review/cadence-ai-review.md) -
  Cadence review automation, event handling, stale-review behavior, and
  Symphony handoff state.
- [`fan-out-integration-patterns.md`](./fan-out-integration-patterns.md) -
  reviewable fan-out patterns for temporary scaffolding, adapters, flags, and
  finalizer cleanup.
- [`proof-of-work.md`](./proof-of-work.md) - evidence fields and proof types
  for UI, API, workflow, deploy, and integration work.
- [`project-finalization.md`](./project-finalization.md) - finalizer issue
  responsibilities, TODO scanning, cleanup.

Keep runtime links in this index limited to files present on the selected merge
target branch. If an upstream project doc is still absent there, leave it out
until it lands.

See [Tooling setup](./tooling-setup.md) for dependency commands, retained defaults,
adopter-owned setting locations, and known setup gaps.
