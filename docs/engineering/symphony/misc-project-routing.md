# Misc Project Routing

When invoked, the optional routing helper assigns unprojected issues from the
configured Linear team to the active misc project. The bundled workflow hooks
are no-ops; an operator must explicitly enable ticket-start routing.

The current active misc lookup source is the single active Linear project whose
metadata contains this project code:

```yaml
project-code: misc
project-color: blue
base-branch: main
```

The route helper is `scripts/symphony/route-misc-project.mjs`. It reads
`linear.teamKey` from the Git checkout's top-level `.symphony.cfg.json` (`100`
in this repository). It routes issues from that team with no current Linear
project. Issues already assigned to a project and issues from other teams are
reported as no-ops. Exported functions accept a `lookup.teamKey` override along
with the project lookup settings.

## Fail-Closed Rules

The helper stops without mutating Linear when:

- the checkout or its valid top-level `.symphony.cfg.json` is unavailable;
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

Run from a configured Git checkout, including for `--help`: the module reads
the team configuration during import. Dry-run is the default review path. In
these examples, replace `100-123` with an issue from your configured team:

```sh
node scripts/symphony/route-misc-project.mjs --issue 100-123 --dry-run
```

Apply performs the Linear project assignment and adds the missing color label:

```sh
node scripts/symphony/route-misc-project.mjs --issue 100-123 --apply
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
