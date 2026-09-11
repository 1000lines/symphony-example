# Tooling setup

The Node workspace contains Symphony's DAG parser, host CLI, lifecycle helpers,
and review support. Its TypeScript configuration and npm commands describe those
tools. Choose your product's language, directory layout, setup, and validation
commands in your own repository configuration.

## Dependency and CI commands

From the repository root, use Node `20.20.0` from `.nvmrc` and npm `11.13.0`
from `package.json`. The root and two tooling workspace manifests declare the
dependencies; the committed `package-lock.json` locks both workspaces. The `.npmrc` enforces
engine compatibility and a minimum release age. Package-manager preparation is
separate from the tooling commands:

```sh
npm install --global npm@11.13.0
npm ci
npm run build
npm test
npm run lint
```

Use `npm ci` for the committed dependency tree. Regenerate and review the lock
only when intentionally changing dependencies. The controller's `ci.yml` runs
build, lint, tests and changed Markdown with locked Prettier, then `CI Required`.
Verify the aggregate and its child jobs at the exact PR head; the expected
Actions App is `15368`. Reusable workflows alone are not CI evidence.

Read each target's README, applicable AGENTS/CLAUDE instructions, toolchain
files and `.github` workflows. Select `ci.mode` from its selected-base config:
`native` (also the default when omitted), `docker`, or `remote`. Native runs
installed tools and uses Docker for environment gaps; passing local checks
record `Docker: skipped — passed locally`. Docker runs the existing command
arrays to build the client's Dockerfile and execute its checks. Record the image
digest, mount only the issue workspace, preserve UID/GID and remove task containers.
Remote runs available checks, records missing tools/unrun checks as limitations,
then publishes the prepared head for GitHub CI. It does not require installation
or Docker before publication. Known failed assertions must be fixed in every
mode. All modes require current-head GitHub CI, including documentation changes;
see the [proof standard](./proof-of-work.md#validation-order).

The [config reference](../../../scripts/symphony/runtime-bundle/skills/symphony-repository/references/config.md#validation-modes-and-portable-commands)
shows executable/argument arrays and correct `bash -lc` serialization. Keep
`linear.teamKey` as the only Linear setting: each issue supplies its project,
so one config supports multiple projects without regeneration.

For example, a remote worker can check an unavailable optional local compiler,
run available Git validation, and record the publication handoff. Replace the
fixture tool with the target's real tool. A present tool's failure stops this
sequence; do not reinterpret a failed assertion as a missing environment.

<!-- remote-validation-example -->

```bash
set -e
if command -v client-example-compiler >/dev/null 2>&1; then
  client-example-compiler --check
else
  printf '%s\n' 'Limitation: client-example-compiler unavailable; compiler check not run.'
fi
git diff --check
printf '%s\n' 'Publication handoff: push the prepared head; require GitHub CI.'
```

This example does not itself push or claim a CI pass. Missing source access or
credentials still gates the dependent action. After publishing, missing/pending
CI means Unhappy + wake:15m; failed CI means Active; all required CI passing
means Inactive for review. The advisory Cadence review stays separate.

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
The root tooling manifest declares `js-yaml` directly for the host-rendering,
label-repair and review/wakeup tests. Root TypeScript checking includes
`scripts/**/*.ts`, not the `.mjs` helpers; no product compiler configuration is
required by this snapshot.
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

Use an absolute tooling root when invoking from elsewhere. Always pass the
workflow path explicitly. See [workflow migration](../../../scripts/symphony/runtime-bundle/README.md#workflow-source-migration)
when updating an existing installation or operator-owned override.
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
string, default the target repository's GitHub default branch); the DAG manifest
expresses the selected branch as `project.base_branch`
with matching task branch/PR declarations. The parser rejects
`project.integration_branch`, `defaults.frontier_blocked_label` and the old
`defaults.integration_branch_policy`. No merge-build contract remains. The
former integration queue, workflow and dependency-link scripts are absent. Their environment
inputs have no consumer; do not provision them or a `PR Checks` caller for that
removed automation. DAG validation remains `npm run symphony-dag:check`.

The shared `scripts/linear-issue-wakeup.mjs` wake helper, used by review handoff
and the retained standalone non-review bridge, selects `Active`, then legacy `Rework`
only if `Active` is absent (names are compared case-insensitively). Create one
of those states in Linear before enabling either route. It preserves terminal
issues, leaves an issue already in the target state unchanged, and fails if
neither safe state exists. The GitHub PR label remains `symphony`. Runtime
profile state lists do not remap these helpers. A wakeup makes work eligible;
the worker must still honor hard dependencies and pending review/CI evidence.

The CI wakeup YAML uses exact `Active`, `Inactive` and `Unhappy` state names,
and the server dispatches `Evaluating`. Provision those states and `wake:15m`
in the team identified by the checkout's top-level `.symphony.cfg.json`
`linear.teamKey`. The workflow requires that label on every transition,
including success/failure transitions that remove it. It does not use the
legacy `Rework` fallback.

Misc routing reads that same `linear.teamKey` (`100` here) and retains the
`misc` project code, `blue` color, `main` base, and project states `planned`,
`started`, `in progress` in `scripts/symphony/route-misc-project.mjs`. Exported
functions accept a `lookup` object with `teamKey` and project settings. Run
from a configured Git checkout; the default team is read during import, even
for `--help`. The [routing guide](./misc-project-routing.md) describes the
optional ticket-start hook; bundled hooks do not invoke it.
The color allocator accepts `activeStates` as a function option and retains
the palette listed in `scripts/symphony/project-colors.ts`.

## PR labels and non-review wakeups

Explicit PR label verification is required; an operator hook is an optional
hosted safety net. Its existing process inputs
are documented in the [bundle guide](../../../scripts/symphony/runtime-bundle/README.md#pr-label-repair).
Set `project-color: teal`, for example, in the owning Linear project's content
or description and create that GitHub label plus `symphony`. The color is a
single lowercase label name; conflicting declarations fail. Issue text,
branch color and CLI guesses are not color authorities. The helper takes an
explicit repository and issue, requires Linear read and GitHub label-write
access, and adds missing labels only after verifying a unique open PR.

The optional `.github/workflows/symphony-linear-wakeups.yml` handles same-repository
PR events, completed `CI` runs triggered by `pull_request`, and failed external
required checks/statuses. It selects one open PR with the `symphony` label at
the event's current head and resolves the configured team's issue from the PR
title prefix, then the branch. It reads trusted helpers from the default branch.
Its `workflow_run` subscription accepts completions, then checks the target's
configured workflow paths. It reads `.symphony.cfg.json` from the target's actual
default branch via the API, separately from trusted workflow helpers. CI uses
observed check name/workflow/App provenance and current-head run results; it does
not assume `CI`, `ci.yml`, Node application packages or a `main` default branch.
Incomplete, missing, pending and skipped checks cannot establish success. A
pending rerun supersedes an earlier result. Additional observed required checks
remain enforced; the advisory Cadence check is excluded. Workers must still
collect complete acceptance evidence, including required children and tested refs.

An Active worker gets up to one minute to finish; if still Active, it is left
alone. For waiting tickets, pending CI means `Unhappy` with `wake:15m`, successful
CI means `Inactive`, and failed CI or a current required external-check failure
means `Active`. The event workflow records conflict instructions and activates
a ticket only when GitHub reports a confirmed conflict while it is `Inactive`.
It does not retry unknown mergeability or sweep conflicts introduced by base
changes. The server's per-ticket timer supplies another check for `Unhappy`
tickets through the authoritative workflow's `Evaluating` instructions.

The job runs on `ubuntu-24.04` with a five-minute timeout and
`concurrency.queue: max`. Configure compatible GitHub event/queue support and
install/reload the server workflow before relying on timer recovery. Source
configuration alone does not prove a running server loaded it.

Setting location: the workflow maps the automatic GitHub token to `GH_TOKEN`
and Actions secret `CADENCE_LINEAR_API_TOKEN` to `LINEAR_API_TOKEN`. The former
needs Actions/checks/contents/PR/status read permissions; the latter is a secret
Linear API-token string with issue and workpad read/write access. No supplied
GitHub secret is needed by this workflow. The YAML records conflict instructions
in the Cadence workpad and state changes in its run log. It rereads the issue
and PR before mutation, preserves unrelated labels, and only updates tickets
still in the observed `Inactive` or `Unhappy` state.

The same workflow exposes `workflow_call` for thin target-owned event callers.
Pass `target-repository`, `target-default-branch`, `event-name` and
`event-payload: ${{ toJSON(github.event) }}`. The target repository must equal the
caller. Pass `helpers-repository` and `helpers-ref` as reviewed workflow-source
values, never from PR text or the target head. Helpers are checked out separately
under `_symphony`; record the actual checkout commit, including when using the
accepted moving publication branch. Only `CADENCE_LINEAR_API_TOKEN` is declared;
pass it explicitly. No reviewer App/provider key or `secrets: inherit` belongs
on this boundary. Native triggers remain usable until the adoption owner retires
duplicate callers after live proof. Source tests do not prove host reload or a
live GitHub-to-Linear transition; CT-A owns that integrated proof.

For clients without application CI, `symphony-client-commands.yml` exposes a
secret-free `workflow_call`. Supply `tested-ref` as the exact PR head SHA,
`working-directory` from config, and `commands` as a JSON array of argument
arrays in setup/build/test/lint order. For example, serialize the chosen config
commands with `JSON.stringify(['setup', 'build', 'test', 'lint'].flatMap(key =>
config.commands[key] || []))`. Commands run unchanged, including Docker commands;
CI never waives missing tools or failures based on the server's validation mode.
The runner uses Ubuntu's tools and the maintained GitHub script Action; it does
not install a Node application package or require reviewer credentials. Keep
existing application CI where it already covers the target. Discover the actual
caller check name/workflow/App before registering required checks. The runner's
native PR event is a source-package smoke check, not a generated application caller.

The retained `.github/workflows/scripts/symphony-linear-wakeups.mjs` standalone
entry point is separate from the YAML orchestration. A caller of that entry
point must supply
`GH_TOKEN`, `LINEAR_API_TOKEN` (or fallback `LINEAR_API_KEY`) and GitHub event
context: `GITHUB_REPOSITORY` (`owner/repository`), `GITHUB_EVENT_NAME`,
`GITHUB_EVENT_PATH` (path to webhook JSON), `GITHUB_ACTOR` and `GITHUB_RUN_ID`.
`GITHUB_SERVER_URL` is optional, default `https://github.com`, for evidence URLs;
it does not change the helper's GitHub API endpoint. `GITHUB_STEP_SUMMARY` is an
optional output-file path, unset by default outside Actions.

The standalone bridge's `applyPlan` function in
`.github/workflows/scripts/symphony-linear-wakeups.mjs` checks an exact synthetic
Linear viewer display name before writing. Its replacement location and token
owner are described in the setup reference. `LINEAR_WAKEUP_BOT_NAME` is a
documentation name, not a read environment variable. Keep the matching
credential-owner documentation in `docs/engineering/review/cadence-linear-workpad.md`
aligned during later setup; do not disable the guard. No new override is provided.

The standalone bridge's `resolveIssue` also reads `linear.teamKey`; configure
the checkout instead of editing a `DEMO-` recognizer. Its retained dispatch-run
support accepts an anchored `[linear:TEAM-123]` run-name marker, using the
configured team, before PR title or branch identity. The current YAML does not
use that entry point or marker. The standalone bridge records/deduplicates
evidence in the Cadence workpad and preserves review coordination. Neither
path completes a Linear issue or overrides terminal-state protection. Ordinary
tooling CI requires none of this optional event or credential setup.

## Review and local environment

The native workflow hooks invoke the Claude runner using the credentials below.
The [review contract](../review/cadence-ai-review.md#acceptance-contract) describes
its PR-review output and workpad evidence.
Required Google Docs need source access only when actually linked.
Set the applicable credential names documented in the generated reference in
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
