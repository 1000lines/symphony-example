# 1000lines Symphony migration log

We are manually adapting the extracted example on `main` for
`https://symphony.1000lines.dev`. This log records top-level decisions and actual
deployment progress. Configuration changes are not proof of a working deployment.

## Decisions — 2026-09-09

| Change | Decision | Status |
| --- | --- | --- |
| No dashboard authentication | Remove Google OIDC; anyone can view the dashboard and its operational data. No replacement sign-in service. | Deployed and verified. |
| No public refresh | Public ingress accepts GET/HEAD only. `POST /api/v1/refresh` stays inaccessible through the public load balancer; automatic polling continues. The runtime endpoint itself is unchanged. | Deployed and verified. |
| Route 53 instead of GoDaddy | Use the existing `1000lines.dev` public hosted zone and an alias record to the load balancer. Remove the GoDaddy provider. | Deployed and verified. |
| Dedicated VPC | Add the missing VPC, two public ALB subnets, a private host subnet, and outbound NAT. Reuse the extracted host, disk, IAM and ALB module. | Deployed. |
| Personal AWS account | Deploy to account `350353785278`, region `us-west-2`, using operator `arn:aws:iam::350353785278:user/jeremy`. The host uses its own instance role. | CLI identity verified. |
| Work directly on main | Manually migrate this repository on `main`. Keep the original README content below the current status note and point readers to Orchestra-Bio's Symphony fork. | Committed and pushed to main. |
| Runtime credentials | Use AWS Secrets Manager `symphony/keys`, a JSON object of environment-variable names and values. Reuse the local Orchestra OpenAI API key temporarily; replace it with the event key before Saturday, 2026-09-12. | Secret populated and verified with GitHub, 1000lines Linear and the temporary OpenAI key. |
| Markdown plans | Keep plans and designs in repository Markdown. No Google service account or Google Docs integration for this deployment. | Deployed without Google credentials. |
| Choose the simplest working path | Get the planned tickets running. Defer all optional features, integrations and automation until after the hackathon. | Applies throughout setup. |
| Numeric Linear team | Accept the existing `100-…` ticket identifiers in branch, DAG and PR-label helpers. | Committed and pushed. |
| No daemon tickets (Linear only) | Drop daemon-ticket support from the hackathon Linear workflow. Do not configure Happy, Unhappy or Evaluating states; dispatch Active tickets only. Handle monitoring and follow-up manually on the day. Daemons are optional and deferred until after the hackathon. | Deployed; upstream runtime unchanged. |
| Two GitHub bot users | Use `1000-symphony-bot` for implementation and `1000-cadence-bot` for review. Replacing both with GitHub Apps is the first Symphony project. | Both bots joined the ai team. Symphony has write, Cadence triage. Distinct tokens installed and host restarted. |

## Deployment progress

- Checked out `1000lines/symphony-example` and `1000lines/symphony`.
- Verified GitHub operator `jeremycarroll` and personal AWS CLI profile `1000lines`.
- Verified the existing Route 53 hosted zone for `1000lines.dev`.
- Initially disabled GitHub Actions during migration; enabled review/event workflows after bot tokens and the Anthropic secret were populated. The optional AMI updater remains disabled.
- Populated and read back `symphony/keys`; key values are outside Terraform state.
- Configured Linear states Active, Inactive and Blocked; Backlog stays outside the execution queue.
- Created the private Terraform state bucket and DynamoDB lock table.
- Applied the network foundation, ACM certificate and DNS validation (18 resources).
- Terraform created the host, disk, IAM, ALB and DNS (19 resources). Instance:
  `i-00e9329be67c4bc0c`.
- HTTPS reaches the load balancer; public refresh returns HTTP 404.
- Restored the missing runtime-bundle manifest and verified installation on host.
- Fixed the noninteractive Erlang installer: cloud-init/SSM can leave HOME unset,
  which caused kerl to exit before compiling. All 14 installation steps completed.
- Symphony service is active with four worker slots and Linear team `100`.
- Verified dashboard and `/api/v1/state` HTTP 200, public refresh POST HTTP 404,
  successful Linear polling, and no active tickets.
