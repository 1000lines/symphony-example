# Tooling setup

The Node workspace contains Symphony's DAG parser, host CLI, lifecycle helpers,
and review support. Its TypeScript configuration and npm commands describe those
tools. Choose your product's language, directory layout, setup, and validation
commands in your own repository configuration.

## Dependency and CI commands

From the repository root, use Node `20.20.0` from `.nvmrc` and npm `11.13.0`
from `package.json`. The root and two tooling workspace manifests declare the
dependencies; a derived `package-lock.json` is not included. The `.npmrc` enforces
engine compatibility and a minimum release age. Package-manager preparation is
separate from the tooling commands:

```sh
npm install --global npm@11.13.0
npm install
npm run build
npm test
npm run lint
```

`npm install` resolves the declared ranges and generates a local lockfile under
the retained `.npmrc` defaults. Dependency resolution can change between installs.
An adopter can maintain that generated lock in their own repository and use
`npm ci` once it exists.

`build` compiles `tools/symphony-dag` and `tools/symphony-host`, then checks the
TypeScript helpers in `scripts/` without emitting them. `test` selects the two
Jest suites, guardrail and project-color TypeScript cases, and the Node test
files in `scripts/`, `scripts/symphony/`, and
`.github/workflows/scripts/`. `lint` checks JavaScript and TypeScript in the
tooling, scripts, workflow helpers, and the Linear GraphQL helper. ESLint stops
configuration lookup at this root. Formatting remains available through the
workspace's existing `symphony-dag:lint` command and `.prettierrc`.

Host installer and infrastructure helper tests have a separate command,
`npm run symphony-host:test`; runtime bundle cases are selected with
`node --test scripts/symphony/runtime-bundle/*.test.mjs scripts/symphony/runtime-bundle/review-axes/*.test.mjs`.
Both globs are needed to include the nested standing-docs cases. CI also runs
the workflow contract and host-rendering suites explicitly; the local invocation
and source-selection smoke tests run through `npm test`. Other host suites require the host
tools described in [host operations](../../operations/symphony-host.md).
The label-repair host test and several review/wakeup tests import `js-yaml`,
which is not declared directly in the tooling manifests. A transitive install
may supply it, but that is not a stable dependency contract. Root TypeScript
checking includes `scripts/**/*.ts`, not the new `.mjs` helpers. Dependency and
compiler coverage corrections remain later setup work; no product compiler
configuration is required by this snapshot.
An adopter's reusable workflow caller can add those suites and product checks
as separate jobs. These commands specify validation scope, not a guarantee that
all retained tests and lint rules already pass in a new environment.

The three reusable `symphony-build.yml`, `symphony-test.yml`, and
`symphony-lint.yml` workflow contracts use `workflow_call`. Create triggers and
additional product jobs in an adopter-owned caller. A reusable workflow does
not automatically run on push.

## Repository workflow and guardrails

Use the [authoritative workflow](../../../scripts/symphony/runtime-bundle/workflow/WORKFLOW.md)
for both hosted installation and local invocation. Its YAML defines tracker
team/state mappings, workspace, hooks, concurrency, model command and server
settings. The installed repository skill selects the task repository, its
configured base (otherwise its GitHub default branch) and setup commands.
Bundled hooks are no-ops; no repository clone or package manager is hard-coded.

For local execution, first supply a compatible external Symphony runtime and
prepare bot credentials and a personal Codex home containing the runtime bundle's
instructions and skills. The credential recipe below does not install that
bundle. See [hosted runtime tooling](./hosted-runtime-tooling.md) for installation
requirements; keep personal runtime files outside the target checkout. Configure
the tracker team, workspace and server in an operator-owned override if the
shipped settings do not match your environment.

From this tooling repository's root, with `SYMPHONY_RUNTIME_BIN` set to your
runtime executable, use this command. `SYMPHONY_WORKFLOW_SOURCE` is optional and
selects an operator-owned file; it does not merge with the bundled workflow.

<!-- local-workflow-invocation -->

```sh
export SYMPHONY_TOOLING_ROOT="${SYMPHONY_TOOLING_ROOT:-$PWD}"
"${SYMPHONY_RUNTIME_BIN:?Set SYMPHONY_RUNTIME_BIN to the Symphony executable}" \
  --i-understand-that-this-will-be-running-without-the-usual-guardrails \
  "${SYMPHONY_WORKFLOW_SOURCE:-$SYMPHONY_TOOLING_ROOT/scripts/symphony/runtime-bundle/workflow/WORKFLOW.md}"
```

