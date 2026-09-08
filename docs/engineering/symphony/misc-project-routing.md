# Misc Project Routing

Unprojected DEMO issues that are otherwise eligible for Symphony work route to
the active misc project instead of drifting outside the project metadata model.

The current active misc lookup source is the single active Linear project whose
metadata contains this project code:

```yaml
project-code: misc
project-color: blue
base-branch: main
```

The route helper is `scripts/symphony/route-misc-project.mjs`. It only routes
`DEMO-*` issues with no current Linear project. DEMO issues already assigned to a
project and non-DEMO issues are reported as no-ops.

## Fail-Closed Rules

The helper stops without mutating Linear when:

- no active project has `project-code: misc`;
- more than one active project has `project-code: misc`;
- the misc project metadata is missing or differs from the expected
  `project-code`, `project-color`, or `base-branch` contract;
- the required Linear color label, currently `blue`, is missing or ambiguous;
- live writes are requested without `LINEAR_API_TOKEN` or `LINEAR_API_KEY`;
- live writes are requested by a Linear viewer other than the email configured
  in `SYMPHONY_EXPECTED_LINEAR_EMAIL`. Set it before starting the helper;
  `linear-bot@example.invalid` is the synthetic fallback, not a live identity.

The helper never creates a misc project or a project-composition branch for
misc work.

## Usage

Dry-run is the default review path:

```sh
node scripts/symphony/route-misc-project.mjs --issue DEMO-123 --dry-run
```

Apply performs the Linear project assignment and adds the missing color label:

```sh
node scripts/symphony/route-misc-project.mjs --issue DEMO-123 --apply
```

Output is JSON and includes the issue, previous project, new project, expected
labels, Linear actor, reason, mutation payload, and Linear API result. Dry-run
output uses `linearApiResult.operation: "dry-run"` and does not mutate Linear.

## Validation

Run the focused validation before changing this helper:

```sh
node --test scripts/symphony/route-misc-project.test.mjs
npx prettier --check scripts/symphony/route-misc-project.mjs scripts/symphony/route-misc-project.test.mjs docs/engineering/symphony/misc-project-routing.md
git diff --check -- scripts/symphony/route-misc-project.mjs scripts/symphony/route-misc-project.test.mjs docs/engineering/symphony/misc-project-routing.md
```