- Verified the temporary Orchestra key can access `gpt-6-astra`.
- Verified bootstrap commit: `57175c8921245e7c76d410f83fe2d09dbdca7b21`.
  Runtime commit: `e4d3f6a05b0a00201c9d04d3ceca02b206e22de5`.

## Before Saturday

- [x] Populate the host's GitHub, 1000lines Linear, and initial OpenAI credentials.
- Replace the temporary Orchestra OpenAI API key with the event key and reload the host credentials before Saturday. Never put key values in this repository or log.
- [x] Provision and verify the host, HTTPS, public dashboard, and blocked public refresh.
- [x] Install distinct bot tokens and verify the restarted host authenticates as `1000-symphony-bot`. Both PATs expire September 16, 2026; replace with GitHub Apps.
- [x] Rehearse a single ticket through implementation, Cadence review and human handoff in a separate test project.
- Dependency progression and an application-code/CI rehearsal remain untested.
- Leave the hackathon DAG frontier in Backlog until the start; downstream work
  remains dependency-gated.

## Validation

- Terraform configuration validates.
- Tooling builds successfully; locked dependencies install with `npm ci`.
- Credential installation passes without any Google secret or credentials file.
- The full host test suite initially had seven failures on this Mac, including
  missing Linux `flock` and a Codex-version expectation. The real Linux host
  subsequently completed installation; this does not claim the full suite passes.
- Focused bootstrap, numeric-ticket branch, credentials and BEAM installer tests pass.
- Setup rehearsal `100-5` produced PR #1 as Symphony, received Cadence approval, and automatically requested Jeremy’s review.

## Credential inventory

| Location | Name | Status |
| --- | --- | --- |
| AWS `symphony/keys` | `GITHUB_TOKEN` | Installed and verified as `1000-symphony-bot`; repository write access confirmed. |
| AWS `symphony/keys` | `LINEAR_API_TOKEN` | Populated for the 1000lines workspace. |
| AWS `symphony/keys` | `OPENAI_API_KEY` | Temporary Orchestra key; replace before Saturday. |
| GitHub Actions | `CADENCE_BOT_GITHUB_TOKEN` | Installed after verifying `1000-cadence-bot`; repository role is triage. |
| GitHub Actions | `CADENCE_LINEAR_API_TOKEN` | Populated and verified using the dedicated 1000lines Linear token. |
| GitHub Actions | `CADENCE_AI_REVIEW_ANTHROPIC_API_KEY` | Jeremy replaced the placeholder on September 9. Temporary Orchestra key; replace before Saturday. Actual Cadence review passed. |

Repository variables now name `1000-symphony-bot` and `1000-cadence-bot`.
Cadence event parsing accepts the numeric `100-…` ticket identifiers.

Cadence's inherited Google secret requirement is removed too: review sources
will be Markdown. GitHub Actions are enabled for the setup rehearsal. The live dashboard and one documentation ticket through implementation, Cadence approval, Linear reporting and human review handoff are verified. Dependency progression, rework and application CI remain untested.

## Bot credential cutover — 2026-09-09

- Replaced only `GITHUB_TOKEN` in AWS `symphony/keys`; verified the other values were preserved.
- Installed Cadence’s separate token in GitHub Actions. Passwords stay in the separate operator-only AWS secret.
- The laptop GitHub CLI remains `jeremycarroll`; the humans team contains Jeremy and the ai team contains both bots.
- Restarted the host at 14:26 UTC and verified its GitHub API identity, bot commit email, healthy state API and successful Linear polling.
- Symphony PAT scopes: repo, workflow, read:org. Cadence PAT scopes: public_repo, read:org. Both expire September 16.
- Cadence model variable is `claude-opus-5`; Jeremy populated the provider credential; Cadence completed a real review successfully.

## Setup rehearsal — 2026-09-09