Use an absolute tooling root when invoking from elsewhere. Replace old commands
that pass the deleted root `WORKFLOW.md` or rely on implicit path discovery.
Existing root-derived overrides need the [workflow migration](../../../scripts/symphony/runtime-bundle/README.md#workflow-source-migration).
The local smoke test uses a stub executable to verify argument/path selection;
it does not establish compatibility or live worker behavior for your runtime.

The optional `npm run agent:guardrails` command retains a narrow agent-edit
sandbox in `scripts/agent-guardrails.ts:allowedScopeRules`. It is not the root CI
lint command. `--base <git-ref>` or `AGENT_GUARDRAIL_BASE` selects the diff base
(default `origin/main`); repeat `--file <relative-path>` to select explicit paths.
The command checks scope and invokes `npm run lint:agent`, which checks tooling
with a maximum complexity of 10 and no baseline. For another scope or lint
policy, use an adopter-owned script and ESLint config instead of this optional
sandbox entry point. Extend `.eslintrc.agent.js` from that config and set
`agent-complexity` options `{ max: 12, baselineFile: "config/complexity.json" }`
as needed. A baseline is an array of `{ file, line, column }` entries with
repository-relative file names and source locations. No baseline is required.

## DAG and lifecycle defaults

Project metadata owns project code, color, human lead and base branch.
Use [the schema](../../symphony-plans/fan-out-plan-schema.md)
and the synthetic fixture in
`tools/symphony-dag/src/__fixtures__/minimal-project-plan.md`; historical project
plans are not dependencies. Factory templates create new adopter-owned plan and
standup documents. The project factory is for human sessions and is excluded
from default unattended skill installation.

Task branches and PRs use the project's `base-branch` (optional branch-name
string, default `main`); the DAG manifest expresses it as `project.base_branch`
with matching task branch/PR declarations. The parser rejects
`project.integration_branch`, `defaults.frontier_blocked_label` and the old
`defaults.integration_branch_policy`. No merge-build contract remains. The
former integration queue, workflow and dependency-link scripts are absent. Their environment
inputs have no consumer; do not provision them or a `PR Checks` caller for that
removed automation. DAG validation remains `npm run symphony-dag:check`.

The shared `scripts/linear-issue-wakeup.mjs`, used by review handoff and non-review
wakeups, selects the Linear team's `Active` state first, then legacy `Rework`
only if `Active` is absent (names are compared case-insensitively). Create one
of those states in Linear before enabling either route. It preserves terminal
issues, leaves an issue already in the target state unchanged, and fails if
neither safe state exists. The GitHub PR label remains `symphony`. Runtime
profile state lists do not remap these helpers. A wakeup makes work eligible;
the worker must still honor hard dependencies and pending review/CI evidence.

Misc routing retains the example team restriction, `misc` project code, `blue`
color, `main` base, and project states `planned`, `started`, `in progress` in
`scripts/symphony/route-misc-project.mjs`. The exported functions accept a
`lookup` object for project settings, but that does not replace the fixed team
eligibility predicate. Do not enable this optional ticket-start hook for a
different team until its adopter-owned routing policy has been supplied.
The color allocator accepts `activeStates` as a function option and retains
the palette listed in `scripts/symphony/project-colors.ts`.

## PR labels and non-review wakeups

