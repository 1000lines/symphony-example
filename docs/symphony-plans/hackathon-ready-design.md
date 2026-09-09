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
listed separately under open items; registration identities are now supplied
and verified, while installation grants remain rollout evidence.

Source IDs remain stable. Repository paths describe observed inputs, not files
changed by this ticket.

- **S01:** [Live Linear project](https://linear.app/1000lines/project/symphony-hackathon-readiness-178a07b73fe2)
  and 100-6 description/comments, read through injected GraphQL: metadata,
  outcomes, human ownership and activation restriction.
- **S02:** [Authoritative brief at 9673504](https://github.com/1000lines/symphony-example/blob/9673504cfc0c96e11a8de79c9a0247ec53827f7f/docs/symphony-plans/hackathon-ready-brief.md),
  fetched through GitHub contents API. SHA-256
  `f742ed757d816c7b4be31f1b9435ce0589a694dcd9c6d6b47520e66e832081da`
  matches the checkout.
- **S03:** [MIGRATION.md](../../MIGRATION.md), [WORKFLOW.md](../../WORKFLOW.md)
  and [hosted WORKFLOW.md](../../scripts/symphony/runtime-bundle/workflow/WORKFLOW.md):
  deployment history and Active-only configuration. The hosted bundle is the
  deployed workflow source.
- **S04:** [Project workflow](../engineering/symphony/project-workflow.md),
  [proof standard](../engineering/symphony/proof-of-work.md),
  [planning README](README.md), [schema](fan-out-plan-schema.md),
  [split criteria](fan-out-criteria.md), [DAG package](../../tools/symphony-dag/package.json)
  and `.agents/skills/symphony-project-factory/templates/`: planning and gates.
- **S05:** `.github/workflows/cadence-ai-review{,-trigger,-events}.yml`,
  `cadence-linear-rework.yml` and their scripts: PAT/Claude review, actor
  filters, three-pass cap, stale approvals and human handoff.
- **S06:** `.github/workflows/symphony-{build,lint,test,linear-wakeups}.yml`
  and `package.json`: three reusable workflows, each only `workflow_call`,
  with no automatic caller. GitHub reports wakeups `disabled_fork`; its source
  includes the `17,47 * * * *` merge-conflict sweep.
- **S07:** [Runtime daemon source](https://github.com/1000lines/symphony/blob/e4d3f6a05b0a00201c9d04d3ceca02b206e22de5/elixir/lib/symphony_elixir/daemon_wake.ex)
  and [schema](https://github.com/1000lines/symphony/blob/e4d3f6a05b0a00201c9d04d3ceca02b206e22de5/elixir/lib/symphony_elixir/config/schema.ex),
  with supporting `linear/issue.ex` and `orchestrator.ex` at that ref: interval,
  anchor, jitter, state constraints, lease and retry behavior.
- **S08:** [Official Codex Action documentation](https://learn.chatgpt.com/docs/github-action)
  and [pinned action source](https://github.com/openai/codex-action/blob/86365089eb2b84e0a8fb0717b304f8bdcb13b20e/action.yml):
  API-key execution, CLI/model pins, structured output and process protection.
- **S09:** Official GitHub documentation for
  [App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app),
  [installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app),
  [check runs](https://docs.github.com/en/rest/checks/runs),
  [dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event),
  [review requests](https://docs.github.com/en/rest/pulls/review-requests#request-reviewers-for-a-pull-request),
  [triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow),
  [environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
  and [branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
  The installation preflight also uses [App visibility](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/making-a-github-app-public-or-private),
  [registration changes](https://docs.github.com/en/apps/maintaining-github-apps/modifying-a-github-app-registration),
  [ownership transfer](https://docs.github.com/en/apps/maintaining-github-apps/transferring-ownership-of-a-github-app)
  and [App metadata API](https://docs.github.com/en/rest/apps/apps#get-an-app).
- **S10:** [Rehearsal PR #1](https://github.com/1000lines/symphony-example/pull/1),
  merged, with PAT/Anthropic approval of
  `a6fa5f15478fbb6ac74f521704d7514f06a96706`. Jeremy confirms that rehearsal
  succeeded. It remains valid baseline evidence for the setup loop.
- **S11:** `scripts/symphony/host/install.d/{40-credentials,55-node-toolchain,80-config}.sh`,
  `host/lib.sh`, `host/install-runtime.sh`, `host/templates/symphony.service`,
  `scripts/symphony/setup-local-env.sh` and runtime-bundle README:
  credentials, actual install pin, provenance fallback and reload entry point.
- **S12:** `.claude/skills/cadence-ai-review/SKILL.md`, its `review-CLAUDE.md`,
  `scripts/symphony/runtime-bundle/review-axes/standing-docs-current-state.md`
  and root README: review criteria and acceptance guidance to migrate.
- **S13:** [Jeremy's PR feedback](https://github.com/1000lines/symphony-example/pull/2#issuecomment-5605278113)
  and Cadence's [first review](https://github.com/1000lines/symphony-example/pull/2#pullrequestreview-5156808681)
  and [follow-up](https://github.com/1000lines/symphony-example/pull/2#pullrequestreview-5157256852):
  local-first/CI-fallback modes, operator handoffs, existing App IDs, selected
  Rust repository, configurable checks, automatic state discovery and technical
  corrections. Fresh human decisions supersede the original unanswered questions.
- **S14:** Public `GET /apps/1000lines-cadence` and
  `GET /apps/1000lines-symphony`: owner, App IDs, slugs and registration grants
  read on September 9. Both also returned HTTP 200 without authentication;
  responses contain no visibility field. Installation grants and private keys
  were not queried.
- **S15:** [Rust rehearsal repository](https://github.com/jeremycarroll/venn-search-rs/tree/99528c2e4da241ec2c9961d0a155357611f16a76),
  repository ID `1076114173`: README, CLAUDE.md and `.github/workflows/ci.yml`
  read at that ref. [Existing CI run](https://github.com/jeremycarroll/venn-search-rs/actions/runs/18952923407)
  supplies six successful check names and GitHub Actions App ID `15368`.
  This is target tooling evidence, not an App migration rehearsal.

The task branch starts at `ce68e3967ffb155331cdb29ccb78ec627585512b` on `main`.
The September 9 rework also inspected `main` at
`df3c6ebd3b086b340a6dac7537527e56d889397f`; its intervening changes concern
planning activation/templates. Runtime and CI observations above are unchanged.
Proposed paths below are additions, not claims about files already deployed.

The host still uses `1000-symphony-bot` through `symphony/keys:GITHUB_TOKEN`.
Cadence uses `CADENCE_BOT_GITHUB_TOKEN`, `CADENCE_LINEAR_API_TOKEN` and
`CADENCE_AI_REVIEW_ANTHROPIC_API_KEY` in Actions, with `claude-opus-5`.
MIGRATION records both PATs expiring September 16. Jeremy has now supplied the
existing App registrations; the verified inventory is below. This worker has
push/triage but no administration access to the controller and read-only access
to the Rust target. Those limits require operator assistance for later rollout,
not another product decision or a block on design/code preparation.

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
| R07 | Run tests locally; use Docker only for local environment gaps; always run repository CI. | Local passing tests skip Docker; the selected Rust target proves container fallback without a host toolchain. Both paths have current-commit CI evidence on the shared review surface. | CI rehearsal and runtime instructions |
| R08 | Waiting work releases slots and resumes correctly.                                            | Pending ticket Inactive and absent from running workers; failing CI wakes it to Active once; corrected head requires fresh checks/review; green head reaches human handoff.                        | CI/review handoff                          |
| R09 | Existing 15-minute daemon recovers missed events.                                             | Real timer lease Happy/Unhappy → Evaluating → resting verdict, engine anchor timestamps, jitter/poll delay and recovered ordinary ticket recorded; duplicate events and terminal tickets tested.   | Daemon integration/rehearsal               |
| R10 | Installation, cutover and recovery are documented and actually verified.                      | Accepted target refs, host deploy/reload evidence and complete credential/operation inventory in MIGRATION.md; obsolete active PAT/Anthropic dependencies removed after replacement succeeds.      | Deployment/finalization                    |
| R11 | Project activation and scope remain controlled.                                               | Plan preserves Backlog frontier/Blocked dependents, Jeremy assignment and direct hard relations; no uncommissioned extensions.                                                                     | 100-7 and 100-8                            |
| R12 | Review the selected repository across owners without distributing controller secrets.         | App-only PR/CI/Codex/check/handoff in `jeremycarroll/venn-search-rs`; wrong target/installation/Linear mapping rejected; neither bot collaborator.                                                 | Cross-repository integration and rehearsal |

## Locked design decisions

These choices are proposed for acceptance with this design. They are definite
inputs to 100-7, not claims that the running system implements them.

| ID  | Decision and rationale                                                                                                                                                                                           | Enforcing owner                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| D01 | Use the pinned official Codex Action with a deterministic acquisition/publication wrapper. The model assesses evidence; trusted code validates and publishes it.                                                 | Cadence integration             |
| D02 | Use two public installation-only Apps owned by `1000lines`. No OAuth user-token flow, bot invitations, implicit human PAT, or organization-team read dependency.                                                 | App credentials                 |
| D03 | Select `Cadence Review` check run emitted by the Cadence App as the sole AI acceptance signal. Do not produce automated APPROVE or REQUEST_CHANGES reviews after cutover.                                        | Acceptance integration          |
| D04 | Queue review through explicit workflow dispatch; replace user-review-request orchestration. Only human review invitations continue to use the review-request API.                                                | Cadence event integration       |
| D05 | Require successful repository CI and a fresh successful Cadence result before maturity/normal human handoff. Human acceptance/merge owns Done.                                                                   | Shared gate consumers           |
| D06 | Add an adopter-owned CI caller; no path exclusions that omit all checks. Start with existing full build/lint/test on every change plus Markdown formatting where relevant.                                       | Repository CI                   |
| D07 | One monitoring daemon per opted-in repository monitors ordinary Inactive tickets. Ordinary tickets never enter daemon states. Reuse wake:15m and the existing runtime.                                           | Daemon integration              |
| D08 | Reuse the existing bridge helpers and workpads for reconciliation. Daemon owns recovery for opted-in projects; the existing cron excludes them after handover. No new scheduler, planning framework or database. | CI/review handoff               |
| D09 | Stage rollout on the existing host, keep the working reviewer until replacement evidence exists, and rotate the external key last when available.                                                                | Deployment/finalization         |
| D10 | Keep all implementation work parked until human activation and all task PR bases at main. Runtime code stays unchanged unless a reproducible defect requires an explicitly reviewed design amendment.            | 100-7, 100-8, Jeremy            |
| D11 | Cross-repository dispatch is required for the selected Rust target (R12). Use a trusted controller mapping and per-target CI configuration; no general customer control plane.                                   | Cross-repository/CI integration |

## Codex review execution

Pin `openai/codex-action@86365089eb2b84e0a8fb0717b304f8bdcb13b20e`, Codex CLI
`0.153.4` (the install default in `55-node-toolchain.sh`), model `gpt-6-astra`, and effort
`xhigh`. Record them in the result. This selects the known host model rather
than silently resolving a moving model default. Action/CLI compatibility must
pass the R01 integration verification; a pin change needs a reviewed update, not an automatic
upgrade. `host/lib.sh`'s `0.147.0` is only a provenance-reporting fallback;
record the actual deployed binary version during rollout. Use
`sandbox: read-only`, `safety-strategy: drop-sudo`, a fresh Codex home, and the
action's API proxy. Explicitly allow only the configured Symphony
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

Reuse these existing `1000lines` registrations. Do not create duplicates.
Jeremy supplied the identities; public App API readback confirms them.

| Role           | Slug                 | App ID    | Observed registration permissions                                                            |
| -------------- | -------------------- | --------- | -------------------------------------------------------------------------------------------- |
| Review         | `1000lines-cadence`  | `4866513` | Actions read; Checks, Issues and Pull requests write; Contents and Metadata read.            |
| Implementation | `1000lines-symphony` | `4866508` | Actions and Checks read; Contents, Issues, Pull requests and Workflows write; Metadata read. |

Both currently report no webhook subscriptions. The selected dispatch/poll
model needs none. Verify public installability, installations, selected
repositories and effective grants during authorized setup. Registration
permissions are not proof that an installation has accepted those permissions.
The matrix below adds Actions write and Commit statuses read to both current
registrations for dispatch/retry and status observation. Jeremy applies those
changes and approves them on each installation; no agent needs App-admin access
to prepare the implementation or the exact operator checklist.

Public visibility is the selected installation model for both Apps. A private
App can only be installed on its owning account; membership in `1000lines`
does not let an org-owned private App install on `jeremycarroll` (S09).
Anonymous metadata readback (S14) is not proof of target installation success.
During setup, Jeremy verifies each registration's visibility and, if private,
uses **Advanced → Make public** before installing it on the personal account.
Record the setting and successful installations on both owners. A private
setting blocks live R03/R07/R12 proof until changed; planning and code
preparation continue with these concrete PR-visible operator instructions.

GitHub also supports transferring App ownership, but that does not make a
private App installable on two owners. The selected controller/target model
therefore retains `1000lines` ownership and public visibility. A transfer would
need a reviewed ownership/mapping update, not an automatic installation fallback.
Once a public App has installations on other accounts, GitHub prevents making
it private until those installations are removed. Recovery must account for
that restriction; it must not silently uninstall the target or toggle visibility.

Keep privileged review workflows in `1000lines/symphony-example` (the controller).
It reviews itself and the selected cross-owner target
`jeremycarroll/venn-search-rs` (repository ID `1076114173`). This bounded
cross-repository path is required September-12 scope under R12, not optional
forward compatibility. Additional repositories use the same configuration;
a customer portal, custom webhooks and automatic onboarding remain outside scope.

Store signing, provider and Linear secrets only in a controller Environment
named `cadence-controller` (proposed), restricted to the controller's exact
protected default branch. Privileged jobs must declare that Environment and
check out trusted default-branch code. Remove duplicate repository-level or
broad organization-secret grants after migration; branch CI must not access
these values. PRs changing privileged workflows/configuration require human
review before merge. This is necessary even when controller and target coincide
and the Symphony App can push workflow files. Rehearse a branch attempt and
verify the Environment denies secret access. Environment or branch-protection
setup that needs administration becomes a concrete Jeremy handoff.

Add a small data file at `.github/symphony/repositories.yml` in the controller
(proposed; owned by the integration work, not a planning framework). Each entry
contains repository ID/full name, enabled flag, Linear team/project ID and
human lead, both App/installation IDs, controller dispatch workflow/ref,
CI requirements and waiting limits defined below. Load it from the protected
controller default branch and record its revision in review/CI evidence. Host
and controller use the same revision; disagreement blocks that target's action
until refreshed. Discover IDs via APIs during setup; an incomplete entry stays
disabled while independently reviewable code preparation continues.

This operator-approved mapping is the authorization source. Dispatch inputs
may identify a repository/PR/head/generation, but cannot supply authority or
choose credentials. Resolve the repository by numeric ID, verify its current
owner/name, installation selection, open PR/head and unique Linear association
against the mapping before token minting/publication/state changes. Reject
unknown targets, caller-supplied installation IDs and cross-project substitutions.
Install both Apps on the controller and target, resolving installation IDs per
owner. Never reuse an installation ID across `1000lines` and `jeremycarroll`.

The host uses the Symphony signing credential for a controller-scoped dispatch
token; the controller mints a separate Cadence token for the selected target.
Controller events retain immediate bridges. The target's monitor polls CI and
complete human feedback and dispatches review on the controller, using the
15-minute recovery cadence. The publisher evaluates the target handoff after
publication. It must publish checks against the target head, not the controller
workflow SHA. No App private key, provider key or Linear token is copied into
the Rust/customer repository; App installation plus normal repository CI and
the operator-owned mapping provide the required GitHub integration.

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

| Location                                    | Name                                                                                            | Use/status                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AWS Secrets Manager, `us-west-2`            | `symphony/keys`, JSON field `OPENAI_API_KEY`                                                    | Existing initial provider key; preserve other fields when updating it.                                                                                            |
| Host                                        | `/etc/symphony/runtime.env`, `/var/lib/symphony/cache/codex-home/auth.json`                     | Existing materialized provider copies; regenerate both, then restart service.                                                                                     |
| Controller `cadence-controller` Environment | `CADENCE_OPENAI_API_KEY`                                                                        | Proposed secret containing the same initial key; later the event key. Action input reads this name.                                                               |
| AWS Secrets Manager                         | `symphony/github-apps/symphony`                                                                 | Proposed separate JSON secret for implementation App private key and identifiers; materialized privately for the renewal helper.                                  |
| Controller `cadence-controller` Environment | `CADENCE_APP_PRIVATE_KEY`; variables `CADENCE_APP_ID`, `CADENCE_CONTROLLER_INSTALLATION_ID`     | Proposed review App credentials. Controller installation is separate from target installation IDs in the mapping; host monitor does not receive this signing key. |
| Host/Actions                                | `LINEAR_API_TOKEN` / `cadence-controller:CADENCE_LINEAR_API_TOKEN`                              | Existing Linear access retained; no provider change implies a Linear-token change.                                                                                |
| AWS/GitHub Actions                          | `symphony/keys:GITHUB_TOKEN`, `CADENCE_BOT_GITHUB_TOKEN`, `CADENCE_AI_REVIEW_ANTHROPIC_API_KEY` | Legacy dependencies retained only through staged verification, then removed from the active path and retired by Jeremy.                                           |

### Operator handoff when credentials or administration are missing

Expect implementation workers to lack App administration/private-key access.
Finish the code, configuration shape and available tests first. Put the exact
blocked operation, error/presence result, affected repository/App, required
permission, secret destination and resume command in the PR description under
an operator-action heading; mirror it in the pinned Codex workpad. Never put a
key value in a PR. For this rollout the prepared handoff is:

First verify public visibility for both existing registrations using the
preflight above, and record the result before attempting either cross-owner
installation. Include **Advanced → Make public**, conditional on a private
setting, in the implementation PR's operator instructions if access is denied.

1. Jeremy opens the existing `1000lines-symphony` registration (`4866508`),
   applies the matrix delta and generates a private key if no usable operator
   key exists. Store `{app_id, private_key}` in AWS Secrets Manager
   `symphony/github-apps/symphony` in `us-west-2`. Resolve/install for both
   owners and record installation/repository IDs in the controller mapping.
2. For `1000lines-cadence` (`4866513`), approve the matrix delta, install on the
   controller and target, and place its private key in
   `cadence-controller:CADENCE_APP_PRIVATE_KEY`. Set `CADENCE_APP_ID=4866513`
   and the discovered `CADENCE_CONTROLLER_INSTALLATION_ID`; target IDs come
   from the mapping. The operator retains any backup outside the worker.
3. Configure the protected Environment and narrowly scoped access to the
   Symphony AWS secret for the host renewal helper. Populate the Environment's
   `CADENCE_OPENAI_API_KEY` and `CADENCE_LINEAR_API_TOKEN`. Return only secret
   names/version IDs and installation IDs to the PR/workpad.
4. Run the accepted credential materializer/reload step below and the
   implementation PR's installation-token smoke check. Record API identity,
   granted permissions and fresh check/run URLs, never the token. Resume the
   blocked live verification in Active when these inputs are available.

Missing credentials park the affected issue in Inactive with this actionable
handoff, while other independent preparation can proceed. They do not justify
creating substitute Apps, borrowing a PAT, widening scopes or asking Jeremy
to design the integration. This design ticket performs none of these steps.

During the later authorized rollout, Jeremy securely copies the existing
OpenAI value into `CADENCE_OPENAI_API_KEY`, without printing it. When the event
key arrives, drain active workers/reviews, update that Environment secret and
only `OPENAI_API_KEY` in `symphony/keys`, record secret version IDs/timestamps, and
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
At cutover, inventory all open opted-in PRs and dismiss approvals by the exact
legacy Cadence bot identity, preserving human reviews. Remove obsolete requests
to that bot, record review IDs and successful dismissal readback, then queue
fresh checks. If dismissal is denied by repository policy, park that target and
provide Jeremy the exact review IDs/API action; do not claim cutover complete.
Dismissed reviews remain historical evidence and are ignored by new consumers.
Do not require an App to be a selectable human reviewer. Preserve human review
events and notes; a human APPROVED review is not a replacement for missing CI.

Define `ai_accepts` as: current open PR and valid project/labels; expected App
ID/name; matching head; latest required review generation completed successfully;
valid output with no mandatory findings; and matching durable workpad evidence.
Define `ci_passes` once: every member of the nonempty, trusted per-repository
CI allowlist must have a completed **success** for the current head and latest
applicable run/attempt. Each member identifies exact check name and owning App
ID, workflow path, allowed event/ref policy and expected tested SHA. Validate
Actions run/job provenance too; a lookalike job from a different workflow is
not that requirement. Duplicate ambiguous candidates, unknown conclusions,
neutral, skipped, action_required, missing or stale results do not pass.

Only allowlisted validation jobs are candidates; orchestration, review,
label-repair, bridge and unrelated deploy jobs cannot enter the set implicitly.
Both predicates are required for normal human handoff and maturity. GitHub
branch rules bind required checks to the emitting App where supported, while
consumers additionally enforce workflow identity. App binding alone cannot
distinguish two workflows using GitHub Actions. Changes to required workflow
logic, mappings and branch policy require human review; neither App gets
administration or a branch-rule bypass. Jeremy applies any required repository
protection from the prepared integration PR instructions.

A review generation captures head SHA plus the latest relevant human feedback
IDs and update timestamps (including inline thread replies and Linear comments),
base and controller-configuration revisions, and a manual-retry generation. New human feedback invalidates
earlier acceptance even at the same head. Under serialized per-PR routing,
create the next queued check before dispatch; consumers also compare the live
feedback watermark so a missed event cannot preserve stale acceptance. Before
completion, re-read head and watermark; an older run cannot overwrite or satisfy
a newer generation. Repeated delivery of the same context reuses that generation.
Exclude generated workpad/check bookkeeping from the human-feedback watermark,
even when automation writes through a human-owned credential. If history cannot
establish freshness, do a full review, not a skip.

| Consumer/seam                                                                                                                                                          | Required migration                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/fetch-pr-review-state.mjs`                                                                                                                                    | Read App-owned checks and persisted generations instead of newest bot APPROVED review; retain incremental/rebase/paged-out decisions and add complete feedback acquisition.                               |
| `.github/workflows/cadence-ai-review-trigger.yml` and `scripts/verify-cadence-ai-review.cjs` beneath that workflow directory                                           | Replace Claude execution/config validation and PR-review false-green guard with schema, expected App, check, generation and persistence verification.                                                     |
| `cadence-ai-review-events.yml`, `cadence-ai-review.yml`, `scripts/cadence-ai-review-route-event.mjs` beneath the workflow directory                                    | Replace requests/re-requests/dismissals to the bot user with queued checks and explicit dispatch; keep human-input reset, three-pass limit and per-PR coalescing.                                         |
| `.github/workflows/scripts/request-pr-reviewer.mjs`                                                                                                                    | Retain for human requests only; remove it from machine-review queue and stale-AI-approval handling.                                                                                                       |
| `scripts/github-actor-classification.mjs` and workflow-level actor gates                                                                                               | Recognize both configured App bot identities, prevent self-trigger loops, drop required organization-team queries; do not classify all `[bot]` actors as trusted.                                         |
| `scripts/cadence-linear-rework.mjs`, `cadence-linear-rework.yml`                                                                                                       | Consume fresh check findings; keep direct human feedback wakes and human-needed/cap escalation. Do not request normal human approval until CI and AI predicates hold.                                     |
| `scripts/cadence-linear-workpad.mjs` and fixtures                                                                                                                      | Persist result/check identity, generation, disposition, findings and actual handoff outcomes while retaining incremental requirement/finding history.                                                     |
| `.github/workflows/scripts/symphony-linear-wakeups.mjs`, its workflow, and the monitor                                                                                 | Recognize CI success as well as failure; handle Cadence completion in the review path, not as an ordinary failing build; exclude bridge/review orchestration runs from validation evidence and recursion. |
| Root/hosted WORKFLOW.md, runtime-bundle instructions/skills, `docs/engineering/{review,symphony}/` and adapted Cadence prompt                                          | Replace automated-approval wording with the predicate; preserve human acceptance, evidence standards, draft/ready and maturity semantics. Update assertions/fixtures that encode the old signal.          |
| `.claude/skills/cadence-ai-review/`, including `SKILL.md`, `review-CLAUDE.md` and references                                                                           | Adapt the loaded prompt/skill and references to the check contract; retire old review publication instructions from the active path.                                                                      |
| `.agents/skills/symphony-project-factory/templates/`, especially `tickets/{plan-project,trigger-fan-out,standup}.md`, and `docs/symphony-plans/fan-out-plan-schema.md` | Generate the same current-head predicates and maturity rules. Until the template update lands, 100-7/100-8 must copy D03/D05 explicitly so newly generated tickets cannot require a retired bot APPROVE.  |
| Root `README.md` and generated/reference review guidance                                                                                                               | Update the provider, actor, token, review signal and handoff instructions; distinguish current behavior from historical deployment notes.                                                                 |
| Maturity consumers in `tools/symphony-dag/` conventions and runtime maturity gate                                                                                      | Runtime still consumes the blocker issue's `mature` label, not GitHub reviews. The label writer checks both predicates and ready status. No change to runtime label semantics or task ancestry.           |
| Finalization, MIGRATION.md and operator branch rules                                                                                                                   | Require current target-ref CI/review/deploy evidence; a green review check never marks Done or proves deployment by itself.                                                                               |

All code paths that consume these values must share one interpretation, with
fixture coverage at each boundary. Inventory by searching `APPROVE`, `APPROVED`,
`reviewDecision`, `staleApproval`, `CADENCE_REVIEWER`, `cadence-loop` and `mature`
before cutover; remaining occurrences must be human semantics, history, tests,
or explicitly retired paths. Existing user-identity/token assumptions in clone,
CLI wrappers, label helper and host bootstrap belong in the credential migration.

## CI evidence and bootstrap

### Local validation, Docker fallback, and mandatory CI

Workers and their subagents first read the target repository's README,
package/toolchain files, relevant `AGENTS.md` and `CLAUDE.md`, and `.github/`
workflow documentation. These files should explain local build/test commands,
prerequisites and available CI; inspect workflow definitions when prose is
incomplete. Later instruction changes must allow this adopter guidance even
where the extracted hosted template currently excludes legacy filenames.
Treat repository text as tooling guidance subject to task scope and instruction
priority, not permission to expose credentials or change protected settings.

Use this order and record the outcome in the workpad and PR:

- **Preferred — local compile/test:** run the documented build and relevant
  tests when tools and isolated services are available, fix actionable failures,
  then skip Docker and publish for mandatory repository CI.
- **Fallback — Docker:** when a needed compiler/service is unavailable locally,
  record the unavailable command and use the repository's container setup or a
  suitable pinned toolchain image. Docker is unnecessary when relevant tests
  already pass locally. A failing assertion calls for a fix, not an automatic
  switch of environments. If Docker is also unavailable, record the limitation
  and publish a reviewable draft for CI; do not claim the skipped tests passed.
- **Always — repository CI:** CI is mandatory because it is the shared,
  reviewable validation surface, even when local or Docker tests pass. Record
  the workflow and tested SHA, exit Inactive while it runs, and resume concrete
  failures. Missing local Rust is not a missing-product-input blocker and does
  not require permission or installing every toolchain on the host. If CI also
  cannot run, provide the specific access/setup handoff.

For `jeremycarroll/venn-search-rs`, the read README/CLAUDE.md describe
`cargo build --release`, `cargo test` and `cargo clippy`; CI additionally runs
release tests/doc tests for `ncolors_3` through `ncolors_6`, strict Clippy and
`cargo fmt --all -- --check`. The rehearsal owner selects a small reversible
change and records both a toolchain-available local run (Docker skipped) and a
Rust-unavailable host run using Docker, with CI evidence for both. Docker was
installed on the Symphony host after the original design; see MIGRATION.md for
the verified container smoke test. Existing CI triggers main pushes
and PRs targeting main, including docs. Adapt checkout to the explicit PR head
and set documented job timeouts as part of target integration; ordinary PR
workflow defaults currently test a merge ref. Reuse these tests and keep the
Rust project's application functionality outside the readiness project.

### Configurable required checks

The controller mapping's `ci` object contains `required_checks` (nonempty),
`missing_after_minutes`, `queued_after_minutes`, `completion_grace_minutes`,
and `run_budget_minutes`. Each check has `name`, `app_id`, `workflow_path`,
allowed `events`, `tested_ref: head`, and `running_timeout_minutes` matching its
job configuration. A check with dependencies records their job IDs; dependency
waiting is evaluated from the children, not counted as aggregator execution.
This is configuration consumed by shared bridge/monitor helpers, not hard-coded
repository names or an additional scheduler.

The implementation owner discovers candidates from repository instructions,
workflow files and check/run APIs, prepares the configuration PR, and verifies
it with an actual head run. Jeremy is asked only for administration/installation
steps unavailable to the worker. Defaults are engineering choices below;
observed names/App IDs and supplied repository identities are populated now.
Adding or changing requirements uses a reviewed configuration change and a new
validation run. Configuration is read from the controller default branch,
never from the target PR under evaluation.

| Repository                     | Initial allowlist                                                                                                                                                                                                               | Provenance and remaining setup                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `1000lines/symphony-example`   | `CI Required`, App ID `15368`, `.github/workflows/ci.yml`, push or pull_request, explicit head                                                                                                                                  | Planned caller job uses `name: CI Required`; integration verifies the emitted name and child results on its first branch run before enabling the entry.      |
| `jeremycarroll/venn-search-rs` | `Test Suite (NCOLORS=3)`, `Test Suite (NCOLORS=4)`, `Test Suite (NCOLORS=5)`, `Test Suite (NCOLORS=6)`, `Clippy (Linting)`, `Format Check`; all App ID `15368`, `.github/workflows/ci.yml`, push or pull_request, explicit head | Names/App ID read from S15's successful run. Verify new App-authored head checkout, timeout settings and current branch rules during installation rehearsal. |

Each listed Rust check becomes an individual allowlist entry; no wildcard
name or approval-state fallback is allowed. For other repositories, discover
and propose their equivalents rather than asking Jeremy to enumerate checks.
Unavailable API identity is a live enablement gate, not a reason to stop
preparing defaults or reviewable code. Branch-protection setup uses the same
allowlist; a successful unrelated check cannot conceal a missing member.

### Caller and bootstrap

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
with `tooling-directory: .`. Their checkout steps currently use the default
ref; pass an explicit tested-ref input through each reusable workflow so the
caller's head selection actually reaches the executing jobs. Add a narrow Markdown formatting job for changed
Markdown, using the locked Prettier dependency. A final `CI Required` job runs
with `always()` and succeeds only when the expected jobs actually succeeded;
all-docs changes still invoke real checks. Set leaf and Markdown job timeouts
to 20 minutes and aggregator execution timeout to five minutes. The default
end-to-end run budget is 120 minutes, including dependency and queue delays;
it is a reconciler deadline, not a GitHub workflow-level timeout. Bind the
aggregator to its expected children and verify its exact emitted name and
GitHub Actions identity after the first run. Record child job/run results
too; an aggregator whose dependencies all skipped is not evidence. Product
repositories keep their own build/test/lint commands and declare a nonempty
equivalent requirement set. No generalized validation framework is required.

Use App installation credentials for pushes/PRs that must trigger workflows.
Verify actual runs rather than infer triggering from an API success. The
repository workflow token has different event behavior, documented by GitHub;
it is not the selected implementation identity. The two validation modes above
apply to both controller and product repositories.

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

| Observation for the current head                                                                     | Ordinary ticket action                                                                                                                                                                      | Next actor                     |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| CI queued/running                                                                                    | Keep Inactive; record pending check names and run URLs.                                                                                                                                     | CI completion event or monitor |
| Required CI missing for less than 20 minutes after publication                                       | Keep Inactive; report awaiting workflow appearance, never pass.                                                                                                                             | Event or monitor               |
| CI overdue, canceled/timed out, neutral/skipped/action_required, or operational infrastructure error | Keep Inactive; attempt at most one safe allowlisted retry per head/run failure; otherwise publish exact operator steps in the PR and workpad.                                               | CI integration owner/Jeremy    |
| Current required CI fails with actionable code/test diagnostic                                       | Re-read issue/head; move Inactive → Active with the diagnostic and evidence. Already Active is a no-op.                                                                                     | Symphony correction            |
| Confirmed merge conflict in an opted-in Active/Inactive PR                                           | Re-read PR/issue; wake Inactive → Active for conflict correction, or no-op if already Active. Never activate Backlog/Blocked work.                                                          | Symphony correction            |
| All required CI succeeds; AI review absent/pending/stale                                             | Keep Inactive; ensure one current review generation is queued.                                                                                                                              | Cadence                        |
| Fresh Cadence blocker                                                                                | Re-read issue/head; move Inactive → Active, link mandatory findings.                                                                                                                        | Symphony correction            |
| Cadence human-needed/cap/credential failure                                                          | Keep Inactive; explicit owner/question; request eligible human assignee.                                                                                                                    | Human or credential owner      |
| Both predicates pass and feedback ledger is closed                                                   | Wake Inactive → Active once for **handoff reconciliation only**; worker rechecks, marks PR ready, applies mature if required, records evidence, returns Inactive and requests human review. | Symphony, then Jeremy          |
| Human changes request or nonempty actionable comment                                                 | Direct existing human-feedback path to Active; approval with notes queues a Cadence re-look.                                                                                                | Symphony/Cadence               |
| Closed PR, terminal issue, wrong repo/project, missing identity or changed head                      | No stale mutation or acceptance; record skip or missing mapping.                                                                                                                            | Human if unresolved            |

The handoff-only wake is keyed by `(issue, PR, head, review generation,
handoff action)` and persisted so an unchanged green result does not wake the
worker every 15 minutes. Apply `mature` only on the blocker after required
current-head CI, fresh AI acceptance and ready-for-human state. Preserve the
existing selective removal rule: remove for rejected acceptance or a severe
regression making dependent work unsafe, not ordinary review edits alone.
Neither maturity nor a CI completion activates the parked project frontier.

Evaluate deadlines on every event and daemon observation; these are overdue
thresholds, not promises of execution at an exact minute. Default missing-check
deadline is publication + 20 minutes; a runnable job queued for 60 minutes is
overdue. A job waiting on dependencies inherits their progress/deadlines until
it becomes runnable. Running deadlines start at that job's actual `started_at`
and use its configured timeout plus two minutes for completion visibility.
Use 20-minute timeouts for existing reusable jobs/Markdown, five minutes for
`CI Required` after children finish, and an explicit 60-minute job timeout for
the Rust target during integration. An unresolved attempt also becomes overdue
at run creation + the configured 120-minute overall budget. A new head starts
new deadlines; repeated observations do not reset them.

At an observation, first consume terminal conclusions, then test these bounds
for nonterminal/missing results. Events report failures immediately when
available. The daemon acts on the first scan after a deadline: detection may
lag by another 14–16 minutes plus polling/capacity delay. Record both deadline
and observation time. Do not apply a leaf's 20 minutes to the whole caller or
to an aggregator that has not started. Fixtures cover dependency waits, late
visibility, overruns and observations straddling each deadline.

Overdue work follows the operational-error row. A safe retry requires an
existing terminal failed run or a verified dispatchable allowlisted workflow,
the same head, no active attempt and a persisted retry budget. Retry at most
once per head/failure; do not create a concurrent retry of a stuck running job.
Neutral/skipped/action_required are unsatisfied requirements: record the
actual job conclusion, distinguish approval/configuration needs from actionable
code diagnostics, and give the operator concrete steps. Unknown conclusions
also remain Inactive. A missing caller goes directly to the CI owner; retry
cannot create it. An accepted retry is pending evidence, never passing.

Extend the existing non-review bridge to route successful ordinary CI
completions, rather than relying on its present failure-only gate. Keep
same-repository/head checks, issue association, project metadata and labels,
terminal protection, run-attempt evidence and merge-conflict handling. A
`workflow_run` payload's SHA may describe orchestration code, so resolve actual
tested head and jobs before accepting it. Use only the `ci_passes` allowlist
defined above and process the explicit Cadence check through `ai_accepts`. Both event and periodic paths use those
same predicates.

### Dedicated monitor daemon

Create the monitor only in the accepted fan-out. Its description contains the
target repository, Linear team/project allowlist, nonempty CI requirement set,
human lead and this contract. It does not implement fixes and is not a blocker
of ordinary tickets. Scope is opted-in waiting tickets, never all Backlog,
Blocked or unrelated Inactive work. No new Misc routing is involved.

The current wakeup workflow also has a `17,47 * * * *` conflict sweep. During
monitor rollout, transfer its opted-in project coverage to the daemon, including
mergeability checks for open Active/Inactive PRs; cron retains only legacy
non-monitored coverage. Its filter must exclude monitored mappings once the
monitor is activated and restore coverage only on explicit rollback. Do not
leave two periodic reconcilers acting on the same target. Before switching,
prove the daemon detects base-change conflicts as well as lost CI/review events.
No new cron schedule is added.

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

The daemon integration owner queries the team's current states, reuses exact
compatible matches, and prepares creation of Happy/Unhappy as nonterminal
resting states and Evaluating as a started dispatch state. The setup code
reads back IDs, configures `wake:15m` and persists the monitor ID and mapping;
Jeremy need not supply those IDs. If state creation/configuration needs rights
the worker lacks, the PR lists exact names/types and the one operator action,
then discovery resumes. Deploy only after the accepted plan is activated. The monitor remains in
Backlog until explicit activation. Configuration requires resting states to be
disjoint from active/terminal states and dispatch states to be active; adding
names alone does not implement the scan.

On each run the daemon performs a bounded scan using the shared bridge
evaluation helpers: paginate eligible waiting issues and current PRs/checks,
apply the ordinary-ticket table, check opted-in open PR mergeability, reconcile
missing review dispatches, record actual results, and exit. It runs no product test suites and never waits for CI
to finish. Budget five minutes per scan; persist pagination cursor/counts when
that budget is exhausted, and resume on the next wake without starving later
issues. A partial scan is visible as incomplete, not a clean all-clear.

| Monitor transition            | Meaning                                                                                                                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Happy or Unhappy → Evaluating | Runtime timer is due; existing orchestrator checks blockers/capacity, writes dispatch state and re-fetches before leasing a worker.                                                                                                                |
| Evaluating → Happy            | Scan completed; no failed/stale/overdue validation or unresolved handoff/API error. Pending CI within the configured stage/run deadlines is healthy waiting; zero waiting issues is healthy.                                                       |
| Evaluating → Unhappy          | Any actionable failing CI/review or confirmed conflict (even if successfully woken), overdue/missing checks, incomplete scan, API/access failure or unreconciled handoff. Record per-issue reason and owner.                                       |
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
  Rehearse Codex and the check flow on the selected Rust target while the
  current production reviewer remains available; do not emit competing verdicts.
- Enable completion bridges and deploy the monitor's instructions/config before
  activating the monitor. Verify the current host runtime revision and bundle
  provenance; do not rebuild upstream solely to add supported state names.
- Dismiss legacy bot approvals and remove its outstanding review requests on
  every opted-in open PR, verify the readback and queue fresh App checks before
  enabling check-only acceptance. Preserve human reviews. A denied dismissal
  gets an explicit Jeremy action and prevents that target's cutover.
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

| Scenario                          | Required recorded proof                                                                                                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Successful small docs change      | App-authored PR/commit, actual CI jobs, Codex result and App-owned successful check at the same head, ready transition and Jeremy handoff; neither bot collaborator.                                                                     |
| Failed then corrected code change | Failed run and Active wake, fix/new SHA, fresh CI/review, old success rejected, no duplicate worker.                                                                                                                                     |
| Both validation paths | Local compile/test evidence with Docker skipped; the selected Rust repository also demonstrates Docker fallback on a host without Rust. Both paths require fresh repository CI run/results. |
| Cross-owner target (R12)          | `jeremycarroll/venn-search-rs` App-authored PR; both installations/repository selection and no-bot-collaborator evidence; controller dispatch/result at target head; CI/Codex/check/Linear handoff; unknown/mismatched mapping rejected. |
| Pending and missing event         | Inactive ordinary ticket, worker slot released, dropped-event rehearsal, actual 15-minute daemon lease/verdict and recovered action.                                                                                                     |
| Identity/freshness failures       | Wrong App/name, old SHA, same-SHA new feedback, stale attempt, malformed/missing output and failed workpad all fail closed.                                                                                                              |
| Credential lifecycle              | Token renewal across expiry, revoked/unselected installation and permission-upgrade denial, secret-free evidence; new provider key works after reload.                                                                                   |
| Operational failure/race          | Missing/canceled/timed-out CI, no workflow caller, provider denial, cap, no eligible human, daemon crash/history failure and terminal/concurrent changes produce explicit safe outcomes.                                                 |

Every proof item identifies target ref, command/environment, acceptance
criterion, artifact location, result, limitation and next handoff. Source
inspection and fixture tests are not substitutes for the live integration,
installation, timer, rotation and deployment demonstrations. R01–R12 all need
coverage; configuration alone is not final readiness.

## Open items and planning handoff

No unresolved product choice is delegated to 100-7: the provider integration,
permission matrix, signal semantics, CI bootstrap and daemon model are selected
above. Jeremy's supplied answers are decisions and engineering inputs, not questions
to send back to him. Remaining installation evidence and external secrets have
explicit owners; code preparation and planning can proceed without them.

| ID  | Decision or remaining action                                                                                                                                                                                                                                                         | Owner / follow-up type                                                                                        | Gate                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| O01 | Reuse Cadence `4866513` and Symphony `4866508`, owned by `1000lines`; registration grants read. Complete the public-visibility preflight, resolve installation IDs/selection, approve the specified permission delta and provide signing credentials using the operator steps above. | App integration prepares discovery and instructions; Jeremy performs unavailable administration/secret steps. | Live App cutover and R03/R04/R12; design and code preparation proceed.                              |
| O02 | Jeremy expects an event key before the event; arrival time is unknown. Continue with the existing OpenAI key and execute the documented rotation when supplied.                                                                                                                      | Jeremy / external credential acquisition; rollout owner verifies rotation.                                    | Final credential rotation/readiness only.                                                           |
| O03 | Use `jeremycarroll/venn-search-rs`, repository ID `1076114173`. Existing README/CLAUDE.md/CI read; integration selects the small rehearsal PR and gathers installation/no-collaborator and both-mode evidence.                                                                       | Cross-repository integration and rehearsal; Jeremy approves installations if needed.                          | Live R03/R07/R12 proof, not repository selection or planning.                                       |
| O04 | Implement the per-repository configuration above. Known Rust check names/App ID are populated; CI owner verifies emitted controller names and prepares branch-rule settings after the caller runs.                                                                                   | CI integration owns discovery/configuration; Jeremy only applies unavailable admin changes.                   | Enablement of current-head CI enforcement; no product answer required.                              |
| O05 | Discover/reuse or create the exact daemon states under the accepted rollout, record returned IDs and monitor ID, and keep the monitor parked until human activation.                                                                                                                 | Daemon integration owns setup/discovery; Jeremy handles any concrete permission failure.                      | Live R09 activation; no pre-supplied IDs required.                                                  |
| O06 | Jeremy confirms the existing setup rehearsal succeeded (S10). Preserve that completed baseline; collect new-version/provider/App verification during the integrated rollout, reusing evidence wherever the same criterion/ref is covered.                                            | Cadence/App integration / verification.                                                                       | New integration cutover proof, not a repeated request to approve or select the successful baseline. |

100-7 should map each R/D/O ID to reviewed ownership and evidence, assign shared
workflow/helper files to a single coherent owner, and preserve the ordering
constraints above. Use `tools/symphony-dag/` and existing Mermaid/manifest/direct
relation contracts for its own plan. It must not invent parallel planning
infrastructure or convert soft sequencing into hard blockers. 100-8 alone owns
the later authorized fan-out from that accepted plan. This document supplies
requirements and decisions, not their graph, payloads or ticket activation.