- Created project `setup-rehearsal` and ticket `100-5` for a two-file startup checklist documentation change.
- Moved the test from Backlog to Active; Symphony fetched it and ran Codex successfully with the temporary OpenAI key.
- The first attempt discovered missing `symphony` and project-color `teal` repository labels. Created those labels and returned the ticket to Active. This publishing prerequisite belongs in future project setup.
- Terraform now pins the verified bot bootstrap revision; apply changed only the existing instance tag.
- Symphony opened rehearsal PR #1 as the implementation bot. Cadence's event router succeeded; its review runner exposed a remaining extracted `example-org/example-repo` default. Set `REPO_SLUG` from the actual GitHub repository in the runner before retrying.
- Updated the review runner's remaining letter-only ticket extraction to accept numeric `100-…` identifiers for Linear workpad reporting.

## Rehearsal outcome — 2026-09-09

- [100-5](https://linear.app/1000lines/issue/100-5/setup-rehearsal-add-the-hackathon-startup-checklist) went from Backlog to Active; Symphony implemented a documentation-only change and opened [PR #1](https://github.com/1000lines/symphony-example/pull/1) as `1000-symphony-bot`.
- Cadence authenticated with Jeremy’s replacement Anthropic secret and its separate triage-role token, then [approved the PR](https://github.com/1000lines/symphony-example/pull/1#pullrequestreview-5155919718) at head `a6fa5f15478fbb6ac74f521704d7514f06a96706`. [Review run 34364728665](https://github.com/1000lines/symphony-example/actions/runs/34364728665) passed.
- Cadence wrote its completed APPROVE assessment to the Linear workpad. The review handoff workflow passed and automatically requested `jeremycarroll`. Ticket remains Inactive; PR remains draft and unmerged for human acceptance.
- Three setup gaps were repaired during rehearsal: missing project labels, the review helper’s extracted repository default, and numeric ticket extraction in workflow reporting. The original failed review run is retained as history.
- This proves the basic documentation-ticket loop, not application CI, dependency promotion, rework, merge or deployment. Non-review Linear wakeups and the optional AMI updater remain disabled.
- Borrowed OpenAI and Anthropic credentials must still be replaced with event credentials before September 12. Bot PATs expire September 16.

## Misc project — 2026-09-09

- Created [Misc](https://linear.app/1000lines/project/misc-446ce745736f) for manually filed standalone tasks, with `project-code: misc`, `project-color: blue`, `base-branch: main`, and human lead Jeremy Carroll.
- Created the `blue` label in Linear team `100` and GitHub repository `1000lines/symphony-example`; the required GitHub `symphony` label already exists.
- File tickets directly into Misc in Backlog, then move ready work to Active. No tickets were created or activated during this setup.
- Automatic routing of projectless tickets remains deferred. The hosted `before_run` hook is still `true`; the retained routing helper still has its extracted `DEMO-*` restriction. No server changes or restart were needed.

## Readiness project commissioned — 2026-09-09

- Created [Symphony hackathon readiness](https://linear.app/1000lines/project/symphony-hackathon-readiness-178a07b73fe2), `project-code: hackathon-ready`, color pink, base `main`, human lead Jeremy Carroll. The project-color helper selected pink from verified Linear metadata; matching labels exist in Linear and both 1000lines repositories.
- The [committed brief](docs/symphony-plans/hackathon-ready-brief.md) preserves the requested scope: Codex instead of Anthropic for Cadence, GitHub App installation identities instead of bot-user PATs, and repository CI evidence for every change with a working wait/resume path.
- Created only the three planning seeds: [100-6 requirements/design](https://linear.app/1000lines/issue/100-6/create-requirements-and-design-doc) in Backlog, [100-7 DAG planning](https://linear.app/1000lines/issue/100-7/plan-project-seed-ticket) in Blocked, and [100-8 fan-out](https://linear.app/1000lines/issue/100-8/trigger-fan-out) in Blocked. Explicit relations are `100-6 blocks 100-7` and `100-7 blocks 100-8`; all are assigned to Jeremy.
- Jeremy has brought daemon support back into the planned project scope. Prefer existing `Happy` / `Unhappy` / `Evaluating` with `wake:15m`. The runtime hard-codes `15m`, `1h`, `4h`, and `1d` in `daemon_wake.ex` and validates them in `config/schema.ex`; five-minute and ordinary-ticket timer extensions remain optional.
- This is project setup, not deployment of those changes. The live host still uses the verified current bot/Anthropic flow, dispatches Active only, and has no daemon states enabled. Automatic Misc routing remains deferred.
- Jeremy will contact the organizers about starter-kit keys. Initial Codex review may reuse Symphony's current OpenAI key; the project must document and verify event-key rotation when it arrives.
- Incorporated the human merge of rehearsal PR #1 before publishing the brief. This supersedes the earlier rehearsal snapshot saying that PR was unmerged.
- Jeremy subsequently requested activation: moved `100-6` to Active after verifying both seed blocker relations; `100-7` and `100-8` remain Blocked.
- Updated this repository's `.agents/skills/symphony-project-factory/SKILL.md` and its three seed templates: stage seeds outside dispatch, verify blocker relations, then activate the ready planning frontier by default. Explicit holds or future start times override that default.

## Material planning questions — 2026-09-09

- [100-9](https://linear.app/1000lines/issue/100-9/ask-planning-questions-only-when-the-answer-changes-the-plan): updated the project factory, project description and three seed templates, and hosted runtime instruction source to ask only questions whose answers materially change the plan or an authorized next action. State reasonable assumptions and continue independent work.
- App inventory, generated IDs, observed CI check names, and compatibility tests are execution/verification tasks. The event key remains an external input for rotation; it does not block initial implementation. Unknown observed values and evidence must still be verified rather than invented.
- This changes repository guidance on main. Existing ticket descriptions and the design in draft PR #2 are not rewritten by changing templates. Hosted personal instructions take effect when the updated runtime bundle is installed; no host restart or deployment was performed for this documentation change.

## Docker toolchains on the host — 2026-09-09

- Installed Amazon Linux Docker Engine `25.0.16` using the existing package step and new `35-docker` installer step. Images and container data live on the 400 GB workspace volume at `/var/lib/symphony/docker`; a systemd mount dependency preserves startup ordering.
- The local Docker socket is `root:symphony`, mode `0660`. Amazon Linux uses systemd socket activation, so both `daemon.json` and a `docker.socket` override select the runtime group. The existing socket ownership is reconciled without restarting workers or containers. Docker access gives the trusted worker account host-level control; no Docker TCP endpoint was added.
- Deployed installer commit `3069a70dc1c85b4c0de511542ba5629d75049dac` through the selected source/package/Docker/bundle/config/provenance steps. Terraform applied only the EC2 installer-ref tag update (0 added, 1 changed, 0 destroyed); the committed default and local tfvars pin match. Runtime engine revision remains `e4d3f6a05b0a00201c9d04d3ceca02b206e22de5`.
- Refreshed hosted instructions to explain container toolchains and retain repository CI requirements. This deployment also installs the earlier material-question guidance. Symphony stayed active with PID `53789` throughout; no restart was needed. The public state API remained healthy afterward.
- Live proof: SSM command `941c5125-01e0-4f2e-9b0b-780b916d68d3` compiled a small Rust crate and passed `cargo test --offline` (1 test) as `symphony`, under matching systemd filesystem/no-new-privileges restrictions. Bind-mounted output ownership was verified as `symphony`, and the test container was removed. Fixture retained at `/var/lib/symphony/code/docker-smoke.oIWoRm`.
- Tested image: `rust:1.90.0-slim`, resolved digest `rust@sha256:7fa728f3678acf5980d5db70960cf8491aff9411976789086676bdf0c19db39e`. This proves compiler/container/mount access, not application correctness or repository CI.
- Validation: Docker configuration/rerun/conflicting-data-root tests, installer ordering and package selection checks passed (3 focused tests); shell syntax and whitespace checks passed. The broader macOS host suite had 8 existing failures, reproduced against the pre-Docker revision: missing Linux `flock`, a Codex version expectation, and older hook/workflow expectations. These do not represent a passing full suite.
