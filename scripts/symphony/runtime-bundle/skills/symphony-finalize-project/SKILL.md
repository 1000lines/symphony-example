---
name: symphony-finalize-project
description: Finalize a Symphony project by auditing and resolving project-scoped TODOs, stubs, adapters, disabled paths, and required deploy evidence.
---

# Symphony Finalize Project

Use this skill for Linear issues with the `finalize` label, project-finalizer
titles, or explicit requests to finish a Symphony project. The skill is for
project finalization mechanics, not for generic fan-out pattern design.

## Read First

- Linear issue identifier, title, current state, labels, project metadata, and
  the existing `## Codex Workpad`.
- `WORKFLOW.md`.
- Project metadata: `project-code`, `project-color`, and selected
  `base-branch`.
- Fan-out plan or project ticket list for the project being finalized.
- Fan-out integration pattern guidance, especially marker text for finalizer
  TODOs, isolated stubs, temporary adapters, and disabled paths.
- Current target ref, included upstream task PRs or commits, and diff against
  the selected base branch.
- Sibling project issues and PRs, especially proof of
  work, and any issue with project completion evidence.
- Previous search output or cleanup commits, if this is a rework pass.

If a required source cannot be read, record `Unavailable source` in the
workpad, ask for access or pasted context, move the issue to
`Input Needed`, and stop.

## When Finalization Starts

Start a finalize issue only after upstream implementation work reaches the
accepted readiness point for the project, such as merged task PRs, an accepted
target ref, or a human-approved descoping decision. The project human lead may move it
from `Backlog` to `Todo` when that readiness point is reached, or from
`Input Needed` to `Rework` when missing evidence becomes available. Leave
human-controlled `Human Review` and `Done` states alone unless the current
workflow explicitly instructs otherwise. Use legacy team state names only
through the active workflow's documented fallbacks.

Finalization is complete only when the project target ref is clean of temporary
project scaffolding, validation passes, and any residual human-needed items are
explicit. During that audit, missed project obligations are finalizer findings even when no explicit
marker was left. Resolve the smallest in-scope cleanup or spec mismatch, or
record the concrete human decision needed before project completion.

## Search Audit

Use Unix search over the current target ref. Start from the files changed
between the selected base branch and the checked-out target ref:

```sh
base=<base-branch>
git diff --name-only --diff-filter=ACMRT "$base"...HEAD
```

Search those changed files, the fan-out plan, and the finalizer ledger with
plain `rg` or `git grep`. Prefer fixed-string searches and run separate simple
queries instead of generating a broad regex. Treat every hit as something to
verify, not as proof that cleanup is incomplete.

When upstream PRs have already landed on the selected base, include their
changed files using the accepted plan's PR list or a recorded pre-project
baseline. The cleanup branch's diff against the current base alone omits that
merged work and cannot demonstrate project completion.

Search for:

- the project code, obvious code-style variants used in the diff, marker
  prefix, and finalizer issue identifier;
- project-scoped TODO, FIXME, HACK, TEMP, TEMPORARY, and XXX markers;
- isolated stub marker text such as `STUB(<project-code>): ...` or
  `TODO remove this file during Symphony finalization`;
- temporary, compatibility, shim, adapter, stub, and legacy names;
- disabled, default-off, feature-flag, gate, and rollout-path names;
- generic TODOs in changed paths whose directory segment names match the
  project code or marker prefix.

## Cleanup Rules

- Resolve every project-scoped TODO by completing the cleanup or deleting the
  temporary code.
- Delete isolated stub files, or replace imports and registrations with the
  real owner before deleting the marker.
- Remove temporary adapter layers, compatibility exports, and shims unless the
  project explicitly promotes them to durable architecture.
- Remove temporary disabled paths and feature flags when the project should ship
  enabled. If a flag is durable rollout control, remove project-scoped
  finalizer markers and document the durable owner.
- Treat missed project tasks found in required sources, workpads, or PR feedback
  as finalizer findings; lack of a marker is not a pass when the miss blocks the
  project from delivering its intended value.
- Do not clean up TODOs from unrelated active projects.

If an unresolved TODO, temporary file, adapter, or disabled path cannot be
resolved without a human decision, record the exact file and question in the
workpad and move to `Input Needed`.

## Validation And Evidence

Record these items before claiming finalization:

- Target ref and head SHA before cleanup.
- Cleanup commit or commits.
- Search terms, commands, changed-file scope, and disposition for each finding.
- Validation commands and results on the cleaned target ref.
- Residual human-needed items, or `none`.

If composed validation fails and the fix is mechanical, move to `Rework` and
fix it. If it fails because credentials, deploy access, source data, or product
judgment is missing, ask the smallest specific question and move to
`Input Needed`.

## Workpad Template

Use `templates/workpad.md` for finalization evidence. Keep one
`## Codex Workpad` comment per issue and update the existing comment instead of
creating a second workpad.
