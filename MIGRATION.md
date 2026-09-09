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
- Rehearse ticket execution and dependency progression in a separate test project.
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
- Setup rehearsal ticket `100-5` is created; execution/review results are pending.

## Credentials still needed for the full loop

| Location | Name | Status |
| --- | --- | --- |
| AWS `symphony/keys` | `GITHUB_TOKEN` | Installed and verified as `1000-symphony-bot`; repository write access confirmed. |
| AWS `symphony/keys` | `LINEAR_API_TOKEN` | Populated for the 1000lines workspace. |
| AWS `symphony/keys` | `OPENAI_API_KEY` | Temporary Orchestra key; replace before Saturday. |
| GitHub Actions | `CADENCE_BOT_GITHUB_TOKEN` | Installed after verifying `1000-cadence-bot`; repository role is triage. |
| GitHub Actions | `CADENCE_LINEAR_API_TOKEN` | Populated and verified using the dedicated 1000lines Linear token. |
| GitHub Actions | `CADENCE_AI_REVIEW_ANTHROPIC_API_KEY` | Jeremy replaced the placeholder on September 9. Temporary Orchestra key; replace before Saturday. Actual review authentication is being tested. |

Repository variables now name `1000-symphony-bot` and `1000-cadence-bot`.
Cadence event parsing accepts the numeric `100-…` ticket identifiers.

Cadence's inherited Google secret requirement is removed too: review sources
will be Markdown. GitHub Actions are enabled for the setup rehearsal. The live dashboard is verified; the complete
implementation/review loop is not yet verified.

## Bot credential cutover — 2026-09-09

- Replaced only `GITHUB_TOKEN` in AWS `symphony/keys`; verified the other values were preserved.
- Installed Cadence’s separate token in GitHub Actions. Passwords stay in the separate operator-only AWS secret.
- The laptop GitHub CLI remains `jeremycarroll`; the humans team contains Jeremy and the ai team contains both bots.
- Restarted the host at 14:26 UTC and verified its GitHub API identity, bot commit email, healthy state API and successful Linear polling.
- Symphony PAT scopes: repo, workflow, read:org. Cadence PAT scopes: public_repo, read:org. Both expire September 16.
- Cadence model variable is `claude-opus-5`; Jeremy populated the provider credential, and full review execution still needs verification.

## Setup rehearsal — 2026-09-09

- Created project `setup-rehearsal` and ticket `100-5` for a two-file startup checklist documentation change.
- Moved the test from Backlog to Active; Symphony fetched it and ran Codex successfully with the temporary OpenAI key.
- The first attempt discovered missing `symphony` and project-color `teal` repository labels. Created those labels and returned the ticket to Active. This publishing prerequisite belongs in future project setup.
- Terraform now pins the verified bot bootstrap revision; apply changed only the existing instance tag.
- Symphony opened rehearsal PR #1 as the implementation bot. Cadence's event router succeeded; its review runner exposed a remaining extracted `example-org/example-repo` default. Set `REPO_SLUG` from the actual GitHub repository in the runner before retrying.
