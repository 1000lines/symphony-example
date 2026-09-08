# Symphony Project Colors

Symphony project colors are short labels used to distinguish active Symphony
project lanes in GitHub and Linear. The supported colors are:

1. `pink`
2. `cyan`
3. `blue`
4. `green`
5. `orange`
6. `red`
7. `yellow`
8. `purple`
9. `teal`

Each color has a canonical hex in `SYMPHONY_PROJECT_COLOR_HEX`
(`scripts/symphony/project-colors.ts`), matching the Linear color-lane label
colors, so a project's icon can be set to its lane color.

This order is the canonical supported-color list, not a selection guarantee.
Callers must treat any supported color that is not occupied by an active Linear
project as a valid result.

## Project Color Rules

Each active Linear project uses one specific color. Each color is used by at
most one active project. If a single project color cannot cover the project
safely, the factory workflow should abort and ask the human lead to split or
rescope the project rather than assigning multiple colors.

The helper treats Linear projects in API states `planned` and `started` as
active for color occupancy, and also accepts the human-facing state name
`In Progress`. Backlog, Completed, and Canceled projects are inactive by
default. Inactive projects do not block color selection, but they are included
in the audit output so a human can see recently used or dormant project colors.

Every active project that participates in Symphony color selection must provide
at least:

```yaml
project-code: short-project-code
project-color: pink
human-lead: Full Name
```

The parser also extracts these optional fields when present:

```yaml
base-branch: main
```

`base-branch` defaults to `main` when absent.

Symphony PRs carry the general `symphony` label plus the project color label.
For sample-factory, the project color is `blue`, so its PRs carry both `blue` and
`symphony`.

The helper reports conflicts for:

- missing required metadata on active projects;
- unknown project colors;
- more than one active project using the same supported color;
- no available color because active projects occupy every supported color.

Before assigning a color to a newly woken project, also inspect open GitHub PRs
with project color labels for likely orphaned work. The pure helper reports
active Linear project conflicts; open PRs can show stale color use that no
longer has an active Linear project.

## Local Helper

The pure helper lives in `scripts/symphony/project-colors.ts`. It has no live
Linear or GitHub dependency; pass it a fixture of Linear project objects.

Example fixture:

```json
{
  "projects": [
    {
      "name": "Sample project",
      "state": "started",
      "url": "https://linear.app/example-workspace/project/sample-project-000000000000",
      "content": "project-code: sample-factory\nproject-color: blue\nhuman-lead: Example Lead"
    }
  ]
}
```

Run the helper locally:

```sh
npx ts-node scripts/symphony/project-colors.ts --fixture /path/to/projects.json
```

Or import the pure function from TypeScript:

```ts
import { selectAvailableProjectColor } from "../../scripts/symphony/project-colors";

const selection = selectAvailableProjectColor(projects);
if (!selection.available) {
  throw new Error(selection.reason);
}

console.info(selection.color);
```

## Live Linear Collection

Live collection is separate from the pure helper. Use Symphony's injected
`linear_graphql` tool to collect current Linear project metadata, then pass the
returned `projects.nodes` array to the helper or write it as a local fixture.

```graphql
query SymphonyProjectColorInputs {
  projects(first: 100, filter: { state: { nin: ["completed", "canceled"] } }) {
    nodes {
      name
      state
      url
      content
      description
    }
  }
}
```

This deliberately excludes Done/Completed and Canceled projects to reduce the
chance that the first 100 results are filled with inactive history. If the
query still returns exactly 100 projects, page or narrow the collection before
assigning a color.

The helper is intentionally not a lock or reservation service. If two dormant
projects wake at the same time, both may see the same available color. That race
is outside this helper and should be solved later only if it becomes a real
workflow problem.
