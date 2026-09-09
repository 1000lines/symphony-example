# Symphony hackathon readiness: requirements and design

Date: 2026-09-09. Status: proposed design for human review, not a deployment
record. Canonical requirements artifact for [100-6](https://linear.app/1000lines/issue/100-6/create-requirements-and-design-doc).

```yaml
project-code: hackathon-ready
project-color: pink
base-branch: main
human-lead: Jeremy Carroll
human-github: jeremycarroll
primary-repository: 1000lines/symphony-example
runtime-repository: 1000lines/symphony
design-issue: 100-6
plan-issue: 100-7
fan-out-issue: 100-8
activation: human-only
```

## Goal and scope

Make the existing local Symphony installation ready for September 12, 2026:
Codex performs Cadence review, two GitHub Apps supply implementation and review
identities, and each change has repository CI evidence with a working wait and
resume path. The integrated demonstration must work without either bot user
being a collaborator of the target repository.

The target is the existing host at `https://symphony.1000lines.dev`, AWS account
`350353785278`, region `us-west-2`. This ticket changes only this design. It
does not change credentials, App registrations, CI, runtime code, daemon states,
or the live host. It does not create a DAG, fan-out payload, or implementation
tickets. The later reviewed plan owns decomposition and resource ownership.

The project remains parked. Jeremy alone supplies the starting gun; planning
does not activate downstream work. Implementation frontier tickets start in
`Backlog`; hard dependents remain `Blocked`. Preserve direct blocker relations,
clean task branches from `main`, PRs against `main`, draft publication, labels
`pink` and `symphony`, and Jeremy as assignee. No predecessor commits may enter
a task branch before they land on `main`.

Out of scope: automatic Misc routing, Google Docs, dashboard authentication,
public refresh, DNS migration away from Route 53, optional AMI automation,
general provider abstraction, a new product or planning framework, deletion of
bot accounts, `wake:5m`, and ordinary-ticket timers. No upstream runtime change
is presently required by this design. Jeremy owns the September 10 organizers
email and obtaining the event key; this document does not send that email.

## Source inputs and observed baseline

All required source inputs below were read successfully on September 9. There
are **no unavailable required source documents**. Missing operator values are
listed separately under open items; unknown registration inventory is not
evidence that no Apps exist.

| ID  | Source read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Evidence or relevance                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 | [Live Linear project](https://linear.app/1000lines/project/symphony-hackathon-readiness-178a07b73fe2) and 100-6 description/comments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Metadata, human intent, three outcomes, activation restriction. Read through injected GraphQL.                                                                                          |
| S02 | [Authoritative brief at 9673504](https://github.com/1000lines/symphony-example/blob/9673504cfc0c96e11a8de79c9a0247ec53827f7f/docs/symphony-plans/hackathon-ready-brief.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | GitHub contents API read; SHA-256 `f742ed757d816c7b4be31f1b9435ce0589a694dcd9c6d6b47520e66e832081da` matches the checkout.                                                              |
| S03 | [MIGRATION.md](../../MIGRATION.md), [WORKFLOW.md](../../WORKFLOW.md), [hosted WORKFLOW.md](../../scripts/symphony/runtime-bundle/workflow/WORKFLOW.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Deployment/credential history and the deployed Active-only configuration. Hosted bundle, not root WORKFLOW.md, is rendered on the host.                                                 |
| S04 | [Project workflow](../engineering/symphony/project-workflow.md), [proof standard](../engineering/symphony/proof-of-work.md), [planning README](README.md), [schema](fan-out-plan-schema.md), [split criteria](fan-out-criteria.md), [DAG package](../../tools/symphony-dag/package.json)                                                                                                                                                                                                                                                                                                                                                                                                                                              | Existing planning conventions, evidence fields, review gates, and state bridges. No new planning schema is introduced here.                                                             |
| S05 | `.github/workflows/cadence-ai-review{,-trigger,-events}.yml`, `cadence-linear-rework.yml`, and their scripts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Current PAT/Claude reviewer, visible user review requests, verification, actor filters, three-pass cap, human handoff. Consumer inventory below names the seams.                        |
| S06 | `.github/workflows/symphony-{build,lint,test,linear-wakeups}.yml`, `package.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Three reusable CI workflows with only `workflow_call`; no automatic caller. Non-review bridge excludes successful ordinary checks. GitHub workflow API reports wakeups `disabled_fork`. |
| S07 | [Runtime daemon source](https://github.com/1000lines/symphony/blob/e4d3f6a05b0a00201c9d04d3ceca02b206e22de5/elixir/lib/symphony_elixir/daemon_wake.ex), [schema](https://github.com/1000lines/symphony/blob/e4d3f6a05b0a00201c9d04d3ceca02b206e22de5/elixir/lib/symphony_elixir/config/schema.ex), supporting `linear/issue.ex` and `orchestrator.ex` at that commit                                                                                                                                                                                                                                                                                                                                                                  | Supported intervals, engine workpad anchor, jitter, dispatch lease, state constraints, retry limits. Retrieved through GitHub contents API.                                             |
| S08 | [Codex Action documentation](https://learn.chatgpt.com/docs/github-action), [pinned action source](https://github.com/openai/codex-action/blob/86365089eb2b84e0a8fb0717b304f8bdcb13b20e/action.yml)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | API-key-backed execution, explicit CLI/model inputs, structured output, protected execution. `v1` resolved through its annotated tag to this commit.                                    |
| S09 | [GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app), [installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app), [check runs](https://docs.github.com/en/rest/checks/runs), [workflow dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event), [review requests](https://docs.github.com/en/rest/pulls/review-requests#request-reviewers-for-a-pull-request), [workflow triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) | Permission, authentication, event and check-publication constraints.                                                                                                                    |
| S10 | [Rehearsal PR #1](https://github.com/1000lines/symphony-example/pull/1) and its submitted reviews                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Merged; PAT/Anthropic review of `a6fa5f15478fbb6ac74f521704d7514f06a96706`. Baseline proof only, not proof of this design.                                                              |
| S11 | `scripts/symphony/host/install.d/{40-credentials,80-config}.sh`, `host/lib.sh`, `host/install-runtime.sh`, `host/templates/symphony.service`, `scripts/symphony/setup-local-env.sh`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Secret materialization, fixed-token assumptions, Codex auth file, reload entry point.                                                                                                   |
| S12 | `.claude/skills/cadence-ai-review/SKILL.md`, its `review-CLAUDE.md`, and `scripts/symphony/runtime-bundle/review-axes/standing-docs-current-state.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Review criteria to adapt as source material; not an instruction to run a review or mutate the legacy files in this ticket.                                                              |

Repository observations use `1000lines/symphony-example` base
`ce68e3967ffb155331cdb29ccb78ec627585512b`. Source inventory records paths at that
ref; proposed paths below are explicitly identified as additions.

The current host uses `1000-symphony-bot` through `symphony/keys:GITHUB_TOKEN`.
Cadence uses `CADENCE_BOT_GITHUB_TOKEN`, `CADENCE_LINEAR_API_TOKEN`, and
`CADENCE_AI_REVIEW_ANTHROPIC_API_KEY` in GitHub Actions; its configured model is
`claude-opus-5`. MIGRATION records both PATs expiring September 16. No App ID,
installation ID, registered owner, or private-key location is recorded there.
This worker has repository push/triage access, not administration access;
registration absence and installation permissions have not been independently
certified. O01 assigns that inventory to Jeremy before any App creation.

The live Linear team has Active, Inactive, Backlog, Blocked and terminal states;
it has no Happy/Unhappy/Evaluating states. Both workflow profiles disable daemon
configuration. Earlier deployment notes deferring daemons describe current
behavior; the later human brief brings the selected daemon integration into
future scope. Neither source establishes a working CI recovery loop today.

## Requirements and acceptance criteria

IDs are stable planning inputs. Each later plan node must name the requirements
it owns and copy the relevant decisions, evidence, and open-item gates. Owners
below are follow-up responsibility types, not created implementation tickets.

| ID  | Required behavior                                                                             | Acceptance evidence                                                                                                                                                                                | Intended owner                             |
| --- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| R01 | Codex replaces the active Claude review runner without weakening review criteria.             | Real current-head review plus fixtures for blocker, human-needed, nonblocking notes, unreadable source, malformed output, and stale result; no active Anthropic dependency.                        | Cadence integration                        |
| R02 | Reuse Symphony's existing OpenAI key initially; rotate to the event key without code changes. | Successful initial review; secret-name/version inventory, host reload, real review and host execution after rotation; no key values.                                                               | Credential rollout; Jeremy supplies key    |
| R03 | Distinct installation identities implement and review.                                        | Clone, commit/push, workflow-file push, PR creation, labels and human assignment as Symphony App; review/check publication as Cadence App. Target repository has neither bot user as collaborator. | App credentials and installation rehearsal |
| R04 | Credentials are scoped and renewable.                                                         | Matrix permission tests; operation after token expiry; revoked installation, denied permission upgrade and unselected repository fail closed without PAT fallback.                                 | App credentials                            |
| R05 | Machine acceptance has one unambiguous current-head contract.                                 | Correct App/name/SHA/generation accepted; spoofed App, prior SHA, newer queued review, missing workpad or malformed findings rejected by every consumer. Human approval remains separate.          | Acceptance integration                     |
| R06 | Every change receives actual repository CI.                                                   | Workflow/run URL, tested SHA, check names and results for docs and code changes authored by the App. Missing/failed/canceled/timed-out/stale checks never pass.                                    | Repository CI                              |
| R07 | Missing host toolchains do not prevent reviewable publication.                                | A small Rust change published from a host without Rust and tested in repository CI; local unavailable check explicitly reported.                                                                   | CI rehearsal and runtime instructions      |
| R08 | Waiting work releases slots and resumes correctly.                                            | Pending ticket Inactive and absent from running workers; failing CI wakes it to Active once; corrected head requires fresh checks/review; green head reaches human handoff.                        | CI/review handoff                          |
| R09 | Existing 15-minute daemon recovers missed events.                                             | Real timer lease Happy/Unhappy → Evaluating → resting verdict, engine anchor timestamps, jitter/poll delay and recovered ordinary ticket recorded; duplicate events and terminal tickets tested.   | Daemon integration/rehearsal               |
| R10 | Installation, cutover and recovery are documented and actually verified.                      | Accepted target refs, host deploy/reload evidence and complete credential/operation inventory in MIGRATION.md; obsolete active PAT/Anthropic dependencies removed after replacement succeeds.      | Deployment/finalization                    |
| R11 | Project activation and scope remain controlled.                                               | Plan preserves Backlog frontier/Blocked dependents, Jeremy assignment and direct hard relations; no uncommissioned extensions.                                                                     | 100-7 and 100-8                            |

## Locked design decisions

These choices are proposed for acceptance with this design. They are definite
inputs to 100-7, not claims that the running system implements them.

| ID  | Decision and rationale                                                                                                                                                                                | Enforcing owner           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| D01 | Use the pinned official Codex Action with a deterministic acquisition/publication wrapper. The model assesses evidence; trusted code validates and publishes it.                                      | Cadence integration       |
| D02 | Use two installation-only Apps. No OAuth user-token flow, bot invitations, implicit human PAT, or organization-team read dependency.                                                                  | App credentials           |
| D03 | Select `Cadence Review` check run emitted by the Cadence App as the sole AI acceptance signal. Do not produce automated APPROVE or REQUEST_CHANGES reviews after cutover.                             | Acceptance integration    |
| D04 | Queue review through explicit workflow dispatch; replace user-review-request orchestration. Only human review invitations continue to use the review-request API.                                     | Cadence event integration |
| D05 | Require successful repository CI and a fresh successful Cadence result before maturity/normal human handoff. Human acceptance/merge owns Done.                                                        | Shared gate consumers     |
| D06 | Add an adopter-owned CI caller; no path exclusions that omit all checks. Start with existing full build/lint/test on every change plus Markdown formatting where relevant.                            | Repository CI             |
| D07 | One monitoring daemon per opted-in repository monitors ordinary Inactive tickets. Ordinary tickets never enter daemon states. Reuse wake:15m and the existing runtime.                                | Daemon integration        |
| D08 | Reuse the existing bridge helpers and workpads for reconciliation. No second scheduler, planning framework, or new database.                                                                          | CI/review handoff         |
| D09 | Stage rollout on the existing host, keep the working reviewer until replacement evidence exists, and rotate the external key last when available.                                                     | Deployment/finalization   |
| D10 | Keep all implementation work parked until human activation and all task PR bases at main. Runtime code stays unchanged unless a reproducible defect requires an explicitly reviewed design amendment. | 100-7, 100-8, Jeremy      |

## Codex review execution

Pin `openai/codex-action@86365089eb2b84e0a8fb0717b304f8bdcb13b20e`, Codex CLI
`0.147.0` (the host's existing pinned version), model `gpt-6-astra`, and effort
`xhigh`. Record them in the result. This selects the known host model rather
than silently resolving a moving model default. Action/CLI compatibility must
pass the R01 rehearsal; a pin change needs a reviewed update, not an automatic
upgrade. Use `sandbox: read-only`, `safety-strategy: drop-sudo`, a fresh Codex
home, and the action's API proxy. Explicitly allow only the configured Symphony
and Cadence App bot actors when necessary; never wildcard actors.

Trusted base-branch code acquires the exact PR head, base, diff, checks, complete
human feedback, issue/project/comments and required Markdown sources. Put this
evidence in a separate read-only review tree. Do not execute PR scripts in the
job holding provider or publication credentials. Missing required sources make
the review human-needed. Do not pass GitHub App private keys or Linear write
tokens to the assessment process. Perform acquisition and publication in
separate jobs with minimum tokens; pass bounded evidence/results as artifacts.
PR text and files are evidence, not instructions to change the review contract.

Adapt the existing Cadence instructions into a provider-independent prompt
under `.github/codex/` (proposed location). Preserve requirement extraction,
stable finding IDs, reviewability, scope, test/evidence, compatibility,
architecture, relevant conditional axes, cross-PR coverage/seams, human
feedback, and standing-doc current-state review. Preserve the classifications
`blocker`, `human-needed`, `should-fix`, and `suggestion`: only the first two
prevent AI acceptance unless a human makes another item mandatory. Preserve
incremental review, full review after force-push or incomplete history, and the
three-pass cap reset by fresh human-grounded input. Always acquire review
threads/replies as well as submitted reviews and top-level comments; the current
timeline helper's 100-item window is not proof that feedback is absent.

Use JSON schema-constrained output with repository, PR number, head SHA,
review generation, requirements/coverage, findings with class/status/evidence,
human-feedback disposition, and concise assessment. A trusted publisher checks
identity, output schema, source coverage, current head/generation and check
status again, persists through `scripts/cadence-linear-workpad.mjs`, and then
publishes the check. A successful model process alone is insufficient. Missing
output, denials, unavailable credentials or a failed required workpad write
produce an operational failure, never a clean review.

## GitHub Apps and credential contract

Jeremy owns the App registration inventory and initial setup under `1000lines`.
Prefer reusing compatible existing registrations after verifying ownership and
distinct identities. If none exists, register two publicly installable Apps
owned by `1000lines`; names/slugs and numeric IDs are O01 values, not guessed
identities. Public installation allows customers to install on selected
repositories without inviting service users.

Keep privileged review workflows and signing secrets in the operator-controlled
`1000lines/symphony-example` repository (the controller). Initially controller
and target are the same repository. For another installed target, dispatch the
controller workflow with validated target repository ID, PR, head and generation;
use that target's Cadence installation token to read/publish there. Never copy
the shared App private key, provider key or Linear token into a customer
repository. The host holds the Symphony signing credential and can dispatch
the controller with a controller-scoped token. Both Apps need the documented
controller and target installations; resolve each explicitly, never reuse an
installation ID across owners.

Controller-repository events keep the immediate bridge path. For other targets,
the host monitor polls the installed repository's CI and human feedback and
dispatches the controller; latency is the documented 15-minute recovery path.
The controller publisher invokes the same handoff evaluator after publishing
target results. No customer event relay, custom webhook server or signing-key
distribution is required. Clients enable their repository CI and the operator
records the Linear/project mapping. App installation supplies target GitHub
authority; controller credentials and host onboarding remain operator-owned.

### Permission matrix

All permissions below are repository permissions. Metadata read is implicit.
Request no organization, account, administration, secrets or members permission.
Permission names and granted installations must be verified against actual API
operations during R03/R04, including GraphQL calls used by `gh`.

| Operation                                             | Symphony App                         | Cadence App                         | Contract/test                                                                                             |
| ----------------------------------------------------- | ------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Clone/fetch; read source/diffs                        | Contents read/write                  | Contents read                       | Installation token over HTTPS; no SSH or credential-manager fallback.                                     |
| Push task code                                        | Contents read/write                  | None beyond read                    | PR author and commit identity recorded as implementation App.                                             |
| Push `.github/workflows` changes                      | Workflows write, plus Contents write | None                                | Actual workflow-file rehearsal push. Do not confuse Workflows with Actions permission.                    |
| Create/edit PR, assign Jeremy, draft/ready transition | Pull requests write                  | Pull requests write                 | Cadence uses its write permission for human requests/findings, not implementation.                        |
| Read/add PR labels and bounded finding summary        | Issues write                         | Issues write                        | Narrow REST labels/comments; preserve labels. No label creation during normal publication.                |
| Read CI jobs, logs and run results                    | Actions read/write                   | Actions read/write                  | Write is needed for allowed review/CI dispatch and recovery, not just reading.                            |
| Dispatch approved workflow/retry run                  | Actions write                        | Actions write                       | Fixed workflow allowlist and validated repository/ref/PR inputs. No arbitrary workflow name from PR text. |
| Read checks/statuses                                  | Checks read; Commit statuses read    | Checks write; Commit statuses read  | Observe CI without assuming a status name is from a trusted App.                                          |
| Emit/update `Cadence Review`                          | No Checks write                      | Checks write                        | Assert returned check's `app.id`, name and `head_sha`.                                                    |
| Request human review; optional line findings          | Pull requests write                  | Pull requests write                 | Eligible human assignees only; no App invitation as a reviewer.                                           |
| Read/update Linear workpads/state                     | Separate existing Linear credential  | Separate existing Linear credential | GitHub permission does not grant Linear access; reviewer only writes Cadence workpad, bridge owns state.  |

Symphony's Actions write and Workflows write are required for this setup project;
do not silently request broader authority. A registration permission increase
requires the installation owner's approval. Until granted, report the missing
permission and park affected work; minting another token cannot grant it.
Remove inherited `humans`/`ai` team lookups from the required path. Use explicit
App IDs/slugs and human-lead/PR-assignee mapping plus repository permission
checks. Unknown actors cannot authorize a privileged dispatch.

### Installation and renewal

Record non-secret App IDs, owner, slug, installation IDs and selected repository
IDs in the operator inventory. Resolve installations with App authentication,
then mint tokens for the exact installation/repository and minimum operation
permissions. Verify the granted repository set and permissions. Verify App
identity using App/installation endpoints and the returned publisher identity;
`gh api user` and PAT-prefix checks are not installation-token preflights.
Controller dispatch tokens need Actions write and source read only. Target
Cadence assessment tokens need source/PR/check reads; publication tokens add
Checks/Issues/Pull requests write. Request Actions write on a target token only
for a permitted CI retry. Registration grants bound these narrower tokens.

Use the existing host credential integration points for a renewal helper.
Git askpass, `gh` invocations, and direct API clients must each request a current
token; refreshing only an environment file cannot update a long-running
worker's inherited token. Cache tokens privately with `expires_at`, refresh
five minutes before expiration, and serialize refresh for each installation.
After an authentication-expiry response refresh once, then retry only after
reading whether a write already happened. An interrupted Git operation may
reconnect with a fresh token; verify the remote SHA before retrying a push.
Do not assume token length or a PAT prefix.

GitHub installation tokens expire after one hour. A revoked/suspended
installation, removed repository, denied permission or repeated auth failure
stops affected operations with the exact cause in the workpad; no fallback to
bot/human PATs. Actions jobs mint at job start and again before publication if
necessary, then revoke on completion. Host restarts must reload App material
and mint new tokens rather than revive a cached expired token. Preserve HTTPS
transport and secret-free remote URLs.

### Secret names and rotation procedure

The following names distinguish current locations from proposed additions.
Values never enter commits, logs, artifacts, Terraform variables or state.

| Location                             | Name                                                                                            | Use/status                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| AWS Secrets Manager, `us-west-2`     | `symphony/keys`, JSON field `OPENAI_API_KEY`                                                    | Existing initial provider key; preserve other fields when updating it.                                                           |
| Host                                 | `/etc/symphony/runtime.env`, `/var/lib/symphony/cache/codex-home/auth.json`                     | Existing materialized provider copies; regenerate both, then restart service.                                                    |
| GitHub Actions controller repository | `CADENCE_OPENAI_API_KEY`                                                                        | Proposed secret containing the same initial key; later the event key. Action input reads this name.                              |
| AWS Secrets Manager                  | `symphony/github-apps/symphony`                                                                 | Proposed separate JSON secret for implementation App private key and identifiers; materialized privately for the renewal helper. |
| GitHub Actions controller repository | `CADENCE_APP_PRIVATE_KEY`; variables `CADENCE_APP_ID`, `CADENCE_INSTALLATION_ID`                | Proposed review App credentials. Host monitor does not receive this signing key.                                                 |
| Host/Actions                         | `LINEAR_API_TOKEN` / `CADENCE_LINEAR_API_TOKEN`                                                 | Existing Linear access retained; no provider change implies a Linear-token change.                                               |
| AWS/GitHub Actions                   | `symphony/keys:GITHUB_TOKEN`, `CADENCE_BOT_GITHUB_TOKEN`, `CADENCE_AI_REVIEW_ANTHROPIC_API_KEY` | Legacy dependencies retained only through staged verification, then removed from the active path and retired by Jeremy.          |

During the later authorized rollout, Jeremy securely copies the existing
OpenAI value into `CADENCE_OPENAI_API_KEY`, without printing it. When the event
key arrives, drain active workers/reviews, update that Actions secret and only
`OPENAI_API_KEY` in `symphony/keys`, record secret version IDs/timestamps, and
run the accepted host checkout's
`scripts/symphony/host/install-runtime.sh --only 40-credentials` as the operator.
That step writes runtime.env and Codex auth; `systemctl restart symphony`
reloads the service environment. The App migration must first adapt this step
so it no longer requires the retired PAT. Restarting alone does not reread
Secrets Manager. Verify service/Linear polling, a real host Codex task, and a
fresh Cadence review before marking rotation complete. A newly dispatched
Actions job reads the updated secret; an already running job does not prove
the new value works. If verification fails, keep readiness blocked and record
the recovery action. Any temporary rollback key must still be authorized;
do not silently extend borrowed-key use beyond the event deadline.

## Acceptance signal and every consumer

The selected check is named **`Cadence Review`**, emitted with the configured
Cadence installation token. It attaches to the PR's exact `head.sha`, not the
workflow's default-branch SHA or a synthetic merge SHA. Include `details_url`
to the run, and an `external_id` identifying repository ID, PR, head, review
generation and attempt. The structured artifact and Cadence workpad share
these fields and stable finding IDs. The check summary contains the concise
assessment; detailed requirements/findings stay in the workpad/artifact.
Line annotations may supplement it, with bounded batches and safe paths.

| Result                                                         | Check status/conclusion                       | Consequence                                                                                        |
| -------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Queued/running review                                          | queued/in_progress, no conclusion             | No AI acceptance; visible pending state replaces the old review request.                           |
| No open blocker or human-needed finding                        | completed/success                             | AI acceptance only if freshness and persistence checks also pass. Optional notes stay nonblocking. |
| Actionable blocker                                             | completed/failure                             | Reconcile to Active for correction with finding IDs.                                               |
| Human-needed finding or three-pass cap                         | completed/action_required                     | Inactive, named human question and review request; no mature label.                                |
| Invalid output, provider/API failure, missing required workpad | completed/failure, operational-error category | Inactive for access/operator recovery or bounded infrastructure retry; do not invent code rework.  |
| Superseded head/generation, canceled or timed-out run          | completed/cancelled or timed_out              | No acceptance; reconcile the newest head/generation.                                               |

Only success qualifies; neutral/skipped/absent results cannot satisfy this gate.
The trusted wrapper must finalize failed/canceled checks when possible, and the
reconciler must detect abandoned queued/running checks when finalization fails.
The old bot APPROVE may remain historical evidence but is ignored after cutover.
Do not require an App to be a selectable human reviewer. Preserve human review
events and notes; a human APPROVED review is not a replacement for missing CI.

Define `ai_accepts` as: current open PR and valid project/labels; expected App
ID/name; matching head; latest required review generation completed successfully;
valid output with no mandatory findings; and matching durable workpad evidence.
Define `ci_passes` as the complete nonempty configured CI requirement set passing
for that head and latest applicable attempts. Exclude `Cadence Review` from
that CI set to avoid circular waiting. Normal human handoff and maturity require
both predicates. GitHub branch rules should bind the check to its emitting App
where supported, with the same identity check always enforced by consumers.
Jeremy configures repository protection; bots do not gain administration access.

A review generation captures head SHA plus the latest relevant human feedback
IDs and update timestamps (including inline thread replies and Linear comments),
base revision, and a manual-retry generation. New human feedback invalidates
earlier acceptance even at the same head. Under serialized per-PR routing,
create the next queued check before dispatch; consumers also compare the live
feedback watermark so a missed event cannot preserve stale acceptance. Before
completion, re-read head and watermark; an older run cannot overwrite or satisfy
a newer generation. Repeated delivery of the same context reuses that generation.
If history cannot establish freshness, do a full review, not a skip.

| Consumer/seam                                                                                                                       | Required migration                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/fetch-pr-review-state.mjs`                                                                                                 | Read App-owned checks and persisted generations instead of newest bot APPROVED review; retain incremental/rebase/paged-out decisions and add complete feedback acquisition.                               |
| `.github/workflows/cadence-ai-review-trigger.yml` and `scripts/verify-cadence-ai-review.cjs` beneath that workflow directory        | Replace Claude execution/config validation and PR-review false-green guard with schema, expected App, check, generation and persistence verification.                                                     |
| `cadence-ai-review-events.yml`, `cadence-ai-review.yml`, `scripts/cadence-ai-review-route-event.mjs` beneath the workflow directory | Replace requests/re-requests/dismissals to the bot user with queued checks and explicit dispatch; keep human-input reset, three-pass limit and per-PR coalescing.                                         |
| `.github/workflows/scripts/request-pr-reviewer.mjs`                                                                                 | Retain for human requests only; remove it from machine-review queue and stale-AI-approval handling.                                                                                                       |
| `scripts/github-actor-classification.mjs` and workflow-level actor gates                                                            | Recognize both configured App bot identities, prevent self-trigger loops, drop required organization-team queries; do not classify all `[bot]` actors as trusted.                                         |
| `scripts/cadence-linear-rework.mjs`, `cadence-linear-rework.yml`                                                                    | Consume fresh check findings; keep direct human feedback wakes and human-needed/cap escalation. Do not request normal human approval until CI and AI predicates hold.                                     |
| `scripts/cadence-linear-workpad.mjs` and fixtures                                                                                   | Persist result/check identity, generation, disposition, findings and actual handoff outcomes while retaining incremental requirement/finding history.                                                     |
| `.github/workflows/scripts/symphony-linear-wakeups.mjs`, its workflow, and the monitor                                              | Recognize CI success as well as failure; handle Cadence completion in the review path, not as an ordinary failing build; exclude bridge/review orchestration runs from validation evidence and recursion. |
| Root/hosted WORKFLOW.md, runtime-bundle instructions/skills, `docs/engineering/{review,symphony}/` and adapted Cadence prompt       | Replace automated-approval wording with the predicate; preserve human acceptance, evidence standards, draft/ready and maturity semantics. Update assertions/fixtures that encode the old signal.          |
| Maturity consumers in `tools/symphony-dag/` conventions and runtime maturity gate                                                   | Runtime still consumes the blocker issue's `mature` label, not GitHub reviews. The label writer checks both predicates and ready status. No change to runtime label semantics or task ancestry.           |
| Finalization, MIGRATION.md and operator branch rules                                                                                | Require current target-ref CI/review/deploy evidence; a green review check never marks Done or proves deployment by itself.                                                                               |

All code paths that consume these values must share one interpretation, with
fixture coverage at each boundary. Inventory by searching `APPROVE`, `APPROVED`,
`reviewDecision`, `staleApproval`, `CADENCE_REVIEWER`, `cadence-loop` and `mature`
before cutover; remaining occurrences must be human semantics, history, tests,
or explicitly retired paths. Existing user-identity/token assumptions in clone,
CLI wrappers, label helper and host bootstrap belong in the credential migration.

## CI evidence and bootstrap

Add `.github/workflows/ci.yml` as the adopter-owned caller in the later CI work.
Use `push` for every branch and `pull_request` for opened/synchronize/reopened
PRs, including drafts and documentation. Run unprivileged with read-only
checkout credentials and no provider, App-signing or Linear secrets. Explicitly
check out the PR head SHA for PR events; record the event, base SHA and tested
SHA so merge-ref tests are not misrepresented as head tests. For push events
test the pushed SHA. Deduplicate runs by repository/head/event class and let
the gate select the latest applicable attempt; duplicate CI is not duplicate
implementation dispatch.

Call the existing `symphony-build`, `symphony-lint`, and `symphony-test` workflows
with `tooling-directory: .`. Add a narrow Markdown formatting job for changed
Markdown, using the locked Prettier dependency. A final `CI Required` job runs
with `always()` and succeeds only when the expected jobs actually succeeded;
all-docs changes still invoke real checks. Pin its exact emitted check name and
GitHub Actions App identity after the first run. Record child job/run results
too; an aggregator whose dependencies all skipped is not evidence. Product
repositories keep their own build/test/lint commands and declare a nonempty
equivalent requirement set. No generalized validation framework is required.

Use App installation credentials for pushes/PRs that must trigger workflows.
Verify actual runs rather than infer triggering from an API success. The
repository workflow token has different event behavior, documented by GitHub;
it is not the selected implementation identity. A host missing Rust may still
run cheap available checks and push a draft. Record unavailable local tests and
wait for repository CI. Update contrary host/agent instructions in the later
integration work; do not install every product toolchain on the host.

Bootstrap must not claim CI coverage before the caller exists:

1. Requirements and planning PRs use the current working reviewer and available
   local validation. Record that automatic build/lint/test CI is absent. This
   design PR does not repair the gap or claim R06 complete; human acceptance of
   a planning artifact is separate from project readiness.
2. After reviewed planning and Jeremy's activation, prepare the CI caller PR
   using the existing identity. Its branch `push` trigger runs the caller and
   reusable workflows from that branch. Inspect the exact tested SHA and all
   results before asking Jeremy to merge; reusable workflows cannot simply be
   manually dispatched on their own today.
3. Merge the verified caller to `main`; confirm a main run, then configure its
   required check. Default-branch-only bridges/dispatch entry points become
   usable only after their own accepted changes land and are enabled. Do not
   use a future default-branch workflow as evidence for the PR creating it.
4. Migrate reviewer/identities and waiting integration behind their verified
   cutover boundaries. Demonstrate an App-authored docs change and code change
   both trigger CI. Read back check names/App IDs and update the inventory.
5. Exercise failure/correction, missed-event recovery and the absent-toolchain
   rehearsal before project readiness. Record any bootstrap-only exception and
   its closure in MIGRATION.md; do not propagate a CI exemption to normal work.

## Exact wait, resume and daemon contract

### Ordinary tickets and event reconciliation

After push/PR publication, Symphony records repository, PR, current head,
expected CI checks, evidence URLs and wait reason in its pinned Codex workpad,
sets the issue to `Inactive`, and exits. Optional waiting labels are hints only.
The trusted bridge and daemon read live GitHub/Linear state; a label, event
payload or cached success alone cannot authorize a transition.

| Observation for the current head                                                    | Ordinary ticket action                                                                                                                                                                      | Next actor                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| CI queued/running                                                                   | Keep Inactive; record pending check names and run URLs.                                                                                                                                     | CI completion event or monitor |
| Required CI missing for less than 20 minutes after publication                      | Keep Inactive; report awaiting workflow appearance, never pass.                                                                                                                             | Event or monitor               |
| CI absent after 20 minutes, canceled/timed out, or operational infrastructure error | Keep Inactive; attempt at most one safe allowlisted retry per head/run failure; otherwise record exact operator question.                                                                   | CI integration owner/Jeremy    |
| Current required CI fails with actionable code/test diagnostic                      | Re-read issue/head; move Inactive → Active with the diagnostic and evidence. Already Active is a no-op.                                                                                     | Symphony correction            |
| All required CI succeeds; AI review absent/pending/stale                            | Keep Inactive; ensure one current review generation is queued.                                                                                                                              | Cadence                        |
| Fresh Cadence blocker                                                               | Re-read issue/head; move Inactive → Active, link mandatory findings.                                                                                                                        | Symphony correction            |
| Cadence human-needed/cap/credential failure                                         | Keep Inactive; explicit owner/question; request eligible human assignee.                                                                                                                    | Human or credential owner      |
| Both predicates pass and feedback ledger is closed                                  | Wake Inactive → Active once for **handoff reconciliation only**; worker rechecks, marks PR ready, applies mature if required, records evidence, returns Inactive and requests human review. | Symphony, then Jeremy          |
| Human changes request or nonempty actionable comment                                | Direct existing human-feedback path to Active; approval with notes queues a Cadence re-look.                                                                                                | Symphony/Cadence               |
| Closed PR, terminal issue, wrong repo/project, missing identity or changed head     | No stale mutation or acceptance; record skip or missing mapping.                                                                                                                            | Human if unresolved            |

The handoff-only wake is keyed by `(issue, PR, head, review generation,
handoff action)` and persisted so an unchanged green result does not wake the
worker every 15 minutes. Apply `mature` only on the blocker after required
current-head CI, fresh AI acceptance and ready-for-human state. Preserve the
existing selective removal rule: remove for rejected acceptance or a severe
regression making dependent work unsafe, not ordinary review edits alone.
Neither maturity nor a CI completion activates the parked project frontier.

Use explicit waiting limits: missing CI is overdue after 20 minutes; queued CI
is overdue after 60 minutes; running CI is overdue after its configured workflow
timeout (20 minutes for the existing reusable workflows), allowing one polling
cycle for completion visibility. Overdue work follows the operational-error
row, not indefinite pending. A safe retry requires an existing failed run or a
verified dispatchable allowlisted workflow and the same current head. A missing
caller cannot be repaired by retrying it; that case goes directly to the CI
owner. Successful API retry submission is recorded as pending, not passing.

Extend the existing non-review bridge to route successful ordinary CI
completions, rather than relying on its present failure-only gate. Keep
same-repository/head checks, issue association, project metadata and labels,
terminal protection, run-attempt evidence and merge-conflict handling. A
`workflow_run` payload's SHA may describe orchestration code, so resolve actual
tested head and jobs before accepting it. Exclude the review workflow's own
green job from `ci_passes`; process its explicit Cadence check instead.

### Dedicated monitor daemon

Create the monitor only in the accepted fan-out. Its description contains the
target repository, Linear team/project allowlist, nonempty CI requirement set,
human lead and this contract. It does not implement fixes and is not a blocker
of ordinary tickets. Scope is opted-in waiting tickets, never all Backlog,
Blocked or unrelated Inactive work. No new Misc routing is involved.

The later runtime-bundle configuration is:

```yaml
tracker:
  active_states: [Active, Evaluating]
  daemon_states: [Happy, Unhappy]
  daemon_dispatch_states: [Evaluating]
  daemon_default_wake: 15m
agent:
  max_concurrent_agents_by_state:
    Evaluating: 1
```

Jeremy/operator setup creates Happy/Unhappy as nonterminal resting states and
Evaluating as a started dispatch state, resolves their IDs, applies `wake:15m`
to the monitor, and deploys the accepted workflow configuration. It remains in
Backlog until explicit activation. Configuration requires resting states to be
disjoint from active/terminal states and dispatch states to be active; adding
names alone does not implement the scan.

On each run the daemon performs a bounded scan using the shared bridge
evaluation helpers: paginate eligible waiting issues and current PRs/checks,
apply the ordinary-ticket table, reconcile missing review dispatches, record
actual results, and exit. It runs no product test suites and never waits for CI
to finish. Budget five minutes per scan; persist pagination cursor/counts when
that budget is exhausted, and resume on the next wake without starving later
issues. A partial scan is visible as incomplete, not a clean all-clear.

| Monitor transition            | Meaning                                                                                                                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Happy or Unhappy → Evaluating | Runtime timer is due; existing orchestrator checks blockers/capacity, writes dispatch state and re-fetches before leasing a worker.                                                                                                                |
| Evaluating → Happy            | Scan completed; no failed/stale/overdue validation or unresolved handoff/API error. Pending CI within its workflow timeout is healthy waiting; zero waiting issues is healthy.                                                                     |
| Evaluating → Unhappy          | Any actionable failing CI/review (even if successfully woken), overdue/missing checks, incomplete scan, API/access failure or unreconciled handoff. Record per-issue reason and owner.                                                             |
| Crash/retry exhaustion        | Existing runtime retries and attempts restoration from state history after three retries. Missing history can leave Evaluating dispatchable; Jeremy inspects and restores the resting state. Never claim automatic recovery if restoration failed. |

Both resting verdicts wake again: Unhappy is not a terminal failed ticket. The
worker writes its detailed scan in its own Codex workpad and sets the resting
verdict before exit. The engine owns `## Symphony Workpad` and its timestamp,
which anchors the next timer; agents must not update that anchor themselves.
Verify the engine's post-run write in the deployed rehearsal. A Codex/Cadence
workpad edit does not reset the runtime clock. Missing/duplicate anchor warnings
must be recorded, not treated as a clean monitoring result.

At the pinned runtime, the timer is anchor time + 15 minutes plus stable jitter
from {-60, -30, 0, 30, 60} seconds, then polling (currently 30 seconds), worker
capacity and possible startup staggering. This is approximately 14–16 minutes
plus polling/queue delay, not a five-minute or strict 15-minute SLA. Capture
anchor, computed due time, actual dispatch and queue delay. No ordinary-ticket
timer or interval extension is justified.

### Duplicate and missed-event handling

Keep one runtime host for this Linear team. Share predicate/action code between
event bridges and the daemon; serialize workflow runs by repository/PR, retain
current-head event keys, and re-read head, issue state and feedback immediately
before mutation. The host's in-flight issue tracking prevents two simultaneous
workers for an already Active issue. Persist action keys and actual readback
results; retries observe existing review generations, requests and states
before writing. A repeated successful handoff must not request another review
or dispatch another worker.

Linear lacks compare-and-swap; the present bridge's ten-record deduplication
history is bounded. This design does not claim distributed exactly-once writes.
Safety also requires idempotent transitions, current-state rechecks and the
durable current-head handoff marker. A recording failure is an unresolved
handoff, not success. After any mutation verify the resulting state; stop and
report concurrent human/terminal transitions rather than repeatedly overwriting
them. Tests must interleave event/monitor actions and terminal-state changes.

The daemon observes dropped successful and failed CI events, stalled review
generations and denied dispatches. A review still running past its 60-minute
workflow timeout becomes an operational error, with at most one automatic
retry per generation; thereafter Jeremy owns recovery. The three-pass finding
cap is separate and cannot be bypassed by retries. Routine duplicate events,
self-authored output, check publication and workpad writes do not reset caps.

## Rollout, recovery and completion evidence

The reviewed plan must preserve the following integration ordering without
turning this document into a ticket graph:

- Bootstrap real CI before using CI evidence to accept integration changes.
- Inventory/install Apps before testing installation credentials. Prepare
  credential helpers and App-aware consumers before the host identity cutover.
- Land compatible publisher and consumer changes before selecting the check
  contract. Only one authoritative reviewer path runs for a PR generation.
  Rehearse Codex and the check flow on a designated PR/repository while the
  current production reviewer remains available; do not emit competing verdicts.
- Enable completion bridges and deploy the monitor's instructions/config before
  activating the monitor. Verify the current host runtime revision and bundle
  provenance; do not rebuild upstream solely to add supported state names.
- Cut over the selected review/provider path, prove the integrated flow, then
  retire active Anthropic/PAT dependencies. Preserve recovery instructions and
  bot accounts. A temporary rollback to the old path is explicitly recorded as
  not App-only/Codex-ready, with one selected signal mode and no mixed acceptance.
- Rotate the event key when Jeremy supplies it, independently of earlier
  implementation. Final readiness stays blocked if that input is absent.

Finalization records in MIGRATION.md: exact deployed source/runtime SHAs,
workflow/action/CLI pins, App ownership/IDs/permissions/installations/repository
selection, secret names/version IDs, reload steps and outcomes, check/run URLs,
Linear state before/after, retired dependencies, operator actions and limits.
Recovery first parks affected work/monitor and preserves the last verified
working configuration; no automatic credential or registration deletion.

| Scenario                          | Required recorded proof                                                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Successful small docs change      | App-authored PR/commit, actual CI jobs, Codex result and App-owned successful check at the same head, ready transition and Jeremy handoff; neither bot collaborator.                     |
| Failed then corrected code change | Failed run and Active wake, fix/new SHA, fresh CI/review, old success rejected, no duplicate worker.                                                                                     |
| Missing local Rust                | Host check showing Rust unavailable; reviewable fixture change and repository Rust CI run URL/results. A minimal rehearsal fixture is sufficient.                                        |
| Pending and missing event         | Inactive ordinary ticket, worker slot released, dropped-event rehearsal, actual 15-minute daemon lease/verdict and recovered action.                                                     |
| Identity/freshness failures       | Wrong App/name, old SHA, same-SHA new feedback, stale attempt, malformed/missing output and failed workpad all fail closed.                                                              |
| Credential lifecycle              | Token renewal across expiry, revoked/unselected installation and permission-upgrade denial, secret-free evidence; new provider key works after reload.                                   |
| Operational failure/race          | Missing/canceled/timed-out CI, no workflow caller, provider denial, cap, no eligible human, daemon crash/history failure and terminal/concurrent changes produce explicit safe outcomes. |

Every proof item identifies target ref, command/environment, acceptance
criterion, artifact location, result, limitation and next handoff. Source
inspection and fixture tests are not substitutes for the live integration,
installation, timer, rotation and deployment demonstrations. R01–R11 all need
coverage; configuration alone is not final readiness.

## Open items and planning handoff

No unresolved product choice is delegated to 100-7: the provider integration,
permission matrix, signal semantics, CI bootstrap and daemon model are selected
above. The following missing values/evidence become named operator or
verification gates. Preserve them explicitly rather than inventing values.

| ID  | Missing value/question                                                                                                                                                                   | Owner / follow-up type                               | Blocks                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| O01 | Which existing App registrations and installations can be reused? Record owner, IDs/slugs, repository selection, permissions and approver; confirm inventory before creating duplicates. | Jeremy / App inventory and installation              | App creation/cutover and R03/R04, not design or code preparation                    |
| O02 | What is the organizers' event key and when is it available?                                                                                                                              | Jeremy / external credential acquisition             | Final rotation and readiness; not initial Codex implementation                      |
| O03 | Which isolated repository/PR will demonstrate neither bot as collaborator and the missing-Rust scenario? Record repository ID and observed collaborator/installation evidence.           | Jeremy / installation rehearsal                      | Live R03/R07 proof; a minimal fixture is the selected fallback surface              |
| O04 | What check names/App IDs and branch-rule configuration are actually emitted after the caller lands?                                                                                      | CI integration + Jeremy / repository configuration   | Required-check enforcement and R06; do not guess observed names                     |
| O05 | What Linear state IDs, monitor issue ID and activation time result from authorized setup?                                                                                                | Jeremy / daemon deployment                           | R09 activation only; leave downstream tickets parked                                |
| O06 | Do the pinned Action/CLI/model combination and App permissions pass the real rehearsal?                                                                                                  | Cadence/App integration / compatibility verification | Cutover; failures require a reviewed pin/permission correction, not silent fallback |

100-7 should map each R/D/O ID to reviewed ownership and evidence, assign shared
workflow/helper files to a single coherent owner, and preserve the ordering
constraints above. Use `tools/symphony-dag/` and existing Mermaid/manifest/direct
relation contracts for its own plan. It must not invent parallel planning
infrastructure or convert soft sequencing into hard blockers. 100-8 alone owns
the later authorized fan-out from that accepted plan. This document supplies
requirements and decisions, not their graph, payloads or ticket activation.
