# Create requirements & design doc

Initial status: `Todo` when the human wants the project started now; otherwise
`Backlog`.

## Scope

Read the project description and confirmed source material, then create the
canonical in-repo requirements and design document for the project under
`docs/symphony-plans/` or another human-confirmed path.

Do not create the fan-out plan, implementation tickets, or project implementation work from this ticket.

## Assumptions

- Project code: `{{project-code}}`
- Project color: `{{project-color}}`
- Base branch: `{{base-branch}}`
- Human lead: `{{human-lead}}`
- Required source documents: `{{required-source-documents}}`

## Success Criteria

- The requirements/design document records project goal, out-of-scope
  boundaries, acceptance criteria, locked decisions, open questions, source
  inputs read, and source inputs unavailable.
- The document preserves missing-field questions instead of inventing values.
- The document is structured so the plan-project ticket can produce a fan-out
  plan with no further product judgment.
- Remaining open items are named with their intended owner or follow-up ticket
  type.

## Labels

- Linear labels: `{{linear-labels}}`
- GitHub PR labels for the requirements/design PR: `{{github-pr-labels}}`

## Dependencies

No default upstream dependency. If a source document is unavailable, stop in
`Human Input Needed` rather than drafting from partial context.

## Workpad Expectations

Keep a single Linear comment headed `## Codex Workpad`. Record the selected base
branch, source-read evidence, unavailable sources, assumptions, unresolved
questions, and validation evidence.

## PR Expectations

If the requirements/design document is committed, branch from `{{base-branch}}`
and open the PR against `{{base-branch}}`. Use branch pattern
`symphony/{{project-code}}/<ticket-id>/<free-text>`. Apply required GitHub PR
labels, including `{{project-color}}` and any project-required labels such as
`symphony`.

## Validation Expectations

- Markdown formatting passes for the committed document.
- The document is mechanically consumable by the plan-project ticket.
- Required source material is either read successfully or recorded as an
  explicit blocker.
