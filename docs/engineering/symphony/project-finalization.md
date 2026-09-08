# Symphony Project Finalization

Project finalization is the cleanup and evidence gate for a Symphony project
that used fan-out work or temporary scaffolding.

## Finalize Label

Use the `finalize` label for the issue that owns project cleanup and final
evidence. When upstream implementation reaches the accepted readiness point for
the project, the project human lead may make a sibling finalize issue
eligible:

- `Backlog` finalize issue -> move to `Todo`.
- `Input Needed` finalize issue, or legacy `Human Input Needed` fallback -> move
  to `Rework`.
- Other finalize states stay unchanged.

The label does not mean the project is finished. It means the issue is
responsible for proving the project target ref is clean enough to finish.
Human review still controls `Human Review` and `Done`; use legacy `In Review`
only as the documented current-team fallback.
If the audit discovers a missed project obligation, documentation mismatch, or
workflow gap that would stop the project from delivering its intended value, the
finalizer owns resolving it or recording the exact human decision needed. A
missing marker is not evidence that the project is complete.

## Required Inputs

Before finalization work starts, collect:

- Linear project metadata: `project-code`, `project-color`, and selected
  `base-branch`.
- The fan-out plan or project issue list.
- The current target ref for final cleanup and the upstream task PRs or commits
  the accepted plan says it contains.
- Project-scoped marker conventions from the fan-out integration guidance.
- Prior search output or cleanup notes from the workpad.

If any required source is unavailable, record the exact source and failure in
the workpad and move the issue to `Input Needed`.

## Search Audit

Use normal Unix search tools on the current target ref. Start with the files
changed between the selected base branch and the checked-out target ref:

```sh
base=<base-branch>
git diff --name-only --diff-filter=ACMRT "$base"...HEAD
```

Then search those changed files, the fan-out plan, and the finalizer ledger
with `rg` or `git grep`. Prefer fixed-string searches and separate simple
queries. Do not block on unrelated TODOs; a finding should tie back to the
project code, marker prefix, finalizer issue, or a changed path that is clearly
inside the project scope.

When upstream PRs have already landed on the selected base, include their
changed files in the audit using the accepted plan's PR list or a recorded
pre-project baseline. Comparing a new cleanup branch to the current base alone
omits that merged work and cannot demonstrate project completion.

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

Every finding needs a disposition in the workpad: removed, promoted to
durable architecture, deferred with a human question, or false positive.

## Cleanup Standard

Finalization removes fan-out residue from the project target:

- Resolve project-scoped TODOs by completing the work or deleting the temporary
  path.
- Delete isolated stub files after imports, registrations, or references point
  at the real implementation.
- Remove temporary adapters and compatibility exports unless the project has
  explicitly accepted them as durable architecture.
- Remove disabled paths and temporary feature gates when the project should
  ship enabled.
- Keep durable rollout flags only when they have an owner and no finalizer
  marker remains.
- Treat missed project tasks found in required sources, workpads, or PR feedback
  as finalizer findings, even when no upstream item left a cleanup marker.

Do not clean up markers that belong to another active project. If a finding
cannot be resolved mechanically, ask the specific question and move to
`Input Needed`.

## Evidence

A finalize workpad must include:

- target ref and starting head SHA;
- cleanup commit SHA or SHAs;
- search terms, commands, changed-file scope, and finding dispositions;
- validation commands and results on the cleaned target ref;
- residual human-needed items, or `none`.

Validation failure keeps the finalize issue out of human review. Use `Rework`
for mechanical fixes. Use `Input Needed` for missing credentials, environment
access, deploy evidence, or product decisions.

## Project Completion

Project completion follows finalization evidence, not just merged task PRs. A
project is ready to complete when the target ref is known, cleanup is
committed, validation passes, and no unresolved finalizer markers remain
without an explicit human decision.
