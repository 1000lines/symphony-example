# Symphony client template: requirements and design

```yaml
project-code: client-template
project-color: pink
repository: 1000lines/symphony-example
base-branch: main
human-lead: Jeremy Carroll
design-issue: 100-38
plan-issue: 100-39
```

Status: proposed for Jeremy's review, September 11, 2026. This document is the
canonical design input to [100-39](https://linear.app/1000lines/issue/100-39) after
human approval and merge. It defines outcomes and interfaces, not a fan-out plan
or authorization to implement them. Open planning PRs as drafts; a fresh clean
Cadence review marks them ready for human review under D9. Readiness does not
authorize merge, admin override or planning-seed `mature`; human approval and
merge remain prerequisites to planning-seed maturity and downstream planning.

## Goal and scope

Give an existing repository a small client for Jeremy's shared Symphony host.
Participants install no host. Build the template in
`templates/symphony-client/`, publish the reviewed contents as the public
`1000lines/symphony-client-template`, and develop reusable workflows initially in
`symphony-example`. Near the end of the project, move those workflows and their
required helpers into public `1000lines/symphony-client-workflows` (working name).
Publish a template ref pinned to that workflow source, then prove it by applying
it to an isolated `symphony-example` checkout and reviewing the adoption PR.
Remove the staging directory only after successful extraction and adoption.

The [project brief](https://linear.app/1000lines/project/symphony-client-copier-template-0b2d70d81c4f)
narrows the wider September 12 MVP to the template, necessary shared-workflow
compatibility changes, onboarding skills, both repository publications, and real
self-adoption proof. Three participant repos and concurrent host operation belong
to the parent MVP. This project defines and delivers the skills for
`onboard <repo-url>`; the parent owns operating them across the participant repos.

Out of scope: Terraform, per-user provisioning, rebuilding the shared host,
GitHub Issues tracking, `copier update`, post-generation agentic questions,
new planning validators/frameworks, a credential service, upstream submission,
application deployments and reopening old readiness work. Do not revive the
dormant Codex controller or copy the entire tooling repository into clients.

## Sources and observed baseline

All required inputs below were read successfully on September 11. No required
source is unavailable. `orc-app` and Jeremy's Downloads are not prerequisites.

| Input                                                                                                                                                        | Revision or evidence                                                                                                                                                                                           | Design consequence                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [100-38](https://linear.app/1000lines/issue/100-38) and full project brief                                                                                   | Linear GraphQL; initial brief `2026-09-11T12:46:33.717Z`, amended for human decisions `2026-09-11T13:16:59.919Z`                                                                                               | Deliver design only; small template, extraction and adoption; human merges.                                                                                                         |
| [Hackathon MVP scope — client-template source](https://linear.app/1000lines/document/hackathon-mvp-scope-client-template-source-c5a644291330)                | Full Linear document; updated `2026-09-11T12:47:03.100Z`                                                                                                                                                       | Exact questions/secrets, provider selection, fork/direct paths and credential restriction.                                                                                          |
| [Jeremy's workflow-repository decision](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5634828727)                                       | September 11, 2026, 13:03 UTC; GitHub permission API confirms `jeremycarroll` has `admin` access                                                                                                               | Start in `symphony-example`, then extract workflows into a separate repository near project end; supersedes permanent seed-repository ownership.                                    |
| [Jeremy's configuration, onboarding and CI decisions](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5634926972)                         | September 11, 2026, 13:11 UTC; repository admin access verified                                                                                                                                                | Repositories support many Linear projects; remove the project-key answer/field. Deliver onboarding skills initially in `symphony-example` and support native, Docker and remote CI. |
| [Jeremy's public-fork credential decision](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5634958976)                                    | September 11, 2026, 13:14 UTC; admin authority verified. Public App API confirms App `4866513` permissions; org listing returns three public repos. Comment records installation `160764288` across all repos. | Use the existing Cadence App for public MVP forks; remove OD1 and its gate. Accept the stated review/issue/check write authority; retain explicit secret provisioning.              |
| [Jeremy's advisory-check decision](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5635132545)                                            | September 11, 2026, 13:28 UTC; repository admin access verified                                                                                                                                                | Inherit the advisory PR-head check implemented by existing 100-43; never make it required or duplicate its implementation in the client plan.                                       |
| [Jeremy's ready-for-review decision](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5635138859)                                          | September 11, 2026, 13:28 UTC; repository admin access verified                                                                                                                                                | A clean current-head review with no newer accepted feedback awaiting review marks a draft ready; supersedes blanket draft-until-merge wording, not human acceptance.                |
| [100-43: advisory Cadence check](https://linear.app/1000lines/issue/100-43)                                                                                  | Issue and direct blocker relation read through Linear; Active on September 11, not yet completed                                                                                                               | Separate shared-workflow implementation prerequisite for 100-39; consume its merged change and evidence through extraction/adoption.                                                |
| [Required repository baseline](https://github.com/1000lines/symphony-example/tree/3de96c9f739d732cc7efd498225b4444b547cc57)                                  | Workflow guidance, native review/ingress/handoff/wakeup workflows, config and runtime `WORKFLOW.md` read; also inspected selected `main` at `0487f8d17586e2c21492b0e78bf4fefdd3d51986`                         | Current native workflows are the starting point. Later accepted changes concern host credential installation/setup.                                                                 |
| [PR #29](https://github.com/1000lines/symphony-example/pull/29), [PR #24](https://github.com/1000lines/symphony-example/pull/24)                             | #29 merged; #24 closed, unmerged                                                                                                                                                                               | Internal inheritance workaround is not the client interface; obsolete controller work is not a dependency.                                                                          |
| Repository README, `.github/README.md`, `.github/workflows/AGENTS.md`, `.symphony.cfg.json`, package files, runtime workflow and existing config/review code | Selected `main` above                                                                                                                                                                                          | Preserve native authorization, feedback, CI and human acceptance; use existing tooling.                                                                                             |
| [Copier configuration](https://copier.readthedocs.io/en/latest/configuring/)                                                                                 | Official documentation read                                                                                                                                                                                    | Root `copier.yml`, `_subdirectory`, one template per published Git repository, answers with source/ref metadata.                                                                    |
| [GitHub reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)                                                    | Official secret/input and nested-call rules read                                                                                                                                                               | Named secrets pass at every call boundary; environment secrets do not originate in the workflow-source repository.                                                                  |

Observed gaps, not completed features: the current review callee requires a bot
PAT and Anthropic key, callers use `secrets: inherit`, privileged jobs assume
`main`/`cadence-controller`, and helpers are loaded from the checked-out repository.
Existing build/test/lint reusables assume the full Node tooling package. The
strict repository config reader accepts `linear.teamKey` but has no CI-mode field.
Keeping project identity out of repository config is now intentional. Codex source
files alone do not prove a live Codex review. The source's project-key question,
Docker-only prerequisite and the earlier design's onboarding-documentation-only
boundary are superseded by Jeremy's 13:11 decision. His 13:14 decision also
supersedes the source's public-fork signing-key restriction and OD1. The other
source requirements remain in force. The 13:28 decisions add the advisory check
and fresh-review readiness behavior in D9; their implementation belongs to 100-43,
not this design ticket.

## Locked requirements and decisions

“Locked” means supplied by the brief/source, or a concrete design default offered
for approval here. IDs give the planner stable references; they are not tickets.

### D1 — Minimal client assets and ownership

Inventory the actual generated tree against these roles before copying files.
Use the following paths as design defaults. Reuse equivalent existing target
files through reviewed edits; preserve unrelated content and explain any extra
generated file in the implementation PR.

| Client artifact                                 | Why it must be local / contents                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/cadence-review-ingress.yml`  | Native event triggers and a minimal secret-free ingress signal; retain the existing event/actor/ref approach.                                                            |
| `.github/workflows/symphony-client-review.yml`  | Thin default-branch `workflow_run` caller of the central review event workflow.                                                                                          |
| `.github/workflows/symphony-client-handoff.yml` | Thin caller of the central feedback-to-Linear workflow; same verified ingress source.                                                                                    |
| `.github/workflows/symphony-client-wakeups.yml` | Thin CI/check/conflict completion caller preserving the existing issue-scoped wakeup contract.                                                                           |
| `.github/workflows/symphony-client-ci.yml`      | Thin secret-free caller for target build/test commands when CI is needed; reuse existing application CI where it already covers D8. Avoid duplicate checks.              |
| `SYMPHONY.md`                                   | Short target worker guidance, referenced by config; preserve existing `AGENTS.md`/`CLAUDE.md`. Generic host skills stay installed on the host.                           |
| `.github/symphony/REVIEW.md`                    | Target review context used by either provider; central reviewer instructions/helpers stay central.                                                                       |
| `.symphony.cfg.json`                            | One target-owned runtime config, with Linear team, CI mode, commands and instruction paths; project identity comes from each issue. No credentials or central repo list. |
| `.github/symphony/cadence-app-manifest.json`    | Direct-path App registration manifest and minimum permissions; inert on the fork path.                                                                                   |
| `.copier-answers.yml`                           | Ordinary nonsecret answers plus `_src_path` and `_commit`.                                                                                                               |

`copier.yml`, usage/credential documentation, license and extraction provenance
belong to the template repository, outside the rendered subdirectory. Keep usage
instructions short and link them from target guidance. Do not emit host installers,
Terraform, AWS configuration, personal skills, application files, shared workflow
bodies or a Node package merely to make remote workflows run. Onboarding skills
live in the seed repository under D7, not in every rendered client. In Docker
mode the client supplies its own suitable Dockerfile; the generic template does
not invent an application build environment.

### D2 — Staging, publication and preservation

Make `templates/symphony-client/` a self-contained template root with `copier.yml`
and `_subdirectory: template`. During staging render from that local directory.
After extraction render from the published Git URL at an explicit reviewed ref.
This follows [Copier's template and answers conventions](https://copier.readthedocs.io/en/latest/configuring/).
No custom generation hooks or update mechanism are needed.

Copy the reviewed staging root to the extracted repository root, including dotfiles.
Record the source commit/path, resulting commit/ref, file mapping and any deliberate
exclusions; compare the trees with existing Git/diff tools. Carry the existing
Apache-2.0 license and applicable attribution/provenance with copied assets. Do
not replace an adopter's application license. A name-availability check is an
execution task; only a real collision needs Jeremy's alternate name.

Apply into a clean, isolated existing checkout and inspect collisions before
overwriting. Merge existing config/instruction content explicitly in the adoption
PR. Preserve application files and existing CI. Generated caller filenames above
are distinct from central reusable body filenames: self-adoption must not overwrite
the source workflows during staging. After workflow extraction under D3, adoption
uses the new public source. Eliminate duplicate native triggers when replacing old
callers; preserve the existing manual review path and unrelated seed workflows.

### D3 — Public reusable code and trusted execution

Develop workflow implementations and their helpers in `1000lines/symphony-example`
first, then extract the reusable client-facing workflows and required helpers to
public `1000lines/symphony-client-workflows` near project end. This follows
[Jeremy's September 11 decision](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5634828727)
and supersedes the earlier brief/seed instruction to retain their implementations
in `symphony-example` permanently. The name is a working default; verify availability
at publication. The template repository contains no workflow implementations.

The template contains literal reviewed full commit refs in generated `uses`
declarations; changing the workflow ref is a template release operation, not
another question. Central workflows declare `workflow_call` inputs/secrets.
Nested cross-repository calls obey the same explicit boundary.

Record the reviewed source commit, copied workflow/helper paths, exclusions,
license/attribution and resulting published ref with existing Git/diff tools.
Move only dependencies needed by the reusable entry points, including their
instructions/tests; keep host installers and seed-specific workflows in the seed.
Repoint helper checkouts and nested calls to the reviewed new source, publish a
template ref with those pins, then run final self-adoption and real review proof
against that pair of published refs. Earlier Codex proof in `symphony-example`
reduces risk but does not prove the extracted workflow path.
Carry the merged D9 advisory check and human-handoff behavior with its required
helpers, and verify both again through the final generated callers.

Keep the original workflow paths usable until current callers have migrated and
replacement runs pass. Remove duplicate bodies only after checking those consumers;
preserve published historical refs and any still-needed forwarding entry points.
Staging-folder deletion does not authorize deleting unrelated central tooling.
The tradeoff is one additional publication and ref migration; the benefit is a
dedicated reusable-workflow source independent of the example and template.

Retain native ingress → trusted default-branch review/handoff. Separate checkout
of pinned central tooling from the target's config/source context; a remote
workflow call does not fetch its helper files. Never execute PR-controlled code in
privileged routing/publication steps. Re-read PR head, original human author
permission, labels and current review history before privileged actions. Preserve
stale-head checks, loop limits, terminal-state protection and distinct author/App
reviewer identities. Use maintained Actions pinned to reviewed full SHAs.

Provide the smallest reusable command runner where the target needs CI; do not
point a generic client at the existing Node-tooling-only build/test workflows.
Reuse existing application CI and support the three host validation modes in D8.
Run target commands against the exact PR head without reviewer secrets. Target
default branch and repository identity must replace seed-specific assumptions throughout exercised
paths. An owner with private-repository or secret-dependent CI needs the direct
onboarding path and their existing CI configuration.

### D4 — Questions and configuration

Exactly seven nonsecret answers: `repo_slug`, `default_branch`, `linear_team_key`,
`symphony_app_slug`, `cadence_app_slug`, `build_command`, `test_command`.
`build_command` generalizes the earlier `docker_build_command` name so native and
remote targets do not imply Docker. The two slugs identify author and reviewer
Apps. No `linear_project_key`, provider toggle, model question, credential, App ID,
installation ID or workflow-source question. Onboarding supplies known answers
without another agentic interview.

Use existing `symphony-repository/v1` config and command arrays. Represent supplied
shell commands as `bash -lc` argument arrays, serialized correctly; config reading
does not execute them. Preserve the target's setup/lint/CI settings. Keep
`linear.teamKey` as the only Linear field: do not add `linear.projectKey` or a
repository-wide project filter. Each issue's Linear project supplies its project
metadata; multiple projects can target the same repository without regenerating
the client or overwriting a project binding. Project selection during planning
belongs to that operation's Linear context. No Linear UUIDs or App IDs belong in
this file.

Add only optional `ci.mode` (`native`, `docker`, `remote`) to the existing reader;
omission retains native-first behavior for existing configs. Onboarding records
the owner/operator's mode and concrete commands in the target config; it is an
execution setting, not an additional Copier question. D8 defines its semantics.
In Docker mode, existing setup/build/test arrays include the concrete image-build
and container commands using the client's Dockerfile. No separate Docker schema,
mode dispatcher or config validator is needed.

Verify every actual reader, including the installed generic host skill, accepts
the mode field before enabling a generated config. Updating that existing reader
through the normal reviewed bundle path is bounded compatibility work; do not redesign
host dispatch. App IDs/installation IDs are discovered and stored as named Actions
variables/inputs; expected human identities and CI check provenance are onboarding
configuration. Do not present guessed IDs or checks as observations.

### D5 — Explicit credentials

The target supplies its own named Actions secrets, independently of Copier.
Every generated call maps each accepted name from `${{ secrets.NAME }}` and every
callee declares it. There is no `secrets: inherit` on generated or onward
cross-repository calls. GitHub's [secret-passing rules](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows#passing-secrets-to-nested-workflows)
require forwarding at each hop. A protected-environment variation must demonstrate
explicit delivery in the caller context; PR #29's inheritance workaround is excluded.

| Workflow role                 | Supplied secret names                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Review                        | `CADENCE_APP_PRIVATE_KEY`, `CADENCE_LINEAR_API_TOKEN`, optional `CADENCE_OPENAI_API_KEY`, optional `CADENCE_AI_REVIEW_ANTHROPIC_API_KEY` |
| Feedback routing / handoff    | `CADENCE_APP_PRIVATE_KEY`, `CADENCE_LINEAR_API_TOKEN`; no provider key                                                                   |
| Non-review CI wakeup          | `CADENCE_LINEAR_API_TOKEN` only, using the existing automatic GitHub token for reads                                                     |
| CI / build / test and ingress | None of these secrets                                                                                                                    |

Review requires the App and Linear credentials and at least one provider key.
Mint a repository-scoped App token for publication and author permission checks;
both providers publish as that App. `CADENCE_BOT_GITHUB_TOKEN` is not an adopter
requirement. Declare the minimum `GITHUB_TOKEN` permissions needed per role.
Keep host coding-model, author and AWS credentials on the host. Never emit secrets
in answers, generated files, logs or provenance. Owners receive the exact secret
list, use separate provider keys per target, and own revocation after the event.

### D6 — Provider selection and verdict

| OpenAI key nonempty | Anthropic key nonempty | Required result                                                           |
| ------------------- | ---------------------- | ------------------------------------------------------------------------- |
| Yes                 | No                     | Codex                                                                     |
| No                  | Yes                    | Claude                                                                    |
| Yes                 | Yes                    | Codex                                                                     |
| No                  | No                     | Clear missing-key failure before provider execution or review publication |

Declare both keys optional at `workflow_call`; check presence before execution.
Run exactly one provider. API failure does not silently switch providers or produce
approval. Every MVP target is provisioned for Codex. To select the working Claude
fallback, omit the OpenAI mapping; no key deletion or rotation is required.

Use one small provider-neutral result containing `repository`, `prNumber`,
`headSha`, `verdict` (`approve`, `request_changes`, `escalate_to_replan`), `summary`
and actionable `findings`. Reuse existing finding IDs/classes and Cadence workpad
format rather than the dormant controller's acquisition/generation schema.
Existing publication/handoff code consumes this result after checking identity and
current head. Malformed, missing or stale output fails without approval.

Preserve current external review semantics: clean `approve` publishes `APPROVE`;
`request_changes` publishes `COMMENT` with actionable findings and wakes rework;
`escalate_to_replan` publishes `COMMENT` with the changed requirement/decision and
routes the existing human/replanning handoff. Neither branch submits GitHub
`REQUEST_CHANGES` or treats an AI verdict as human acceptance. Missing source/access
is an explicit human-needed finding, never an approval. Preserve the existing
review freshness checks and feedback ledger across both providers; D9 governs
the advisory check and ready-for-review handoff.

### D7 — Onboarding skills and public-fork credentials

Deliver onboarding as skills in `symphony-example` initially, following
[Jeremy's decision](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5634926972).
Use one small `.agents/skills/symphony-onboard/SKILL.md` entry point for
`onboard <repo-url>`, with fork/direct procedures in that skill or linked resources.
Reuse existing repository, GitHub/Linear and planning tools; add only a small
helper for an actual API gap. Do not build a new orchestration service or copy
operator skills into the client template. Later relocation of these skills is
not required by the workflow-repository extraction.

The skill supplies the seven answers, records the D8 mode/commands, discovers IDs,
enables Actions, sets explicit workflow permissions and required CI checks, and
provisions target secrets outside answers. It creates or selects the initial
Linear project and starts the existing planning/host flow using that operation's
context; it never binds the repository to that one project. A later project reuses
the same client. Repeated invocation inspects existing repositories, installations,
config and projects before creating anything; preserve existing settings and report
only unavailable operations with their owner/resumption event.
The D9 Cadence check is automatic shared behavior, excluded from required checks;
it adds no onboarding question or repository setting.

The project owns these skill artifacts and an owner-controlled onboarding
walkthrough; Jeremy/parent onboarding owns installation/invocation, participant
credentials, and the three-repo rehearsal. Forks need their own secrets and Actions
enablement; org-wide installation does not deliver a signing key. These are skill
actions, not Copier hooks or post-generation product questions.

Fork is the default parent-MVP path: fork into `1000lines`, grant the participant
admin, use the existing Cadence installation, and let that owner approve PRs.
Direct is for private repos or CI requiring secrets: the owner creates and installs
their own repo-scoped Cadence App using the manifest. The manifest needs metadata
and contents reads, PR review/feedback permissions, checks write for D9, and any
issues/Actions access exercised by the retained helpers; verify this with real
App operations.
It must not request organization administration or host credentials.

**Public MVP forks use the existing Cadence App; OD1 is removed.**
[Jeremy's 13:14 decision](https://github.com/1000lines/symphony-example/pull/30#issuecomment-5634958976)
accepts the existing App's scope and explicitly commissions no fork signing-key
fix, isolation work, credential service or separate App per public fork. This
supersedes the source restriction and the earlier OD1 onboarding gate. Normal
explicit named-secret provisioning under D5 remains necessary; installation alone
still does not supply workflow credentials. The onboarding owner provisions the
existing App key through that interface, outside Copier answers and generated files.

Permission review on September 11: the public GitHub App API for
`1000lines-cadence` (App `4866513`) reports contents/actions/metadata **read** and
pull_requests/issues/checks **write**. Jeremy's comment records installation
`160764288` across all repositories and confirms the organization has no private
repositories; the API listing returned the three public repos `symphony`, `.github`
and `symphony-example`. Installation ID/scope are human-supplied evidence here,
not a new installation operation by this ticket.

The accepted tradeoff is that a participant admin who can access supplied workflow
credentials can exercise this App's review/issue/check write authority across its
installation. It cannot write repository contents or workflows under the reviewed
permissions; it is not entirely read-only. Record actual App grants and explicit
secret delivery during onboarding, without adding another credential-design gate.
Private/direct adopters keep the separate owner-created App guidance above. This
decision authorizes the design revision, not merge or a claim of live onboarding.

### D8 — Native, Docker and remote validation

The selected mode controls validation on the Symphony server. All modes retain
mandatory GitHub CI on the published head and the target's required-check contract.

| Mode     | Server behavior                                                                                                                                                                                                                       | Client / operator responsibility                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `native` | Run build/test in the isolated workspace with the installed toolchain.                                                                                                                                                                | Host operator supplies the tools; client supplies normal commands. No container is required when these checks pass.                                                                                          |
| `docker` | Build the client's validation image and run build/test in that container.                                                                                                                                                             | Client supplies a Dockerfile and concrete setup/build/test commands; host supplies Docker. Mount only the issue workspace, preserve its UID/GID and remove task containers. Record image digest and results. |
| `remote` | Run useful checks with available tools, fix actionable failures, then push the prepared commit for GitHub CI. Missing host tooling is a recorded limitation, not a requirement to install a toolchain or create a Docker environment. | Client supplies working GitHub CI and observed required-check provenance; onboarding enables its existing completion/wakeup hooks. Remote CI must actually run and report the current head.                  |

Native and Docker tasks validate in their configured environment before pushing.
For native environment gaps, use an available client Docker setup as the existing
fallback; record unavailable tools or services precisely. Remote mode deliberately
allows publication after best-effort local validation and does not treat an unrun
check as passing. Known, actionable failures still need fixes in every mode.
Remote is a validation mode for the existing Symphony server, not a cloud worker
fallback or an alternative host.

After publishing, pending/missing CI uses `Unhappy` with `wake:15m`. The existing
GitHub status bridge wakes the linked nonterminal ticket to `Active` on a failed
current-head required check; the worker fixes it and publishes again. All required
checks passing moves it to `Inactive` for review. Preserve terminal-state guards,
issue/team resolution, stale-head rejection and the existing timer fallback.
The advisory `Cadence review` result is separate from this required-CI path; its
findings continue through the existing review-feedback handoff.
No second CI status controller is needed. A native/container pass never substitutes
for GitHub CI, and a missing/skipped/stale remote run never proves success.

### D9 — Advisory Cadence check and human handoff

[100-43](https://linear.app/1000lines/issue/100-43) owns this change in the existing
shared route/review workflow, using the configured Cadence App's existing
credentials and checks-write permission. It is already a hard prerequisite of
100-39. The detailed plan consumes its human-reviewed, merged implementation and
evidence; it does not commission a duplicate. Preserve the behavior for both
providers through workflow extraction, template publication and self-adoption.
No new controller, Copier answer, secret or repository opt-in is required.

Publish `Cadence review` on the actual PR head promptly after accepting an
eligible event, before the review queue wait. Show queued/in-progress (yellow),
then a useful result linked to the review/run: success for clean review,
`action_required` for findings, and failure, timeout or cancellation as appropriate
for incomplete execution. New heads and new accepted feedback on the same head
need fresh coverage. Duplicate delivery, overlapping runs and late results must
not overwrite newer pending work with stale success; failure/cancellation/closure
must not strand a running check. Use the existing publication path and native
[GitHub Checks API](https://docs.github.com/en/rest/checks/runs).

This check is **advisory only**. Exclude it from branch protection, repository
required-check configuration, `CI Required` and automatic merge gates. It reports
review status for human judgment and does not change D8's required CI handling.

A clean/approve verdict is the handoff to the human: mark a draft PR ready for
review only when the verdict covers its current head and no newer accepted
feedback is still awaiting review. Recheck that freshness before the transition;
unresolved findings stay draft and an already-ready PR needs no repeated change.
A successful check must accompany a visibly ready PR; a failed readiness
operation needs an explicit diagnostic and recovery, not a claim of completed
handoff. This is a small addition to the existing successful-review publication
path, following Jeremy's 13:28 decisions. It supersedes earlier instructions to
keep planning PRs draft until merge. Neither a ready PR nor a green advisory
check is human acceptance, merge permission or planning-seed maturity.

## Acceptance criteria and evidence

These are project acceptance targets, not results claimed by this design ticket.
The planner assigns implementation ownership and maps each ID to its artifact and
proof using existing tooling; it must preserve the stated boundaries.

| ID   | Observable acceptance                                                                                                                                                                                                                                    | Evidence / responsible role                                                                                                                                                                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1  | Generated tree contains only justified client assets and the seven answers; secrets and host/application code are absent.                                                                                                                                | Template implementer: file inventory, rendered diff and inspection of answers.                                                                                                                                                                                     |
| AC2  | Generation works for at least two repository slugs, two default branches (including one other than `main`) and differing commands/Linear teams; unrelated existing files survive.                                                                        | Template implementer: isolated render fixtures and collision/adoption diffs; correctly escaped GitHub expressions and serialized YAML/JSON.                                                                                                                        |
| AC3  | Central helpers execute from the reviewed source ref; thin callers use only named secrets and nonsecret inputs; CI and ingress receive no reviewer secrets.                                                                                              | Workflow implementer: existing workflow tests plus explicit-call inspection; retained trusted-ref/author/stale-head/terminal/loop cases.                                                                                                                           |
| AC4  | The four provider cases match D6; both providers publish the same current-head verdict contract as the configured App, without a bot PAT.                                                                                                                | Workflow implementer: proportional selection/output/publication tests, including malformed output and provider failure; retain Claude-only coverage.                                                                                                               |
| AC5  | A real PR receives a Codex Cadence review through generated callers pinned to the extracted workflow repository, with explicit target-secret delivery.                                                                                                   | Self-adoption owner: published template/workflow refs, run/attempt, target/head, App identity, provider execution, verdict, matching Cadence workpad and feedback/handoff evidence. Prioritize an early Friday run; repeat after migration for final proof.        |
| AC6  | Published template is usable from its public reviewed ref with reproducible staging-to-root mapping, license/provenance and minimal usage/credential docs.                                                                                               | Publication owner: repository/ref readback, tree comparison and actual render from that ref. Creation rights or name conflicts gate publication only.                                                                                                              |
| AC7  | Adoption PR renders from the published template pinned to the new workflow repository, preserves application files and working CI/review/manual paths, retains Copier metadata, and removes the staging folder after extraction succeeds.                | Adoption owner: small reviewed diff, exact template/workflow refs, required current-head CI and AC5 proof; obsolete bodies are removed only under D3's consumer checks. Jeremy owns merge.                                                                         |
| AC8  | Generated config has no project key; two Linear projects can use the same repo client. Existing target/host readers accept `ci.mode` and old configs without it retain native-first behavior.                                                            | Compatibility owner: existing-reader tests, two-project context/routing coverage, and installed-reader/version readback before activation. No parallel validator or host rebuild.                                                                                  |
| AC9  | Onboarding skill exists in symphony-example and covers fork/direct setup, repeat invocation and additional projects. Public MVP forks use the existing Cadence App and explicit secrets; private/direct guidance remains separate.                       | Onboarding skill owner/Jeremy: skill/resource paths, owner-controlled walkthrough and operation readbacks without secrets; record invocation/installed ref, actual App permissions and explicit secret delivery. No participant rehearsal claim from source alone. |
| AC10 | Required source reads, current-head CI and review evidence are recorded; every target's owner approves merges.                                                                                                                                           | Delivery owners: initially draft PRs with business purpose/qualifying progress diagram, labels `pink` and `symphony`, D8 validation evidence, and D9's fresh-review readiness transition; human acceptance remains separate.                                       |
| AC11 | Reusable workflows and their minimum dependencies are published in a separate public workflow repository; final template callers, nested calls and helper checkouts use reviewed refs there.                                                             | Workflow publication owner: source-to-destination mapping, license/provenance, repository/ref/access readback, relevant existing tests and real consumer runs. No second maintained implementation in the template; retain old entry points only as needed by D3.  |
| AC12 | Native and Docker modes run the supplied commands in their intended environments; remote mode reaches GitHub CI despite a missing local toolchain, and a failing current-head check wakes its ticket to Active. Passing CI returns it to review waiting. | Validation/wakeup owner: native command output, client Dockerfile/image digest/container results, and real remote failing-then-passing CI runs with exact heads and Linear state readbacks. Retain stale-head and terminal-state tests in the existing bridge.     |
| AC13 | Generated callers inherit D9: a real PR-head advisory check shows queued/running then a linked result; fresh clean review marks a draft ready. The check is never required, and human acceptance remains separate.                                       | 100-43: initial live proof and D9 freshness/overlap/failure/close/draft tests. Publication/adoption owners: merged ref, final caller check/review/readiness evidence, App/head identity and unchanged required-CI readback.                                        |

The Copier template inherits the [PR guidance](../engineering/symphony/pull-requests.md#show-the-accepted-plan):
include progress diagrams only with at least three meaningful nodes and two genuine
edges; omit them otherwise without inventing nodes or dependencies.

## Execution inputs and planning handoff

| Input or verification                                                                               | Owner                                                      | Only the dependent action                                                                  |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Both published repo names, creation/push rights and public workflow access                          | Publication owners; Jeremy for unavailable admin operation | Publication/access for the affected repository; keep independent staging work moving.      |
| Reviewed workflow/template refs and maintained Action versions                                      | Workflow/template implementers                             | Release/pinning and compatibility validation, not additional product questions.            |
| App IDs/slugs, installations/grants, variables and named secrets                                    | Onboarding owner and target owner                          | Live authentication/review; use observed values, never fixtures as deployment proof.       |
| Required CI check names, workflow/App provenance, Actions enablement and branch rules               | Target owner with delivery implementer                     | Exact-target acceptance/activation; seed's `CI Required` is not a universal adopter check. |
| Selected CI mode, client Dockerfile/commands, host reader version and bounded compatibility rollout | Client owner / Jeremy / host operator                      | Activation of `ci.mode` and the chosen validation environment; no wider host rebuild.      |
| Provider keys, rate limits for three simultaneous targets and event-time revocation                 | Jeremy and each key owner; parent-MVP coordination         | Live provider runs/concurrency readiness; no dependence on sponsor credits arriving.       |
| Merged 100-43 implementation and advisory-check/readiness evidence                                  | 100-43 implementer and Jeremy for review/merge             | 100-39 consumes merged behavior; independent design/source reads can continue.             |

Onboarding skill installation/invocation belongs to Jeremy; missing installation
evidence gates its live walkthrough only. Required mode behavior is fixed by D8;
actual toolchains, Dockerfiles and CI checks are target execution inputs.

No material product decision remains open. The planner carries the accepted
public-fork App decision without an OD1 blocker or new credential-isolation work.
Inventory/rendering does not depend on live credentials; final published-ref
adoption requires workflow publication
and a template release pinned to it. Staging removal requires successful template
extraction and reviewed adoption; obsolete workflow-body removal additionally
requires consumer migration under D3. These are artifact prerequisites, not a
ticket list or DAG.

[100-39](https://linear.app/1000lines/issue/100-39) owns the reviewed decomposition,
file/resource ownership and dependency graph; [100-40](https://linear.app/1000lines/issue/100-40)
owns fan-out. Both consume this merged document and the required sources. Use the
shared Symphony DAG tooling; do not add a schema or validator for this design.
100-39 also waits for the existing 100-43 prerequisite, records its merged ref and
evidence, and carries D9/AC13 into extraction/adoption ownership. 100-40 must not
create another advisory-check or ready-transition implementation ticket. Preserve
the verified 100-43 → 100-39 relation alongside 100-38 → 100-39 → 100-40.
Task branches and PRs use `main`; never commit unmerged predecessor work into a
task branch. Published-template and workflow PRs need their own repository access
and human review, not permission inferred from a seed-repository merge.

For this design ticket, validation is locked Prettier on this Markdown, diff
whitespace checking, and manual source/acceptance coverage review, followed by
mandatory repository CI at the published head. The selected-base config requires
`CI Required` from `.github/workflows/ci.yml`, GitHub Actions App `15368`, including
build, lint, test and Changed Markdown children. Skip Docker when local checks pass.
No render, App operation, provider review or deployment is claimed by writing this
document; those results belong to the later delivery artifacts.