PR label repair is an optional hosted safety net. Its existing process inputs
are documented in the [bundle guide](../../../scripts/symphony/runtime-bundle/README.md#pr-label-repair).
Set `project-color: teal`, for example, in the owning Linear project's content
or description and create that GitHub label plus `symphony`. The color is a
single lowercase label name; conflicting declarations fail. Issue text,
branch color and CLI guesses are not color authorities. The helper takes an
explicit repository and issue, requires Linear read and GitHub label-write
access, and adds missing labels only after verifying a unique open PR.

The optional `.github/workflows/symphony-linear-wakeups.yml` consumes failed
required checks, confirmed merge conflicts and completed `workflow_dispatch`
runs on `symphony/` branches in the same repository. It does not dispatch work.
It reads trusted bridge code from the default branch; `workflow_run` must be
available there. The wildcard completion subscription is narrowed by the job
gate, including recursion suppression. Non-Actions check runs and commit
statuses have separate failure gates; PR events require the `symphony` label.
The conflict sweep runs at minutes 17 and 47 each hour on `ubuntu-latest`.
GitHub must support the retained `concurrency.queue: max` syntax; runner,
schedule and event availability remain adopter setup assumptions.

Setting location: the workflow maps the automatic GitHub token to `GH_TOKEN`
and Actions secret `CADENCE_LINEAR_API_TOKEN` to `LINEAR_API_TOKEN`. The former
needs Actions/checks/contents/PR/status read permissions; the latter is a secret
Linear API-token string with issue and workpad read/write access. No supplied
GitHub secret is needed by this workflow. A standalone caller must supply
`GH_TOKEN`, `LINEAR_API_TOKEN` (or fallback `LINEAR_API_KEY`) and GitHub event
context: `GITHUB_REPOSITORY` (`owner/repository`), `GITHUB_EVENT_NAME`,
`GITHUB_EVENT_PATH` (path to webhook JSON), `GITHUB_ACTOR` and `GITHUB_RUN_ID`.
`GITHUB_SERVER_URL` is optional, default `https://github.com`, for evidence URLs;
it does not change the helper's GitHub API endpoint. `GITHUB_STEP_SUMMARY` is an
optional output-file path, unset by default outside Actions.

The bridge's `applyPlan` function in
`.github/workflows/scripts/symphony-linear-wakeups.mjs` checks an exact synthetic
Linear viewer display name before writing. Its replacement location and token
owner are described in the setup reference. `LINEAR_WAKEUP_BOT_NAME` is a
documentation name, not a read environment variable. Keep the matching
credential-owner documentation in `docs/engineering/review/cadence-linear-workpad.md`
aligned during later setup; do not disable the guard. No new override is provided.

The issue recognizers in that bridge and `scripts/cadence-linear-workpad.mjs`
must agree with the adopter's team prefix. Workflow completion ownership uses
an anchored run-name marker such as `[linear:DEMO-123] Validate tooling` first,
then PR title or branch identity. Dispatch inputs are not delivered with
`workflow_run`; an adopter-owned caller must put its `ticket_number` in that
marker when explicit ownership is needed. This example uses the synthetic team
prefix; align recognizers and real event metadata during setup, keeping test
fixtures synthetic. Retain unambiguous identity and current-head evidence. Required-check
status comes from GitHub's PR check data, not a hardcoded workflow name.
The bridge records/deduplicates evidence in the existing Cadence workpad and
preserves review coordination. It neither completes a Linear issue nor
overrides terminal-state protection. Ordinary tooling CI requires none of this
optional event or credential setup.

## Review and local environment

The Cadence workflows require GitHub, Linear, Google Docs, and Claude Code
access. Set the six credential names documented in the generated reference in
GitHub Settings → Secrets and variables → Actions → Secrets. Workflow identity
and model variables belong in the Variables tab. The review runner requires
`CADENCE_CLAUDE_MODEL` with no default. Its retained preflight in
`.github/workflows/scripts/verify-cadence-ai-review.cjs` accepts only
`claude-opus-5` through `APPROVED_CADENCE_CLAUDE_MODELS` and rejects a workflow
fallback. This allowlist has no adopter-owned override; using a different model
requires an adopter-owned review workflow and validation policy during later
setup. Existing timeout defaults remain; see
[Cadence automation](../review/cadence-ai-review.md) for its event contract.
The optional actor-team lookup defaults to `humans` and `ai`; exported
`fetchGitHubActorTeams` options `org`, `humansTeamSlug`, and `aiTeamSlug` can be
passed by an adopter-owned caller. The credential must be able to read those
teams. The pure classifier can instead receive explicit actor lists and
membership results.

`scripts/symphony/setup-local-env.sh` is an optional AWS Secrets Manager setup
recipe, not a generic credential loader. Its `symphony_setup_main` assigns
`AWS_PROFILE`, region, secret IDs, and `/tmp/symphony`; caller environment
values for those settings are overwritten. Supply an adopter-owned environment
loader if those locations differ. It must provide the GitHub/Linear tokens,
Google service-account JSON path, model credentials, Git identity, and askpass
executable required by your workflow. Identity defaults in
`symphony_set_identity_defaults` are documented separately; the expected GitHub
actor is deliberately derived from the configured bot account.

The host CLI supports `--region`, `--profile`, `--name`, `--instance-id`,
`--alb-arn`, `--target-group-arn`, and `--volume-id`; defaults are `us-west-2`
and target name `symphony`. Its service commands retain Linux/systemd, SSM,
`/opt/symphony`, and port 4000 assumptions. The AMI workflow retains its schedule,
AL2023 x86-64 parameter, region, Terraform path and `main` base. Inspect these
locations in `.github/workflows/update-symphony-host-ami.yml` and the host
operations guide before opting into that automation. Different service layout,
machine architecture, or infrastructure wiring requires later adopter setup.

Keep environment-specific profiles, credentials, routing policies and product
validation in adopter-owned files or service settings. The optional automation
recipes need that setup before they can be used; the dependency closure alone
does not establish an operational installation.
