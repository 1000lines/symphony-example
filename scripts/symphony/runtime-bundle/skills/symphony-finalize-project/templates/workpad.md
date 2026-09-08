## Project Finalization

Project metadata:

- Project code: `<project-code>`
- Project color: `<project-color>`
- Base branch: `<base-branch>`

Target ref:

- Ref: `<branch-or-sha>`
- Starting head: `<sha>`
- Cleanup commits: `<sha-list-or-none>`
- Final head: `<sha>`

Search audit:

```sh
base=<base-branch>
git diff --name-only --diff-filter=ACMRT "$base"...HEAD
# Search changed files with rg or git grep for project markers and cleanup terms.
```

Search terms:

- `<project-code>`, `<code-style-variants>`, `<marker-prefix>`,
  `<finalizer-issue>`
- `TODO`, `FIXME`, `HACK`, `TEMP`, `TEMPORARY`, `XXX`
- `STUB`, `temporary`, `compatibility`, `shim`, `adapter`, `legacy`
- `disabled`, `default-off`, `feature flag`, `gate`, `rollout`

| Finding    | File          | Disposition                                  | Evidence                   |
| ---------- | ------------- | -------------------------------------------- | -------------------------- |
| `<marker>` | `<path:line>` | `<removed/promoted/deferred/false-positive>` | `<commit, doc, or reason>` |

Validation:

| Command     | Result                | Evidence                       |
| ----------- | --------------------- | ------------------------------ |
| `<command>` | `<pass/fail/blocked>` | `<output summary or artifact>` |

Residual human-needed items:

- `<none or exact question and owner>`

Finalization decision:

- `<ready for project completion / rework needed / human input needed>`
