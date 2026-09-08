# {{project-name}}

```yaml
project-code: <project-code>
project-color: <project-color>
base-branch: <base-branch>
human-lead: <human-lead>
```

## Goal

{{project-goal}}

## Out Of Scope

{{out-of-scope-boundaries}}

## Acceptance Criteria

- {{acceptance-criterion}}

Preserve the full delivery scope here and in the goal, including publishing,
review, deployment, cleanup, and finalization when requested. These outcomes
are input to Symphony's planning and human PR review; they do not authorize
extra tickets during project setup.

## Source Documents

- {{source-document-name-or-url}}: {{source-document-status}}

Google Doc URLs, uploaded documents, Linear comments, repo docs, PRs, and other
human-provided sources are acceptable when they can be read. Mark unreadable
required sources as missing instead of replacing them with weaker context.

## Project Metadata

- GitHub PR labels: `{{github-pr-labels}}`
- Linear issue labels: `{{linear-issue-labels}}`
- Human lead Linear identity: `{{human-lead-linear}}`
- Human lead GitHub identity: `{{human-lead-github}}`
- Color helper output: `{{color-helper-output}}`

## Confirmed Project-Specific Seeds

Default setup creates only requirements/design, plan project, and trigger
fan-out seeds. Use this section only for specific additional seeds or existing
ticket moves explicitly requested by the human. Scope confirmation alone does
not authorize additions. Leave it empty when there are no such requests.

- {{requested-seed-title-or-existing-ticket}}: {{requested-scope-or-move}};
  human request: {{explicit-human-request}}

## Missing Field Questions

Preserve every missing value as a question until a human answers it. Do not
invent metadata, labels, source access, identity mappings, or project scope.

- {{missing-field-question}}
