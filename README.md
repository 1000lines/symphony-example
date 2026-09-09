# Symphony tooling

Symphony connects issue tracking, coding workers and pull request review. This
source snapshot contains its Node tooling, workflow profiles, review automation,
host installer and runtime bundle, plus Terraform for a Symphony host. The
executable Symphony runtime is a separate dependency; product application code
and product infrastructure are not included.

These notes describe the supplied source, the values an adopter must provide,
and known setup gaps. They are preparation guidance, not a tested installation
procedure. **nothing in this extraction has been verified by execution; no
extraction round trip was performed.**

## Hidden files

Disable GitHub Actions before your first push (Settings → Actions → General →
Actions permissions → Disable actions) and leave it off until setup is
complete. The leading-dot paths here are working configuration, not samples.

`.agents`, `.claude`, `.codex` and the lint, format and Node config files are
inert until you run the corresponding tool. `.npmrc` refuses packages published
in the last seven days, which looks like an install failure.

`.github/workflows` is armed by existence instead: GitHub reads it from the
default branch and starts the two cron workflows, one twice hourly, as soon as
they land. They also do not fail closed — unset variables fall back to
placeholders like `example-cadence-bot`, so runs act as accounts you do not
have. Work through [repository variables](#repository-variables),
[repository secrets](#repository-secrets) and
[manual setup steps](#manual-setup-steps) before enabling Actions.

Finder, "Download ZIP" and `cp` without dotglob skip hidden files silently. If
you copy parts of this repo rather than forking it, check they arrived.

## Start with the tooling package

Paths below are relative to the directory containing this README and
`package.json`. Keep the complete tooling package together when arranging it in
your repository. Its `tools/symphony-dag` and `tools/symphony-host` workspaces,
`scripts`, workflow helpers and root configuration files depend on that layout.
The TypeScript configuration describes these tools; your product can use its own
language and build system.

Use Node `20.20.0` from `.nvmrc` and select npm `11.13.0` from `package.json`:

```sh
npm install --global npm@11.13.0
```

The dependency lock to supply is **one `package-lock.json` at the tooling root**,
alongside `package.json`; it covers both tooling workspaces. No resolved lockfile
is supplied in this snapshot. During later setup, from that root, generate the
lock from the tooling manifests and then install from it:

```sh
npm install --package-lock-only
npm ci
```

The first command resolves dependency versions and writes the lock without
installing `node_modules`; the second installs that locked dependency tree.
Review and commit `package-lock.json` in your repository before enabling the
CI caller below. Keep it beside the tooling manifest even when the tooling is
nested, rather than using your product's lock or separate workspace locks.
On subsequent checkouts use `npm ci`; regenerate and review the lock when
intentionally changing dependencies. `npm ci` fails if the manifests and lock
disagree instead of updating the lock. `.npmrc` enables lockfile generation,
engine checks and a minimum release age. The initial resolution and these setup
commands remain unverified; dependency compatibility may need later correction.

The separate validation targets are `npm run build`, `npm test` and
`npm run lint`. Build compiles the two tooling workspaces and checks TypeScript
helpers; test selects the tooling unit suites; lint checks tooling JavaScript
and TypeScript with ESLint. These targets neither build the external runtime nor
validate the adopter's product. Host installer, infrastructure helper and runtime
bundle suites are separate opt-in commands. See [tooling setup](docs/engineering/symphony/tooling-setup.md)
for their exact selection, guardrails, formatting and configuration scope.

## Choose the runtime and workflow profile

The Node host CLI manages a host; it is not the worker orchestrator executable.
The host installer expects a separately accessible runtime repository and
revision. No runtime source, binary or known compatible runtime revision is
bundled. Select that dependency and check its workflow schema, maturity behavior
and service command-line interface before planning to run workers.

There are two workflow profiles with different consumers:

- [WORKFLOW.md](WORKFLOW.md) is the repository profile template. Make an
  adopter-owned Markdown profile with YAML frontmatter and supply it to your
  selected runtime. Configure the clone URL and branch, `tracker.team_key`,
  state lists, `workspace.root`, setup hooks, worker command and server settings.
  The template selects `main` and has no product installation command; put your
  setup in your profile's `hooks.after_create`.
- The [hosted profile](scripts/symphony/runtime-bundle/workflow/WORKFLOW.md)
  is the host installer's default. Select an operator-owned profile through
  `SYMPHONY_WORKFLOW_SOURCE`. Its frontmatter must start with `---` on line 1.
  Within it, the renderer needs exactly one `max_concurrent_agents` line with
  exactly two leading spaces and a digits-only value (no trailing comment), and
  one `command: codex` line with exactly two leading spaces, to substitute worker
  slots and the bundle wrapper. Its npm setup and ticket-routing hooks are
  examples to assess in your profile, not requirements on your product.

For the host path, supply the tooling and runtime repositories as GitHub
`owner/repository` names and select full immutable commit IDs. The existing
bootstrap/runtime ref inputs take precedence over their EC2 tags; neither has a
fallback. The installer accepts other Git refs, so immutability is the
operator's responsibility. The runtime build expects `mix.exs` at the repository
root or in `elixir/`, and a `mix escript.build` output. An existing executable
selected through `SYMPHONY_RUNTIME_BIN_SOURCE` bypasses the build only; the
runtime checkout and ref are still required. The [runtime bundle guide](scripts/symphony/runtime-bundle/README.md)
describes the repository/ref inputs, build paths and toolchain defaults.

## Supply repository identity and service access

Use the [setup reference](#setup-reference) for each value's purpose, format,
setting location and requiredness. Requiredness is conditional on the capability
you enable. Synthetic identities, URLs and token-shaped fixtures are examples;
leave test data synthetic and put live values in your own configuration or
credential store. Some reference names describe a placeholder representation,
not an environment variable to create. Multiple entries can describe the same
underlying account or secret in different locations.

Configure nonsecret workflow identities in GitHub repository **Settings →
Secrets and variables → Actions → Variables**, and credentials in the **Secrets**
tab. The reference separates these from configuration-file values and manual
steps. An Actions variable reaches a process only where the workflow wires it
in; export the corresponding inputs separately for standalone helpers or the
host. Actions settings do not populate a local shell, Terraform or host secret
store automatically.

Choose the coding and review bot accounts, their commit identities, repository
owner and human lead. Grant the accounts the repository and issue access used by
their workflows. Supply your Linear team and workspace in live profiles, links
and project metadata. The [project schema](docs/symphony-plans/fan-out-plan-schema.md)
defines project code, color, human lead and base branch. Task branches and PRs
use that base; the parser rejects `project.integration_branch`,
`defaults.frontier_blocked_label` and the old integration-branch policy field.
No integration queue or merge-build contract is supplied.
Set `project-color` in the owning Linear project's content or description and
create that repository label plus `symphony`. Label repair does not infer the
color from issue text or branch names. Review and non-review wakeup helpers
select `Active`, falling back to legacy `Rework` only when `Active` is absent;
they preserve terminal issues and fail if neither safe state exists. Configure
those states in the Linear team. A runtime profile's state list does not remap
the helpers, and wakeups do not bypass issue dependencies.

The hosted `hooks.after_run` invokes optional PR label repair with an explicit
`--issue TEAM-123` and `--repo owner/repository`. Configure the repository in
your operator-owned workflow selected by `SYMPHONY_WORKFLOW_SOURCE`; the hook
uses the issue workspace's basename as its issue identifier. Its process needs
Linear read access through `LINEAR_API_TOKEN` (fallback `LINEAR_API_KEY`) and
GitHub PR/label read/write access through `GH_TOKEN` (fallback `GITHUB_TOKEN`).
All are secret token strings with no default. The hook adds only missing
`symphony`/project-color labels after checking a unique open PR and label
existence, then reads them back. Failures are logged and ignored by the runtime's
best-effort hook contract; publishing still needs explicit label verification.
See the [bundle guide](scripts/symphony/runtime-bundle/README.md#pr-label-repair).

Optional [non-review wakeups](docs/engineering/symphony/tooling-setup.md#pr-labels-and-non-review-wakeups)
consume failed required checks, conflicts and dispatched-workflow completions.
The workflow uses the automatic GitHub token and Actions secret
`CADENCE_LINEAR_API_TOKEN`; it needs trusted code on the default branch, event
permissions and matching issue recognizers. A dispatch completion on a
`symphony/` branch can use an anchored `[linear:DEMO-123] ` run-name marker for
explicit ownership. It does not dispatch a workflow or supply product pipelines.
The exact Linear viewer-name guard still needs the documented adopter setup;
`LINEAR_WAKEUP_BOT_NAME` is a reference name, not an environment override.

Optional Cadence automation needs GitHub, Linear, Google Docs and Claude Code
access. Its credential entries are separate from ordinary tooling CI, which
needs none of those supplied secrets. `CADENCE_CLAUDE_MODEL` is required for
Cadence with no default; the retained preflight accepts only `claude-opus-5` and
has no adopter override for that allowlist. A different model needs an
adopter-owned review workflow and validation policy. Actor-team lookup also
needs team-read access, or an adopter-owned caller supplying explicit actor
membership. See [review automation](docs/engineering/review/cadence-ai-review.md).

For source-document reads, provision a Google service account, keep its full key
JSON private, and share each required document or folder with its email as
Viewer. `GOOGLE_APPLICATION_CREDENTIALS` points to that JSON file for the included
reader. The host/local secret locators and the Actions JSON secret are distinct
delivery settings for this access. Supply readable current requirements in your
issues and plans; historical source documents and fixture IDs are not live
dependencies. The project-factory skill is for human sessions and remains
excluded from default unattended installation.

## Keep local settings in adopter-owned files

Use the existing setting locations for each consumer:

| Consumer                                       | Adopter-owned setting location                                                           | Retained behavior to account for                                                                                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository worker                              | Markdown workflow profile passed to the external runtime                                 | Clone, workspace, tracker and product setup belong in that profile.                                                                                                                 |
| Local helpers                                  | Trusted environment loader and explicit CLI options                                      | The supplied `setup-local-env.sh` recipe overwrites its AWS profile, region, secret locators and temporary directory settings. Inherited overrides do not change those assignments. |
| Host installation                              | Exported installer environment, optionally sourced from an operator-owned nonsecret file | The installer does not automatically load an environment file. Give later reconciliation the same settings through service configuration such as a systemd drop-in.                 |
| Worker instructions and personal configuration | Complete operator-owned bundle selected with `SYMPHONY_RUNTIME_BUNDLE_SOURCE_DIR`        | The config template is copied verbatim; refresh replaces installed config and skill links. Installed-file edits do not persist.                                                     |
| Host extensions                                | Executable Bash hooks in an operator-owned `SYMPHONY_HOOKS_DIR`                          | Hooks run in lexical order and failures fail installation. No hooks are shipped by default.                                                                                         |
| Infrastructure                                 | Private variable and backend files outside the checkout                                  | Terraform `-var-file` and `-backend-config` select different inputs. Neither is an Actions variable source.                                                                         |

For example, an operator may own `/etc/symphony/installer.env` for nonsecret
installer settings and `/secure/symphony.tfvars` for infrastructure inputs.
These are illustrative paths, not files the snapshot creates or loads by
default. Credentials belong in the private stores described in the reference.
The runtime credential bundle, Google service-account JSON and Google OIDC client
JSON have different consumers; follow their individual payload shapes and locations.

The host environment defaults live in `scripts/symphony/host/lib.sh` and its
install steps. Installation assumes root on Linux/systemd and compatible
filesystem/build utilities. Bootstrap needs curl and jq, installs Git through
dnf if necessary, and needs AWS CLI for its normal secret lookup. Review the
workspace volume helper before allowing it to initialize a device. Changing a
root path alone does not relocate all service and reconciliation paths.
`runtime.env` configures the runtime service and is not persistent storage for
every installer input. The bundle guide details these boundaries and the version,
account, directory, port and worker-slot defaults.

## Connect tooling CI from your own workflow

The three [build](.github/workflows/symphony-build.yml),
[test](.github/workflows/symphony-test.yml) and
[lint](.github/workflows/symphony-lint.yml) workflows expose `workflow_call`.
They have no automatic push trigger. Create an adopter-owned caller such as
`.github/workflows/ci.yml`; when the tooling occupies the repository root, its
wiring can be:

```yaml
name: Tooling checks

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  symphony-build:
    uses: ./.github/workflows/symphony-build.yml
  symphony-test:
    uses: ./.github/workflows/symphony-test.yml
  symphony-lint:
    uses: ./.github/workflows/symphony-lint.yml
```

Each job checks out the **caller repository**, installs the tooling dependencies
and runs its fixed target on Ubuntu 24.04. The optional string input
`tooling-directory` defaults to `.`. If the tooling package is nested, pass a
repository-relative path such as `tooling/symphony` in each job's `with` mapping;
the reusable workflows still need to be available at GitHub's workflow paths.
A remote reusable-workflow reference does not fetch a separate tooling checkout.
The selected directory must contain the complete tooling package, not your
product package.

No named secrets or outputs are declared. The automatic checkout token needs
`contents: read`; there is no need to inherit service credentials. npm caching
explicitly hashes the three package manifests; it does not use automatic lockfile
discovery or pin resolved dependencies. The reusable jobs run `npm install`, which
uses your committed tooling-root lock when it satisfies the manifests but can
update it when they disagree. They do not enforce the frozen-lock behavior of
`npm ci`, and have no install-command override. If you require that enforcement,
use an adopter-owned job with `npm ci` followed by the tooling validation targets;
if enabling npm caching in that job, set `cache-dependency-path` to the committed
tooling-root `package-lock.json`. Strict locking in the supplied reusable jobs
remains a later setup gap.

Add product validation and optional host/runtime suites as separate jobs in your caller,
with your chosen commands and prerequisites. Use `needs` only where a product
job should wait for a tooling result. Keep triggers and extensions in that
caller so the reusable workflows can receive upstream updates.

## Account for the remaining setup gaps

The [infrastructure guide](infra/static/README.md) describes the host-only
Terraform and its existing inputs. Supply an existing VPC, private subnet list,
public ALB subnet list and regional TLS certificate through the four required
network/TLS inputs. The first private subnet selects the host and disk zone;
public ALB subnets need at least two availability zones. Also supply the DNS
domain and the retained deployment-stage argument, even though the module does
not use that argument. The region default remains in `infra/static/variables.tf`.
A private backend file selects accessible S3 state storage separately; the state
key and region can retain their documented defaults.

These gaps need resolution during later operational setup:

- The host image in `infra/static/modules/symphony-host/instance.tf` is an
  intentionally nonexistent placeholder. Image selection, fixed sizing, disk
  sizes, worker count and bootstrap/runtime refs need assessment for the host.
- The OIDC secret container is created and its current version read in the same
  Terraform root. An empty container has no version to read. Population and
  state/import ordering remain unresolved; state may contain OIDC credentials.
- DNS and the Google hosted-domain hint are separate settings; the `hd`
  placeholder in `infra/static/modules/symphony-host/main.tf` is not an access policy. Network
  egress, ALB routing, certificate coverage, DNS/provider credentials and service
  access also require setup. The individual manual entries locate replacements
  that have no automatic override; they do not imply a general configuration API.
- Bootstrap repository and secret locators in the Terraform user-data file,
  the installer settings and the host IAM allowlist must agree.
- The runtime dependency, profile compatibility and persistent host environment
  described above remain unverified. GitHub endpoint overrides do not establish
  enterprise-host support throughout the supplied scripts.
- The former DAG integration queue and its workflow/helper inputs are retired.
  Misc routing retains a fixed example team predicate that its `lookup` option
  does not replace. Use an adopter-owned routing policy before enabling that
  hook. Non-review wakeups retain schedule, runner, event and credential-owner
  assumptions described in tooling setup. Guardrail scope and actor
  classification have their own narrow overrides.
- Retained tests may need correction before they pass. In particular,
  host label-repair and review/wakeup tests import `js-yaml` without a direct
  dependency declaration. The Node install step and its regression source now
  agree on Codex `0.153.4` and a release-age bypass limited to the Codex install;
  `host/lib.sh:runtime_codex_version` reports the installed binary first but
  falls back to `SYMPHONY_CODEX_VERSION` or `0.147.0` if it cannot. That reporting
  divergence remains later setup work. The hosted command retains
  `gpt-6-astra` with `xhigh` reasoning. Root `npm test` does not select the host
  installer or runtime bundle suites; TypeScript checking omits `.mjs` helpers;
  root `npm run lint` does not enforce formatting or the optional complexity
  policy. Declaring these commands is not evidence of their successful execution.

## Setup reference

The generated reference belongs below. Once populated, it will provide setting names,
purposes, shapes, requiredness and defaults in this order: repository variables,
repository secrets, configuration file values and manual setup steps. If this
region is empty, the individual-value reference is not yet available and this
README alone is not a complete value-supply guide.

<!-- BEGIN GENERATED -->

| Name | Setting mechanism |
| --- | --- |
| Agent guardrails | Configuration file values |
| ARCHIVED_REVIEW_REFERENCE | Manual setup steps |
| AWS_ACCESS_KEY_ID | Repository secrets |
| AWS_ACCOUNT_ID | Repository variables |
| AWS_PROFILE_ARGUMENT | Manual setup steps |
| AWS_PROFILE_HELP | Manual setup steps |
| AWS_PROFILE_LOGIN | Manual setup steps |
| AWS_PROFILE_QUOTED | Manual setup steps |
| AWS_SECRET_ACCESS_KEY | Repository secrets |
| BOOTSTRAP_SOURCE_SYMBOL | Manual setup steps |
| CADENCE_AI_REVIEW_ANTHROPIC_API_KEY | Repository secrets |
| CADENCE_BOT_EMAIL | Manual setup steps |
| CADENCE_BOT_GITHUB_TOKEN | Repository secrets |
| CADENCE_GIT_EMAIL | Repository variables |
| CADENCE_LINEAR_API_TOKEN | Repository secrets |
| CADENCE_REVIEWER | Repository variables |
| DAG project settings | Manual setup steps |
| DAG_PLANNING_KEY | Manual setup steps |
| GITHUB_TOKEN_FIXTURE | Manual setup steps |
| Google OIDC client secret | Manual setup steps |
| GOOGLE_DOC_ID_EXAMPLE | Manual setup steps |
| GOOGLE_PROJECT_ID_EXAMPLE | Manual setup steps |
| GOOGLE_SA_KEY | Repository secrets |
| Host hooks | Configuration file values |
| Host layout | Configuration file values |
| Host management settings | Manual setup steps |
| Host toolchain | Configuration file values |
| HUMAN_DISPLAY_NAME_EXAMPLE | Manual setup steps |
| HUMAN_LOGIN_CASE_FIXTURE | Manual setup steps |
| HUMAN_LOGIN_EXAMPLE | Manual setup steps |
| HUMAN_REVIEWER_EXAMPLE | Manual setup steps |
| LINEAR_AWS_SECRET_ID | Manual setup steps |
| LINEAR_OTHER_TEAM_EXAMPLE | Manual setup steps |
| LINEAR_STATE_TEAM | Manual setup steps |
| LINEAR_TEAM_KEY | Manual setup steps |
| LINEAR_TEAM_LITERAL | Manual setup steps |
| LINEAR_TEAM_MARKDOWN | Manual setup steps |
| LINEAR_TEAM_METADATA | Manual setup steps |
| LINEAR_TEAM_NEGATIVE_FIXTURE | Manual setup steps |
| LINEAR_TEAM_PROSE | Manual setup steps |
| LINEAR_TEAM_SLUG_EXAMPLE | Manual setup steps |
| LINEAR_TEAM_WORKFLOW | Manual setup steps |
| LINEAR_TOKEN_FIXTURE | Manual setup steps |
| LINEAR_WAKEUP_BOT_NAME | Manual setup steps |
| LINEAR_WORKSPACE | Manual setup steps |
| Local environment loader | Manual setup steps |
| LOCAL_GITHUB_TOKEN_FIXTURE | Manual setup steps |
| Misc project routing | Manual setup steps |
| Non-review wakeups | Manual setup steps |
| ORGANIZATION_DISPLAY_NAME | Manual setup steps |
| PR label repair | Manual setup steps |
| PROJECT_COLOR_NAME | Manual setup steps |
| PROJECT_COLOR_URL | Manual setup steps |
| PROJECT_DAG_EXAMPLE | Manual setup steps |
| PROJECT_EXPORT_NAME | Manual setup steps |
| PROJECT_FACTORY_EXAMPLE | Manual setup steps |
| PROJECT_HOST_BRANCH | Manual setup steps |
| PROJECT_HUMAN_LEAD | Manual setup steps |
| PROJECT_MOVE_NAME | Manual setup steps |
| PROJECT_REVIEW_BRANCH | Manual setup steps |
| PROJECT_REVIEWER_NAME | Manual setup steps |
| PROJECT_TRIGGER_BRANCH | Manual setup steps |
| PROJECT_WAKEUP_CODE | Manual setup steps |
| PROJECT_WORKPAD_BRANCH | Manual setup steps |
| Repository guidance and examples | Manual setup steps |
| Repository workflow profile | Manual setup steps |
| Review lifecycle mapping | Manual setup steps |
| Review service settings | Manual setup steps |
| Runtime bundle | Configuration file values |
| Runtime credential secret reference | Manual setup steps |
| Runtime source | Configuration file values |
| Runtime workflow | Configuration file values |
| RUNTIME_PLAN_PROVENANCE_EXAMPLE | Manual setup steps |
| RUNTIME_PLANNING_KEY | Manual setup steps |
| SOURCE_ISSUE_LINK_EXAMPLE | Manual setup steps |
| Symphony domain | Manual setup steps |
| Symphony host image | Manual setup steps |
| Symphony network inputs | Configuration file values |
| Symphony Terraform backend | Configuration file values |
| Symphony TLS certificate | Configuration file values |
| symphony-build.yml | Configuration file values |
| symphony-lint.yml | Configuration file values |
| symphony-test.yml | Configuration file values |
| SYMPHONY_BOOTSTRAP_REPO | Manual setup steps |
| SYMPHONY_BOT_USER | Repository variables |
| SYMPHONY_EXPECTED_GOOGLE_CLIENT_EMAIL | Manual setup steps |
| SYMPHONY_EXPECTED_LINEAR_EMAIL | Manual setup steps |
| SYMPHONY_EXPECTED_LINEAR_EMAIL_REGEX_FIXTURE | Manual setup steps |
| SYMPHONY_GIT_AUTHOR_EMAIL | Manual setup steps |
| SYMPHONY_GIT_AUTHOR_EMAIL_REGEX_FIXTURE | Manual setup steps |
| SYMPHONY_GOOGLE_SA_SECRET_ID | Manual setup steps |
| SYMPHONY_HUMAN_LEAD | Repository variables |
| SYMPHONY_KEYS_SECRET_ID | Manual setup steps |
| SYMPHONY_REPOSITORY_OWNER | Repository variables |
| SYMPHONY_RUNTIME_REPO | Manual setup steps |
| TEAM_FIXTURE_IDENTIFIER | Manual setup steps |
| TEAM_FIXTURE_SYMBOL | Manual setup steps |
| TEAM_ROUTING_COMPARISON | Manual setup steps |
| TEAM_ROUTING_SYMBOL | Manual setup steps |
| Terraform state bucket | Manual setup steps |
| Terraform state object key | Manual setup steps |
| Tooling dependency commands | Configuration file values |
| TOOLING_PACKAGE_SCOPE | Manual setup steps |
| TOOLING_ROOT_PACKAGE | Manual setup steps |
| WORKPAD_REQUIREMENT_KEY | Manual setup steps |

### Repository variables

<!-- redaction:a-infra-cloud-account -->

`AWS_ACCOUNT_ID` — AWS account that owns the Symphony infrastructure.

Setting: GitHub repository Settings → Secrets and variables → Actions → Variables: set `AWS_ACCOUNT_ID` for the AMI workflow account guard. Use the same account in operator checks and your secret ARN; Terraform IAM derives its account from the caller identity.

Format: Exactly 12 decimal digits, for example `000000000000` (synthetic).

Required for the feature described above; the example is synthetic and must be supplied with adopter-owned values before use.

<!-- redaction:a-tool-cadence-commit-email -->

`CADENCE_GIT_EMAIL` — Attribute automated review commits to the review bot.

Set the CADENCE_GIT_EMAIL Actions variable to the bot account commit email; example example-cadence-bot@users.noreply.github.com. Format: an email address.

Required when using the described integration. The shipped `example-cadence-bot@users.noreply.github.com` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-cadence-bot-login -->

`CADENCE_REVIEWER` — Select the GitHub account that receives automated review requests.

Set the CADENCE_REVIEWER Actions variable and export it for standalone review helpers. Format: GitHub login; example example-cadence-bot.

Required when using the described integration. The shipped `example-cadence-bot` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-symphony-bot-login -->

`SYMPHONY_BOT_USER` — Select the GitHub account used for coding and review-event attribution.

Set the SYMPHONY_BOT_USER Actions variable and export it for standalone helpers and the host installer. Format: GitHub login; example example-symphony-bot.

Required when using the described integration. The shipped `example-symphony-bot` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-human-lead-login -->

`SYMPHONY_HUMAN_LEAD` — Assign host AMI update pull requests to the project lead.

Set the SYMPHONY_HUMAN_LEAD Actions variable. Resolve the same person in adopter-owned project metadata and reviewer examples. Format: a GitHub login; example `example-lead`.

Optional. Default: unset (AMI update PRs have no assignee). Project metadata still requires its human lead.

<!-- redaction:a-tool-repository-owner -->

`SYMPHONY_REPOSITORY_OWNER` — Identify the GitHub organization that owns the adopter repository.

Set the SYMPHONY_REPOSITORY_OWNER Actions variable; export it for command-line helpers. Replace example-org in static repository examples. Format: a GitHub organization or user login.

The hosted workflow's `hooks.after_run --repo` argument is a static `example-org/example-repo` placeholder, paired with its `hooks.after_create` clone URLs; supply the same owner there. Event workflows use their existing repository context. Keep event and host regression fixtures synthetic.

Required when using the described integration. The shipped `example-org` text is a placeholder, not a live account or repository.


### Repository secrets

<!-- redaction:b-tool-actions-aws-access-key-id -->

`AWS_ACCESS_KEY_ID` — ami workflow aws access identifier.

Setting location: GitHub repository Settings → Secrets and variables → Actions → Secrets, under this exact name. Format: An AWS access-key ID for the AMI workflow account; pair it with AWS_SECRET_ACCESS_KEY. Required when enabling the workflow(s) that reference it; no default. Ordinary tooling build/test/lint jobs do not require this credential. Supply your own value; never put it in a checked-in configuration file.

<!-- redaction:b-tool-actions-aws-secret-access-key -->

`AWS_SECRET_ACCESS_KEY` — ami workflow aws secret credential.

Setting location: GitHub repository Settings → Secrets and variables → Actions → Secrets, under this exact name. Format: An AWS secret access key paired with AWS_ACCESS_KEY_ID and authorized for the workflow AWS reads. Required when enabling the workflow(s) that reference it; no default. Ordinary tooling build/test/lint jobs do not require this credential. Supply your own value; never put it in a checked-in configuration file.

<!-- redaction:b-tool-actions-cadence-ai-review-anthropic-api-key -->

`CADENCE_AI_REVIEW_ANTHROPIC_API_KEY` — claude review provider credential.

Setting location: GitHub repository Settings → Secrets and variables → Actions → Secrets, under this exact name. Format: A provider API key authorized to use the chosen Claude review model. Required when enabling the workflow(s) that reference it; no default. Ordinary tooling build/test/lint jobs do not require this credential. Supply your own value; never put it in a checked-in configuration file.

<!-- redaction:b-tool-actions-cadence-bot-github-token -->

`CADENCE_BOT_GITHUB_TOKEN` — github reviewer credential.

Setting location: GitHub repository Settings → Secrets and variables → Actions → Secrets, under this exact name. Format: A GitHub token for the configured reviewer with repository PR/review access; workflow operations may also need Actions or workflow-write permissions. Required when enabling the workflow(s) that reference it; no default. Ordinary tooling build/test/lint jobs do not require this credential. Supply your own value; never put it in a checked-in configuration file.

<!-- redaction:b-tool-actions-cadence-linear-api-token -->

`CADENCE_LINEAR_API_TOKEN` — authorize Linear issue and workpad updates for review and non-review wakeups.

Setting location: GitHub repository Settings → Secrets and variables → Actions → Secrets, under this exact name. Format: A Linear API token with read/write access to the target issues and workpad comments. Required when enabling the workflow(s) that reference it; no default. Ordinary tooling build/test/lint jobs do not require this credential. Supply your own value; never put it in a checked-in configuration file.

The non-review wakeup workflow maps this secret to process `LINEAR_API_TOKEN`
(fallback `LINEAR_API_KEY` is available only to a standalone caller). Its exact
viewer-name guard in `.github/workflows/scripts/symphony-linear-wakeups.mjs`
must agree with the credential owner before writes. Follow the corresponding
manual identity entry; its name is not an environment override. The workflow
uses the automatic GitHub token for evidence reads. No retired DAG integration
workflow consumes this secret.

<!-- redaction:b-tool-actions-google-sa-key -->

`GOOGLE_SA_KEY` — google docs reader credential.

Setting location: GitHub repository Settings → Secrets and variables → Actions → Secrets, under this exact name. Format: The complete Google service-account JSON document, including its private key; share required source documents with that service account. Required when enabling the workflow(s) that reference it; no default. Ordinary tooling build/test/lint jobs do not require this credential. Supply your own value; never put it in a checked-in configuration file.


### Configuration file values

<!-- redaction:b-tool-guardrails -->

`Agent guardrails` — optionally restrict an agent's edit scope and check tooling complexity.

Setting location: `AGENT_GUARDRAIL_BASE` or `--base <git-ref>` (default `origin/main`), with repeatable `--file <relative-path>`; retained scope rules are in `scripts/agent-guardrails.ts`. Optional; root CI does not invoke the scope guard. It runs `npm run lint:agent` after scope checks. Default complexity is 10 with no baseline. An adopter-owned ESLint config may extend `.eslintrc.agent.js` and override `agent-complexity` options, for example `{ max: 12, baselineFile: "config/complexity.json" }`. Baseline format: an array of `{ file, line, column }` source locations. Different scope or commands use an adopter-owned wrapper; no general scope configuration is claimed.

<!-- redaction:b-host-hooks -->

Host hooks — Select optional host extensions.

Setting: `SYMPHONY_HOOKS_DIR` in the installer environment accepts an
operator-owned directory. Format: an absolute directory containing executable
Bash hooks, run in lexical order; a failing hook fails installation. Optional
default: `scripts/symphony/host/hooks.d`. No hooks are shipped; an absent or empty
directory is skipped.

<!-- redaction:b-host-layout -->

Host layout — Select the runtime account, filesystem roots and persistent installer environment.

Setting: Export inputs from an operator-owned nonsecret environment file when
launching bootstrap or install steps. The scripts do not load that file
automatically. Supply the same settings to later reconciliation, for example
through a systemd drop-in; the shipped reconcile unit has no EnvironmentFile.
Defaults are declared in `scripts/symphony/host/lib.sh`.

Format: Unix account/group names and absolute paths, such as `/srv/symphony`.
Optional defaults: `SYMPHONY_RUNTIME_USER` and `SYMPHONY_RUNTIME_GROUP` are
`symphony`; `SYMPHONY_OPT_ROOT` is `/opt/symphony`; `SYMPHONY_CONFIG_DIR` is
`/etc/symphony`; `SYMPHONY_SYSTEMD_DIR` is `/etc/systemd/system`;
`SYMPHONY_WORKSPACE_ROOT` is `/var/lib/symphony`; `SYMPHONY_LOGS_ROOT` is
`/var/log/symphony`; bootstrap state/log roots are `/var/lib/symphony-bootstrap`
and `/var/log/symphony-bootstrap`. Keep bootstrap state outside the workspace.
The releases/current/bootstrap/src/tools child paths each have a corresponding
override listed in `scripts/symphony/runtime-bundle/README.md`.

The retained host setup assumes root, Linux/systemd and the commands described
in that README. Workspace discovery uses label `SYMPHONYWS`, or an explicit
`SYMPHONY_WORKSPACE_DEVICE` device path; inspect the volume helper before use.
Label changes must agree with the helper. Relocated launchers also need
`SYMPHONY_BOOTSTRAP_SCRIPT`, `SYMPHONY_INSTALLER_SCRIPT` and the generated
wrapper's `SYMPHONY_RUNTIME_BUNDLE_INSTALLER` aligned. Their retained absolute
or generated defaults are described in the bundle README. Changing a root
variable alone does not relocate every launch path.

<!-- redaction:b-host-toolchain -->

Host toolchain — Select the tools used to build the runtime and launch workers.

Setting: Export version overrides in the installer environment. Defaults are in
`host/lib.sh` and `host/install.d/{50-beam-toolchain,55-node-toolchain,60-dev-tools}.sh`
beneath `scripts/symphony/`. Build path, mise and cache overrides are detailed in
`scripts/symphony/runtime-bundle/README.md`.

Format: Release version strings. Optional defaults: `SYMPHONY_ERLANG_VERSION`
`28.5.0.5`, `SYMPHONY_ELIXIR_VERSION` `1.19.5-otp-28`, `SYMPHONY_CODEX_VERSION`
`0.153.4` in the Node install step, `SYMPHONY_GH_VERSION` `2.97.0` and `SYMPHONY_TERRAFORM_VERSION`
`1.4.2`. Erlang/Elixir versions must agree on OTP. Mise uses one compile job by
default and the headless Kerl flags in the BEAM step.

The Node step requires root `.nvmrc` (`vMAJOR.MINOR.PATCH`) and `package.json`
`packageManager` (`npm@MAJOR.MINOR.PATCH`); it has no environment override for
those two inputs. These are retained source settings to review when preparing
an installation. The Node PATH regression source now agrees with the Codex install
step. That step sets `NPM_CONFIG_MIN_RELEASE_AGE=0` only for the Codex npm
install. `host/lib.sh:runtime_codex_version` reports an installed Codex version
first, then falls back to `SYMPHONY_CODEX_VERSION` or the older `0.147.0` if the
binary cannot report one. That reporting fallback remains a known divergence;
it is not the Node install default. The Erlang
installation/retry/failure/recovery/rerun regression source is retained.

<!-- redaction:b-host-bundle -->

Runtime bundle — Select the personal instructions, config template and skill sources installed for workers.

Setting: Optional `SYMPHONY_RUNTIME_BUNDLE_SOURCE_DIR` selects an operator-owned
complete bundle directory. Default: `scripts/symphony/runtime-bundle` beneath
the tooling root. Preserve its manifest schema and required `codex/AGENTS.md`,
`codex/config.toml.template` and `workflow/WORKFLOW.md` files. Personal config is
copied verbatim and replaced on refresh; make local changes in the supplied
bundle, not installed outputs.

Format: Absolute directory paths. Optional `SYMPHONY_CODEX_HOME` defaults to
`$SYMPHONY_WORKSPACE_ROOT/cache/codex-home`; the loader may also read generated
`CODEX_HOME` from `runtime.env`. `SYMPHONY_RUNTIME_BUNDLE_CACHE_DIR` defaults to
`$SYMPHONY_WORKSPACE_ROOT/cache/runtime-bundle`. Its releases/current/lock paths
have individual overrides in `host/lib.sh`, detailed in the bundle README.

The source manifest lists shipped files and configured owner/destination
defaults; installed checksums/provenance are generated separately. Bundle
freshness hashes sorted concatenated file contents, excluding separately
recorded shared skills. Releases are reused by bootstrap repository SHA, so
changed content needs a new source commit. Bundled skills are canonical;
`karpathy-guidelines` and `linear-graphql` come from `.agents/skills` in the
tooling repository. The human-only project factory is excluded from default
unattended installation. The freshness wrapper is generated by the installer.

<!-- redaction:b-host-runtime-source -->

Runtime source — Select the tooling revision and the separate executable Symphony runtime.

Setting: In the installer environment, set `SYMPHONY_BOOTSTRAP_REPO` and
`SYMPHONY_RUNTIME_REPO` to adopter-owned GitHub `owner/repository` names, and
`SYMPHONY_BOOTSTRAP_REF` and `SYMPHONY_RUNTIME_REF` to immutable commit IDs.
The two refs may instead come from EC2 tags `symphony:bootstrap-ref` and
`symphony:runtime-ref`; explicit environment values take precedence.

Format: Repository names and full 40-hex Git commit IDs. Both repositories and
refs are required for normal installation; repository defaults are placeholders
and neither ref has a fallback. Ref immutability is an operator requirement,
not an installer validation. No compatible runtime revision or binary is bundled.

The external repository must expose `mix.exs` at its root or `elixir/` and build
an escript with `mix escript.build`. Optional `SYMPHONY_RUNTIME_ESCRIPT_NAME`
defaults to `symphony`; optional `SYMPHONY_RUNTIME_BUILD_HOME` defaults to
`runtime-build-home` beneath bootstrap state. An optional absolute
`SYMPHONY_RUNTIME_BIN_SOURCE` executable path bypasses only the build: the
checkout and selected runtime ref are still required. See
`scripts/symphony/host/install.d/70-symphony-escript.sh` for accepted output paths.

<!-- redaction:b-host-workflow -->

Runtime workflow — Supply tracker policy, workspace setup and worker launch settings.

Setting: Set `SYMPHONY_WORKFLOW_SOURCE` in the installer environment to an
operator-owned Markdown workflow. Optional default: the staged bundle's
`workflow/WORKFLOW.md`, falling back to its source copy. Configure `tracker`
team/state/maturity mappings, `workspace.root`, clone repository/branch, `hooks`,
`codex` command and `server` in that supplied file. Repository/team placeholders
must be replaced with adopter settings before use.

Format: Markdown with YAML frontmatter. `80-config.sh` requires exactly one
indented numeric `max_concurrent_agents` line and one `command: codex` line to
render worker slots and the freshness wrapper. Optional `SYMPHONY_WORKER_SLOTS`
(or `symphony:worker-slots` EC2 tag) is an integer 1–64, default 6; environment
wins over the tag. `SYMPHONY_SERVICE_PORT` defaults to 4000 and must agree with
network and workflow settings.

The supplied workflow is also the setting location for adopter clone and
build/test/lint setup hooks. The bundled npm setup and routing helper are
retained examples, not a requirement on the product language. Match workflow
schema, maturity behavior and service command-line options to the external
runtime selected by the operator. The renderer does not configure those policies.

Optional hook defaults in the bundled profile: `after_create` checks credentials,
clones `main` and runs `npm install`; `before_run` invokes Misc routing;
`after_run` invokes PR label repair with explicit issue/repository arguments;
`before_remove` runs `true`. Set shell commands in the operator-owned profile;
label repair needs process tokens and project-color metadata as described in
its separate entry. Its failures are logged and ignored under the runtime's
best-effort contract. Misc routing retains a synthetic team predicate.

The hosted `codex.command` defaults to `gpt-6-astra` with
`model_reasoning_effort=xhigh`; both are policy strings in that workflow.
Shared review/wakeup helpers prefer `Active` then legacy `Rework` independently
of profile state lists. The profile still lists `mature` and its state scope,
while the DAG parser rejects integration/frontier policies. A project disabling
maturity needs a compatible profile/runtime; no integration queue or operational
repair is supplied here.

<!-- redaction:b-infra-network -->

Symphony network inputs — Describe the existing network used by the host and public load balancer.

Setting: Set `vpc_id`, `private_subnet_ids` and `public_subnet_ids` in an adopter-owned variable file outside the checkout, selected through Terraform's `-var-file` option for `infra/static` during later setup.

Format: A VPC ID string and two lists of subnet ID strings, for example `vpc-0123456789abcdef0` and `["subnet-0123456789abcdef0"]` (synthetic). Private subnets need at least one entry; public ALB subnets need at least two availability zones. All subnets belong to the supplied VPC. The first private subnet selects the host and workspace disk zone.

Required; no defaults. Network provisioning, routing and operational verification are later setup work; this snapshot only exposes the omitted dependency.

<!-- redaction:b-infra-backend -->

Symphony Terraform backend — Select private state storage separately from the host variables.

Setting: Supply `bucket`, and optionally `key` and `region`, in a private adopter-owned backend file outside the checkout. Select it with Terraform's `-backend-config` option during later initialization of `infra/static`; backend settings do not come from `-var-file` or `aws_region`.

Format: HCL string assignments, for example `bucket = "adopter-state-bucket"`. The bucket must exist and be accessible to the operator's AWS identity.

Required: an adopter-owned bucket; the copied bucket is synthetic. Optional: `key` defaults to `symphony/terraform.tfstate`, `region` to `us-west-2`, and `encrypt` to `true`. Review state locking and access during later setup; state can contain OIDC credentials. These instructions do not establish successful initialization.

<!-- redaction:b-infra-tls -->

Symphony TLS certificate — Describe the certificate used by the host HTTPS listener.

Setting: Set `certificate_arn` in an adopter-owned variable file outside the checkout, selected through Terraform's `-var-file` option for `infra/static` during later setup.

Format: An ACM certificate ARN in the host's AWS region, covering its DNS hostname. Synthetic shape: `arn:aws:acm:us-east-1:000000000000:certificate/00000000-0000-0000-0000-000000000000`.

Required; no default. Certificate issuance, DNS and Google OIDC configuration remain later setup work; supplying this input alone does not make the snapshot deployable.

<!-- redaction:b-ci-build -->

`symphony-build.yml` — compile the Symphony DAG and host CLI packages and check the TypeScript helpers.

Setting location: keep `.github/workflows/symphony-build.yml` as the reusable workflow and create an adopter-owned caller such as `.github/workflows/ci.yml`. Configure triggers, the optional `with.tooling-directory` input and additional product jobs in that caller. No upstream workflow edit is needed.

Required for use: the caller's checkout must contain the complete standalone Symphony tooling package, including its `package.json`, two `tools/` workspaces, `.nvmrc` and configuration files. The workflow checks out the **caller repository**; a remote workflow reference does not fetch a separate tooling repository. It selects Node from the tooling `.nvmrc` (currently 20.20.0), installs npm 11.13.0, runs `npm install`, then `npm run build` on an Ubuntu 24.04 runner.

Input: `tooling-directory` is an optional repository-relative directory string, default `.` when the tooling is the repository root. For a nested tooling package, a synthetic example is `tooling/symphony`. This selects the working directory, Node version file and three package manifests used for the npm download cache. Point it at the tooling package, never a product package. No command override is accepted.

Secrets: none to supply or inherit. The automatic `GITHUB_TOKEN` needs `contents: read` for checkout; grant that permission in the caller. Outputs: no named workflow outputs; the job result reports success or failure. The npm download cache does not pin dependency resolution. No lockfile is shipped, so `npm install` resolves the declared ranges and creates a local lockfile under the tooling `.npmrc` policy.

The build compiles `tools/symphony-dag` and `tools/symphony-host`, then checks `scripts/` without emitting helper files. It does not build the separate external Symphony runtime or the adopter's product. Build files remain on the job runner; no artifact is uploaded.

Optional: caller triggers and additional jobs default to none. `workflow_call` alone does not run on push. This complete caller example opts into push and pull request events when the tooling occupies the repository root:

```yaml
name: Tooling build checks

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  symphony-build:
    uses: ./.github/workflows/symphony-build.yml
    with:
      tooling-directory: .
```

Add product validation as separate jobs in the same adopter-owned file. Use `needs: symphony-build` on a product job when it should wait for the tooling check; choose that job's runner, language and commands yourself. The local workflow reference uses the same commit as the caller. No caller workflow is bundled, and these declarations do not establish a successful run.

<!-- redaction:b-ci-lint -->

`symphony-lint.yml` — check the Symphony tooling JavaScript and TypeScript with ESLint.

Setting location: keep `.github/workflows/symphony-lint.yml` as the reusable workflow and create an adopter-owned caller such as `.github/workflows/ci.yml`. Configure triggers, the optional `with.tooling-directory` input and additional product jobs in that caller. No upstream workflow edit is needed.

Required for use: the caller's checkout must contain the complete standalone Symphony tooling package, including its `package.json`, two `tools/` workspaces, `.nvmrc` and configuration files. The workflow checks out the **caller repository**; a remote workflow reference does not fetch a separate tooling repository. It selects Node from the tooling `.nvmrc` (currently 20.20.0), installs npm 11.13.0, runs `npm install`, then `npm run lint` on an Ubuntu 24.04 runner.

Input: `tooling-directory` is an optional repository-relative directory string, default `.` when the tooling is the repository root. For a nested tooling package, a synthetic example is `tooling/symphony`. This selects the working directory, Node version file and three package manifests used for the npm download cache. Point it at the tooling package, never a product package. No command override is accepted.

Secrets: none to supply or inherit. The automatic `GITHUB_TOKEN` needs `contents: read` for checkout; grant that permission in the caller. Outputs: no named workflow outputs; the job result reports success or failure. The npm download cache does not pin dependency resolution. No lockfile is shipped, so `npm install` resolves the declared ranges and creates a local lockfile under the tooling `.npmrc` policy.

The lint target checks `tools/`, `scripts/`, `.github/workflows/scripts/`, and `.agents/skills/linear-graphql/scripts/` with the tooling ESLint configuration. It does not lint the adopter's product. Formatting, the optional agent complexity policy and shell syntax checks are separate commands; see `docs/engineering/symphony/tooling-setup.md`.

Optional: caller triggers and additional jobs default to none. `workflow_call` alone does not run on push. This complete caller example opts into push and pull request events when the tooling occupies the repository root:

```yaml
name: Tooling lint checks

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  symphony-lint:
    uses: ./.github/workflows/symphony-lint.yml
    with:
      tooling-directory: .
```

Add product validation as separate jobs in the same adopter-owned file. Use `needs: symphony-lint` on a product job when it should wait for the tooling check; choose that job's runner, language and commands yourself. The local workflow reference uses the same commit as the caller. No caller workflow is bundled, and these declarations do not establish a successful run.

<!-- redaction:b-ci-test -->

`symphony-test.yml` — run the Symphony tooling unit tests.

Setting location: keep `.github/workflows/symphony-test.yml` as the reusable workflow and create an adopter-owned caller such as `.github/workflows/ci.yml`. Configure triggers, the optional `with.tooling-directory` input and additional product jobs in that caller. No upstream workflow edit is needed.

Required for use: the caller's checkout must contain the complete standalone Symphony tooling package, including its `package.json`, two `tools/` workspaces, `.nvmrc` and configuration files. The workflow checks out the **caller repository**; a remote workflow reference does not fetch a separate tooling repository. It selects Node from the tooling `.nvmrc` (currently 20.20.0), installs npm 11.13.0, runs `npm install`, then `npm test` on an Ubuntu 24.04 runner.

Input: `tooling-directory` is an optional repository-relative directory string, default `.` when the tooling is the repository root. For a nested tooling package, a synthetic example is `tooling/symphony`. This selects the working directory, Node version file and three package manifests used for the npm download cache. Point it at the tooling package, never a product package. No command override is accepted.

Secrets: none to supply or inherit. The automatic `GITHUB_TOKEN` needs `contents: read` for checkout; grant that permission in the caller. Outputs: no named workflow outputs; the job result reports success or failure. The npm download cache does not pin dependency resolution. No lockfile is shipped, so `npm install` resolves the declared ranges and creates a local lockfile under the tooling `.npmrc` policy.

The test target selects both tooling workspace Jest suites, guardrail and project-color TypeScript tests, and Node tests in `scripts/`, `scripts/symphony/`, and `.github/workflows/scripts/`. Host installer, infrastructure helper and runtime bundle suites are separate opt-in jobs with additional prerequisites; see `docs/engineering/symphony/tooling-setup.md` and `scripts/symphony/runtime-bundle/README.md`. Retained suites may need later setup corrections.

Optional: caller triggers and additional jobs default to none. `workflow_call` alone does not run on push. This complete caller example opts into push and pull request events when the tooling occupies the repository root:

```yaml
name: Tooling test checks

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  symphony-test:
    uses: ./.github/workflows/symphony-test.yml
    with:
      tooling-directory: .
```

Add product validation as separate jobs in the same adopter-owned file. Use `needs: symphony-test` on a product job when it should wait for the tooling check; choose that job's runner, language and commands yourself. The local workflow reference uses the same commit as the caller. No caller workflow is bundled, and these declarations do not establish a successful run.

<!-- redaction:b-tool-dependencies -->

`Tooling dependency commands` — install and validate the Node tooling independently of the adopter's product.

Setting location: root and tooling workspace `package.json` files, `.nvmrc`, `.npmrc`, and tooling TypeScript/ESLint configs define the tooling contract; put extra product jobs in an adopter-owned CI caller. Required for tooling CI: Node 20.20.0, npm 11.13.0, then `npm install`; exact commands are `npm run build`, `npm test`, and `npm run lint`. A derived root lockfile is not included. Installation resolves the declared ranges and generates a local lockfile by default; resolution can change between installs. An adopter can maintain that lock in their own repository before using `npm ci`. Optional product jobs default to none. The root test script selects tooling unit tests; host and runtime suites are separate commands documented in `docs/engineering/symphony/tooling-setup.md`. No product language is assumed.

Known later setup gaps: the label-repair host test and review/wakeup tests
import `js-yaml`, which the tooling manifests do not directly declare. Root
TypeScript checking covers `scripts/**/*.ts`, not `.mjs` helpers. No direct
dependency or broader compiler scope is added here; declaring the command
selection does not establish a passing installation or suite.


### Manual setup steps

<!-- redaction:a-tool-obsolete-review-reference -->

`ARCHIVED_REVIEW_REFERENCE` — Omit obsolete project-specific reconciliation notes from current review guidance.

No adopter setting is needed; follow the current workpad helper contract. Format: no identifier is required.

Optional. Default: no archived review reference.

<!-- redaction:a-tool-aws-profile-argument -->

`AWS_PROFILE_ARGUMENT` — Replace a private AWS CLI profile reference.

Set AWS_PROFILE or the explicit --aws-profile/--profile option to an adopter-managed CLI profile. Format: profile name; example example. This representation is used where static prose or quoted literals cannot interpolate an Actions variable.

Required when using the described integration. The shipped `--aws-profile example` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-aws-profile-help -->

`AWS_PROFILE_HELP` — Replace a private AWS CLI profile reference.

Set AWS_PROFILE or the explicit --aws-profile/--profile option to an adopter-managed CLI profile. Format: profile name; example example. This representation is used where static prose or quoted literals cannot interpolate an Actions variable.

Required when using the described integration. The shipped `AWS_PROFILE or example` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-aws-profile-login -->

`AWS_PROFILE_LOGIN` — Replace a private AWS CLI profile reference.

Set AWS_PROFILE or the explicit --aws-profile/--profile option to an adopter-managed CLI profile. Format: profile name; example example. This representation is used where static prose or quoted literals cannot interpolate an Actions variable.

Required when using the described integration. The shipped `--profile example` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-aws-profile-quoted -->

`AWS_PROFILE_QUOTED` — Replace a private AWS CLI profile reference.

Set AWS_PROFILE or the explicit --aws-profile/--profile option to an adopter-managed CLI profile. Format: profile name; example example. This representation is used where static prose or quoted literals cannot interpolate an Actions variable.

Required when using the described integration. The shipped `"example"` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-package-symbol -->

`BOOTSTRAP_SOURCE_SYMBOL` — Name the bootstrap source checkout without an organization-specific identifier.

This internal source symbol needs no setup value. Keep the synthetic bootstrap_source spelling when reading installer examples. Format: an internal snake_case identifier.

Optional. Default: `bootstrap_source` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-cadence-bot-email -->

`CADENCE_BOT_EMAIL` — Identify the review bot contact address.

Use your review bot address in account setup documentation. Format: an email address; example cadence@example.invalid.

Required when using the described integration. The shipped `cadence@example.invalid` text is a placeholder, not a live account or repository.

<!-- redaction:b-tool-dag-integration -->

`DAG project settings` — declare task branches and PRs against the selected project base.

Setting location: use `base-branch` in adopter-owned Linear project metadata
(optional branch-name string, default `main`), and explicitly declare the
matching `project.base_branch`, task `branch.base` and `pr.base` in the
`symphony-dag-manifest/v1` YAML plan. The manifest requires these declarations;
its parser does not supply the metadata default. Use
`docs/symphony-plans/fan-out-plan-schema.md` and the synthetic minimal plan as
shape examples. Optional validation in an adopter-owned CI caller uses
`npm run symphony-dag:check`; no automatic DAG validation trigger is bundled.

The parser rejects `project.integration_branch`,
`defaults.frontier_blocked_label` and `defaults.integration_branch_policy`.
No integration queue or merge-build contract remains.
The former process inputs `SYMPHONY_DAG_BASE_BRANCH` (base branch name),
`SYMPHONY_DAG_INTEGRATION_BRANCH` (shared branch name), and
`SYMPHONY_DAG_VALIDATION_COMMAND` (validation shell command) belonged in the
retired integration helper's process environment. They now have no setting
location or runtime consumer: do not supply them. Put the base in project/plan
metadata and validation commands in an adopter-owned caller instead. The old
queue and cached dependency-link setup are absent; no `PR Checks` workflow is
required for them.

<!-- redaction:a-tool-dag-planning-key -->

`DAG_PLANNING_KEY` — Replace a private planning identifier prefix in examples and fixtures.

Keep these planning keys synthetic. Use your own payload keys only in adopter-owned project plans. Format: a stable textual prefix plus a numeric suffix.

Optional. Default: `SYNTHDAG` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-host-github-token-fixture -->

`GITHUB_TOKEN_FIXTURE` — Keep credential-shaped test data explicitly synthetic.

Use this short invented sentinel only in fixtures. Put real tokens in adopter-managed repository secrets or the runtime credential store, never test data. Format: a synthetic provider prefix plus fake.

Optional. Default: `github_fake` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-infra-oidc-secret-name -->

Google OIDC client secret — Secrets Manager locator for the Symphony ALB Google OIDC client.

Setting: Set the `symphony_google_oidc` secret resource name in `infra/static/secrets.tf`; populate the secret privately before Terraform reads its current version.

Format: A secret name, for example `symphony/oidc-credentials`; store JSON with `client_id` and `client_secret` for your Google OIDC web client.

Required for the feature described above; the example is synthetic and must be supplied with adopter-owned values before use.

<!-- redaction:a-tool-source-document-id -->

`GOOGLE_DOC_ID_EXAMPLE` — Demonstrate Google Docs URL and bare-ID parsing without a private document ID.

Supply a document shared with the configured service account when invoking scripts/fetch-google-doc.mjs. Keep the shipped test ID synthetic. Format: a document ID or https://docs.google.com/document/d/SYNTHETIC_DOC_ID_1234567890_ABCDEFGHIJKLMN/edit.

Optional. Default: `SYNTHETIC_DOC_ID_1234567890_ABCDEFGHIJKLMN` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-google-project-id -->

`GOOGLE_PROJECT_ID_EXAMPLE` — Remove a private cloud project identifier from identity fixtures.

Supply your Google project only in adopter-owned service-account JSON. The shipped example-project value is synthetic. Format: a Google Cloud project ID.

Required when using the described integration. The shipped `example-project` text is a placeholder, not a live account or repository.

<!-- redaction:b-tool-host-management -->

`Host management settings` — select the host and assess the optional AMI update recipe.

Setting location: host CLI arguments `--region`, `--profile`, `--name`, `--instance-id`, `--alb-arn`, `--target-group-arn`, `--volume-id`. Formats are region/profile/tag strings and AWS resource IDs or ARNs. Optional defaults: region `us-west-2`, target name `symphony`, SDK credential selection. Mutations require `--yes`. Service operations retain Linux/systemd, SSM, `/opt/symphony`, and port 4000 assumptions. The AMI workflow's `AMI_PARAMETER_NAME`, region, Terraform file, schedule, and main branch remain in `.github/workflows/update-symphony-host-ami.yml`. Different architectures or layouts require adopter-owned operations/setup before enabling that optional workflow.

<!-- redaction:a-tool-human-lead-first-name -->

`HUMAN_DISPLAY_NAME_EXAMPLE` — Remove a personal name from explanatory prose.

Use your own lead display name in operational prose; the shipped Example text is synthetic. Format: a display name.

Optional. Default: `Example` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-human-lead-login-case -->

`HUMAN_LOGIN_CASE_FIXTURE` — Exercise case-insensitive human identity handling with synthetic data.

Keep the invented EXAMPLE-LEAD fixture paired with example-lead. Format: case variants of a synthetic GitHub login.

Optional. Default: `EXAMPLE-LEAD` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-human-lead-short-login -->

`HUMAN_LOGIN_EXAMPLE` — Provide a synthetic human actor for review fixtures.

Keep example-human synthetic in fixtures; use actual adopter accounts only in adopter-owned metadata. Format: a GitHub login.

Optional. Default: `example-human` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-human-reviewer-login -->

`HUMAN_REVIEWER_EXAMPLE` — Provide a synthetic second reviewer in fixtures.

Keep example-reviewer synthetic in fixtures. Format: a GitHub login.

Optional. Default: `example-reviewer` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-infra-linear-secret-name -->

`LINEAR_AWS_SECRET_ID` — Explicit Secrets Manager fallback locator for Linear authentication.

Setting: When using AWS fallback authentication, provision your Linear token privately and supply its locator through `LINEAR_AWS_SECRET_ID`, `SYMPHONY_LINEAR_API_KEY_SECRET_ID`, or the helper `--aws-secret-id` option.

Format: A secret name, for example `symphony/linear-api-token`; only the locator is configured in source, never the token.

Required for the feature described above; the example is synthetic and must be supplied with adopter-owned values before use.

<!-- redaction:a-tool-linear-team-routing-prose -->

`LINEAR_OTHER_TEAM_EXAMPLE` — Describe issues outside the configured example routing team.

Setting: keep `non-DEMO` consistent with the example in `docs/engineering/symphony/project-workflow.md`. Set the live routing team through the adopter configuration documented by that guide and the misc routing guide. Format: an uppercase team key; `DEMO` is the synthetic example. Optional. Default: `non-DEMO` in documentation.

<!-- redaction:a-tool-linear-team-state-prose -->

`LINEAR_STATE_TEAM` — Identify the example team whose workflow state names are described.

Setting: replace the `DEMO` example team in your adopted `WORKFLOW.md`, hosted `scripts/symphony/runtime-bundle/workflow/WORKFLOW.md`, and the linked review/project-workflow guides; configure actual states in Linear team workflow settings. Format: an uppercase team key. Required for live team setup; `DEMO` is synthetic. Retain the documented Active/Rework fallback semantics.

<!-- redaction:a-tool-linear-team-key -->

`LINEAR_TEAM_KEY` — Identify the Linear team used by examples and routing inputs.

Use your team key in adopter project metadata and supplied issue identifiers. DEMO is a synthetic placeholder; routing/team configuration is documented by the tooling configuration owner. Format: uppercase letters, with issues such as DEMO-123.

The non-review bridge's `resolveIssue` recognizers in `.github/workflows/scripts/symphony-linear-wakeups.mjs` also contain the `DEMO-` placeholder. Set these to the same live team prefix used in PR titles, branches and optional `[linear:DEMO-123]` workflow run-name markers. The marker has no default; without it, resolution uses the PR title and then the branch. Keep the paired event and `scripts/linear-issue-wakeup.test.mjs` fixtures synthetic. The bridge keeps its existing identity precedence and rejects missing or ambiguous identifiers.

Required when using the described integration. The shipped `DEMO-` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-linear-team-literal -->

`LINEAR_TEAM_LITERAL` — Identify the Linear team used by examples and routing inputs.

Use your Linear team key in adopter-owned setup inputs and project metadata; keep DEMO synthetic in tests and documentation examples. Format: an uppercase team key. This entry covers the literal representation.

Required when using the described integration. The shipped `"DEMO"` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-linear-team-markdown -->

`LINEAR_TEAM_MARKDOWN` — Identify the Linear team used by examples and routing inputs.

Use your Linear team key in adopter-owned setup inputs and project metadata; keep DEMO synthetic in tests and documentation examples. Format: an uppercase team key. This entry covers the markdown representation.

Required when using the described integration. The shipped `DEMO` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-linear-team-metadata -->

`LINEAR_TEAM_METADATA` — Identify the Linear team used by examples and routing inputs.

Use your Linear team key in adopter-owned setup inputs and project metadata; keep DEMO synthetic in tests and documentation examples. Format: an uppercase team key. This entry covers the metadata representation.

Required when using the described integration. The shipped `linear-team: DEMO` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-linear-team-negative-fixture -->

`LINEAR_TEAM_NEGATIVE_FIXTURE` — Identify the Linear team used by examples and routing inputs.

Use your Linear team key in adopter-owned setup inputs and project metadata; keep DEMO synthetic in tests and documentation examples. Format: an uppercase team key. This entry covers the negative-fixture representation.

Optional. Default: `Not DEMO` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-linear-team-prose -->

`LINEAR_TEAM_PROSE` — Identify the Linear team used by examples and routing inputs.

Use your Linear team key in adopter-owned setup inputs and project metadata; keep DEMO synthetic in tests and documentation examples. Format: an uppercase team key. This entry covers the prose representation.

Required when using the described integration. The shipped `DEMO issue` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-linear-team-slug -->

`LINEAR_TEAM_SLUG_EXAMPLE` — Use the lowercase team prefix in labels and example paths.

Use the lowercase form of your team key in adopter-owned metadata. Format: `demo-123`. Routing and test symbols use the corresponding `demo` and `Demo` representations.

Optional. Default: `demo-` (synthetic example).

<!-- redaction:a-tool-linear-team-workflow -->

`LINEAR_TEAM_WORKFLOW` — Identify the Linear team used by examples and routing inputs.

Use your Linear team key in adopter-owned setup inputs and project metadata; keep DEMO synthetic in tests and documentation examples. Format: an uppercase team key. This entry covers the workflow representation.

Required when using the described integration. The shipped `team_key: DEMO` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-host-linear-token-fixture -->

`LINEAR_TOKEN_FIXTURE` — Keep credential-shaped test data explicitly synthetic.

Use this short invented sentinel only in fixtures. Put real tokens in adopter-managed repository secrets or the runtime credential store, never test data. Format: a synthetic provider prefix plus fake.

Optional. Default: `linear_fake` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-cadence-linear-bot-name -->

`LINEAR_WAKEUP_BOT_NAME` — Verify the Linear credential owner before non-review wakeups.

Setting: replace the `Example Review Bot` placeholder in the viewer-name guard in `.github/workflows/scripts/symphony-linear-wakeups.mjs` with the intended Linear bot profile name. Supply that account's token through the existing `CADENCE_LINEAR_API_TOKEN` repository secret (workflow `LINEAR_API_TOKEN` environment); standalone use accepts `LINEAR_API_TOKEN` or `LINEAR_API_KEY`. Format: the exact, case-sensitive Linear `viewer.name` display name. Required for live wakeups; no usable account default. Keep the paired `.test.mjs` fixtures synthetic and the credential-owner check intact.

<!-- redaction:a-tool-linear-workspace -->

`LINEAR_WORKSPACE` — Identify the Linear workspace in issue and project link examples.

Replace example-workspace in static links with your Linear workspace URL slug. Format: https://linear.app/example-workspace/issue/DEMO-123.

Required when using the described integration. The shipped `example-workspace` text is a placeholder, not a live account or repository.

<!-- redaction:b-tool-local-environment -->

`Local environment loader` — supply the credentials and local paths needed by your workflow.

Setting location: an adopter-owned environment script, or the retained `symphony_setup_main` recipe in `scripts/symphony/setup-local-env.sh`. The recipe assigns `AWS_PROFILE`, `AWS_REGION`, `AWS_DEFAULT_REGION`, `SYMPHONY_GOOGLE_SA_SECRET_ID`, `SYMPHONY_KEYS_SECRET_ID`, and `SYMPHONY_RUNTIME_DIR`; inherited values for these are overwritten. Shapes: AWS profile/region strings, Secrets Manager names/ARNs, and a private writable directory. Optional recipe, default directory `/tmp/symphony`; other retained defaults are at those assignments. Required inputs when used: the Google secret is service-account JSON; the runtime secret is a JSON object mapping environment names to string values. For different locations supply your own loader producing the tokens, Google JSON path, Git identity and askpass executable required by your workflow.

<!-- redaction:a-tool-local-github-token-fixture -->

`LOCAL_GITHUB_TOKEN_FIXTURE` — Keep credential-shaped test data explicitly synthetic.

Use this short invented sentinel only in fixtures. Put real tokens in adopter-managed repository secrets or the runtime credential store, never test data. Format: a synthetic provider prefix plus fake.

Optional. Default: `ghp_fake` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:b-tool-misc-routing -->

`Misc project routing` — optionally assign eligible unowned issues to an active project.

Setting location: an adopter-owned caller passes `lookup` to the exported routing functions in `scripts/symphony/route-misc-project.mjs`. Shape: `projectCode`, `projectColor`, `baseBranch`, `activeStates` string array, and `actorEmail`. Defaults are `misc`, `blue`, `main`, and the active project states listed in that source. The fixed example-team eligibility predicate is a known setup gap: changing `lookup` does not change it. Optional; leave the ticket-start hook unused until your routing policy exists. Color helpers separately accept an `activeStates` array and retain their declared palette.

The routing lookup does not override the owning project `project-color` used by
PR label repair. No `integrationBranch` lookup setting is supported.

<!-- redaction:b-tool-linear-wakeups -->

`Non-review wakeups` — return eligible Linear work to Active after GitHub evidence changes.

Setting location: enable `.github/workflows/symphony-linear-wakeups.yml` on the
repository's default branch after configuring its Actions secret
`CADENCE_LINEAR_API_TOKEN`. It maps that secret to `LINEAR_API_TOKEN` and the
automatic GitHub token to `GH_TOKEN`. Shapes: private API-token strings; Linear
needs issue/workpad read/write and GitHub needs Actions/checks/contents/PR/status
reads. Required when enabled, no credential default; no supplied GitHub secret.

A standalone caller supplies `GH_TOKEN`, `LINEAR_API_TOKEN` (fallback
`LINEAR_API_KEY`), `GITHUB_REPOSITORY` (`owner/repository`), `GITHUB_EVENT_NAME`,
`GITHUB_EVENT_PATH` (webhook JSON file), `GITHUB_ACTOR` and `GITHUB_RUN_ID`.
Optional `GITHUB_SERVER_URL` defaults to `https://github.com` for evidence links
only; `GITHUB_STEP_SUMMARY` is an optional output path, unset outside Actions.
API endpoints remain fixed. The exact viewer-name guard in `applyPlan` needs
the manual credential-owner setup in the identity reference; its reference
name `LINEAR_WAKEUP_BOT_NAME` is not a read environment variable. Preserve the
guard and synthetic tests; no override interface is added.

Optional automation; its shipped defaults use `ubuntu-latest`, a ten-minute
job timeout, `concurrency.queue: max` and a conflict sweep at minutes 17 and 47
each hour. Assess platform/event availability before enabling. Failed required
checks and confirmed conflicts use current open PR evidence with `symphony`
labels. Completed `workflow_dispatch` runs must be on same-repository
`symphony/` branches. The bridge never dispatches workflows. An optional
explicit owner marker in an adopter-owned workflow run name is
`[linear:DEMO-123] Validate tooling`; absent that marker, ownership falls back
to PR title or branch identity. Dispatch inputs are not included in
`workflow_run`, so `ticket_number` must be carried by that anchored marker.
Align team recognizers with the adopter's metadata; leave fixtures synthetic.

The job excludes recursive completions and unrelated runs, uses trusted
bridge source, and rechecks stale/ambiguous evidence. Writes preserve and
deduplicate the Cadence workpad's review coordination. Shared state selection
prefers `Active`, then legacy `Rework`; terminal issues stay terminal. No
product pipeline or generic state/identity mapping is supplied. Ordinary
build/test/lint callers require none of this optional setup.

<!-- redaction:a-tool-organization-display-name -->

`ORGANIZATION_DISPLAY_NAME` — Remove the organization name from reusable prose.

Use your organization display name in adopter-owned instructions and examples. Format: a display name; example Example Organization.

Required when using the described integration. The shipped `Example Organization` text is a placeholder, not a live account or repository.

<!-- redaction:b-tool-pr-label-repair -->

`PR label repair` — add missing Symphony/project labels to a verified open PR.

Setting location: configure `hooks.after_run` in an operator-owned workflow
selected by `SYMPHONY_WORKFLOW_SOURCE`. The included CLI accepts exactly
`--issue DEMO-123 --repo example-org/example-repo` in that order. Shapes:
uppercase issue identifier and GitHub `owner/repository` string. Both are
required for a call, with no default or repository inference; the bundled hook
uses the issue workspace basename and a static synthetic repository argument.
Installer repository variables do not substitute this hook text.

Supply secret token strings in the hook process environment: `LINEAR_API_TOKEN`
(fallback `LINEAR_API_KEY`) for Linear issue/project/attachment reads, and
`GH_TOKEN` (fallback `GITHUB_TOKEN`) for GitHub PR/label reads and label writes.
Both credentials are required for a call and have no default. The host
credential JSON supplies `LINEAR_API_TOKEN` and `GITHUB_TOKEN`; Actions secrets
do not populate a host process. API endpoints are fixed to public GitHub/Linear.

Set one `project-color` value in the owning Linear project's content or
description, for example `teal`. Values are lowercased and must match
`[a-z][a-z0-9-]*`; declarations in both locations must agree. Required for a
matching PR; no fallback to issue text, branch color or a CLI option. Create
that repository label and `symphony` before use. The helper rejects ambiguous
or title-only association, adds missing labels only, and reads them back.

Optional capability; the hosted profile enables it by default, and an
operator-owned profile can omit the hook. Requests share a 45-second deadline
without retries and fail on incomplete bounded pagination. The runtime logs
and ignores hook failures; agents still verify publishing labels and apply
additional project labels. It changes neither Linear states nor review gates.

<!-- redaction:a-tool-project-color-name -->

`PROJECT_COLOR_NAME` — Use an invented display name in the color fixture.

Keep this invented value in shipped fixtures and examples. Supply your own project metadata and links for live use. Format: the same identifier or URL shape as `Sample project`.

Optional. Default: `Sample project` (synthetic example).

<!-- redaction:a-tool-project-color-url -->

`PROJECT_COLOR_URL` — Use a synthetic Linear project URL in the color fixture.

Keep this invented value in shipped fixtures and examples. Supply your own project metadata and links for live use. Format: the same identifier or URL shape as `https://linear.app/example-workspace/project/sample-project-000000000000`.

Optional. Default: `https://linear.app/example-workspace/project/sample-project-000000000000` (synthetic example).

<!-- redaction:a-tool-project-dag-example -->

`PROJECT_DAG_EXAMPLE` — Use an invented DAG project code in planning fixtures.

Keep this invented value in shipped fixtures and examples. Supply your own project metadata and links for live use. Format: the same identifier or URL shape as `sample-dag`.

Optional. Default: `sample-dag` (synthetic example).

<!-- redaction:a-tool-project-extraction-name -->

`PROJECT_EXPORT_NAME` — Name the project in the three-seed request example.

Setting: keep `Sample Tooling Export` in `.agents/skills/symphony-project-factory/SKILL.md`; supply your own project name and full scope in the Linear project brief. Format: a descriptive project title. Optional. Default: `Sample Tooling Export` in examples.

<!-- redaction:a-tool-project-factory-example -->

`PROJECT_FACTORY_EXAMPLE` — Use an invented project code in factory and color examples.

Keep this invented value in shipped fixtures and examples. Supply your own project metadata and links for live use. Format: the same identifier or URL shape as `sample-factory`.

Optional. Default: `sample-factory` (synthetic example).

<!-- redaction:a-tool-project-host-branch -->

`PROJECT_HOST_BRANCH` — Use an invented project branch prefix in tooling examples.

Keep this invented value in shipped fixtures and examples. Supply your own project metadata and links for live use. Format: the same identifier or URL shape as `symphony/sample-host/`.

Optional. Default: `symphony/sample-host/` (synthetic example).

<!-- redaction:a-tool-human-lead-name -->

`PROJECT_HUMAN_LEAD` — Name the person responsible for project decisions and handoff.

Set human-lead in adopter-owned Linear project metadata. Replace Example Lead in planning examples. Format: a full display name.

Required when using the described integration. The shipped `Example Lead` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-project-move-name -->

`PROJECT_MOVE_NAME` — Identify the destination project in the explicit ticket-move example.

Setting: keep `SampleMetrics` and `<resolved-SampleMetrics-project-id>` synthetic in `.agents/skills/symphony-project-factory/SKILL.md`. For an explicitly requested live move, resolve the intended Linear project and supply its UUID as `issueUpdate.input.projectId`. Format: a project display name and its resolved UUID. Optional. Default: the synthetic example; no live move is required.

<!-- redaction:a-tool-project-review-branch -->

`PROJECT_REVIEW_BRANCH` — Use an invented project branch prefix in tooling examples.

Keep this invented value in shipped fixtures and examples. Supply your own project metadata and links for live use. Format: the same identifier or URL shape as `symphony/sample-review/`.

Optional. Default: `symphony/sample-review/` (synthetic example).

<!-- redaction:a-tool-human-reviewer-name -->

`PROJECT_REVIEWER_NAME` — Identify the reviewer in project request examples.

Setting: keep `Example Reviewer` synthetic in `.agents/skills/symphony-project-factory/SKILL.md`; supply the actual reviewer in your own project brief and acceptance criteria. Format: a person's display name. Optional. Default: `Example Reviewer` in examples.

<!-- redaction:a-tool-project-trigger-branch -->

`PROJECT_TRIGGER_BRANCH` — Use an invented project branch prefix in tooling examples.

Keep this invented value in shipped fixtures and examples. Supply your own project metadata and links for live use. Format: the same identifier or URL shape as `symphony/sample-trigger/`.

Optional. Default: `symphony/sample-trigger/` (synthetic example).

<!-- redaction:a-tool-project-workpad-code -->

`PROJECT_WAKEUP_CODE` — Keep event-fixture project metadata aligned with its synthetic branch.

Setting: keep `sample-workpad` in `.github/workflows/scripts/symphony-linear-wakeups.test.mjs`. For live use, set `project-code` in the Linear project description/content and use the same code in `symphony/<project-code>/<issue>/<slug>` branches. Format: letters, numbers, underscores or hyphens. Optional. Default: `sample-workpad` in fixtures.

<!-- redaction:a-tool-project-workpad-branch -->

`PROJECT_WORKPAD_BRANCH` — Use an invented project branch prefix in tooling examples.

Keep this invented value in shipped fixtures and examples. Supply your own project metadata and links for live use. Format: the same identifier or URL shape as `symphony/sample-workpad/`.

Optional. Default: `symphony/sample-workpad/` (synthetic example).

<!-- redaction:b-tool-source-guidance -->

`Repository guidance and examples` — supply repository-specific context without historical source documents.

Setting location: adopter-owned issue/project descriptions, plans, and directory guidance. Required when a task references a source: provide readable current requirements. Optional examples default to the included inline factory payload and `tools/symphony-dag/src/__fixtures__/minimal-project-plan.md`; these contain synthetic data. Use `.agents/skills/karpathy-guidelines/SKILL.md` and the inline workpad shape in `docs/engineering/symphony/proof-of-work.md`. Historical review guides and plans are not included dependencies. The project-factory skill is human-only and remains excluded from default unattended installation.

<!-- redaction:b-tool-workflow-profile -->

`Repository workflow profile` — tell the Symphony runtime which repository, workspace, issue states and setup commands to use.

Setting location: an adopter-owned YAML-frontmatter Markdown profile based on `WORKFLOW.md`, supplied to the selected runtime. Required before running workers: repository clone URL, `tracker.team_key`, credentials and `workspace.root` path. Optional defaults: clone branch `main`, retained tracker state lists, and no product install command. Put any setup command in `hooks.after_create`, for example a repository-specific bootstrap script. Model/server/concurrency fields retain their template defaults. Hosted bundle profiles have a separate installation contract; verify the external runtime's profile interface during setup.

<!-- redaction:b-tool-linear-lifecycle -->

`Review lifecycle mapping` — route review findings and non-review events to a safe Linear work state.

Setting location: create the `symphony` label in the GitHub repository and
`Active` in the Linear team's workflow states. The shared selection in
`scripts/linear-issue-wakeup.mjs` prefers `Active`, falling back to legacy
`Rework` only if `Active` is absent; state names are compared case-insensitively.
Format: state and label display-name strings. Required when enabling review
handoff or non-review wakeups: at least one of those safe work states; there is
no arbitrary started-state fallback or environment mapping override.

Terminal issues (`Done`, `Canceled`/`Cancelled`, `Duplicate`, or matching
completed/canceled/duplicate state types) are preserved. Already-target issues
are unchanged, and mutations require matching API confirmation. Runtime
profile state lists do not configure these helper semantics. Optional event
routing defaults to the shipped workflow gates; leave the workflows unused if
those assumptions do not fit. A wakeup never satisfies a hard dependency or
establishes CI/review completion.

<!-- redaction:b-tool-review-provider -->

`Review service settings` — provision the optional Cadence reviewer and actor classification.

Setting location: GitHub Actions repository Variables for `CADENCE_CLAUDE_MODEL` and the identity variables in the generated reference; credentials go in Actions Secrets. Model value is a provider model identifier; required when enabling Cadence, with no default. The retained preflight in `.github/workflows/scripts/verify-cadence-ai-review.cjs` accepts only `claude-opus-5` through `APPROVED_CADENCE_CLAUDE_MODELS`; it rejects an unset model or a workflow fallback. This allowlist has no adopter-owned override in the snapshot. A different model requires an adopter-owned review workflow and validation policy during later setup. GitHub, Linear, Google Docs and Claude Code access are required to enable the full recipe. An adopter-owned caller can pass `org`, `humansTeamSlug`, and `aiTeamSlug` to `fetchGitHubActorTeams`; team slug defaults are `humans` and `ai`. Supply a token with team-read access or use the pure classifier's explicit actor/membership inputs.

<!-- redaction:a-infra-runtime-secret-arn -->

Runtime credential secret reference — Local setup uses the same runtime credential bundle as the host.

Setting: Reuse the `SYMPHONY_KEYS_SECRET_ID` setting documented for the runtime credentials. There is no separate ARN environment variable or additional secret to provision.

Format: A secret name, for example `symphony/runtime-credentials`, or the full ARN of that same secret. Both local setup references use the name example. See the runtime credential entry for the JSON fields to supply privately.

Required for the feature described above; the examples are synthetic and must be supplied with adopter-owned values before use.

<!-- redaction:a-tool-runtime-plan-commit -->

`RUNTIME_PLAN_PROVENANCE_EXAMPLE` — Remove a private planning commit from bundle provenance.

Use the synthetic 40-hex placeholder only as an example. Supply adopter-owned source provenance when maintaining a bundle; this value does not identify a downloadable runtime revision. Format: 40 hexadecimal characters.

Optional. Default: `0123456789abcdef0123456789abcdef01234567` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-runtime-planning-key -->

`RUNTIME_PLANNING_KEY` — Replace a private planning identifier prefix in examples and fixtures.

Keep these planning keys synthetic. Use your own payload keys only in adopter-owned project plans. Format: a stable textual prefix plus a numeric suffix.

Optional. Default: `RUNTIME-` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-source-document-url -->

`SOURCE_ISSUE_LINK_EXAMPLE` — Replace a private design issue link in copied lint guidance.

Use your own issue link if documenting local lint decisions. Format: HTTPS URL; the example.invalid link is illustrative only.

Optional. Default: `https://example.invalid/issues/DEMO-123` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-infra-domain-hostnames -->

Symphony domain — DNS and Google Workspace domain used by Symphony host access.

Setting: Supply Terraform `domain_name` for DNS and the `hd` value in `infra/static/modules/symphony-host/main.tf` for Google OIDC. Replace the synthetic domain in host URLs and example service-account or operator addresses with your corresponding domains. DNS and identity domains may differ.

Format: A DNS name without scheme or path, for example `example.invalid`; the derived example host is `symphony.example.invalid`.

Required for the feature described above; the example is synthetic and must be supplied with adopter-owned values before use.

<!-- redaction:a-infra-host-ami -->

Symphony host image — Pinned machine image for the Symphony EC2 host.

Setting: Supply `symphony_host_ami_id` in `infra/static/modules/symphony-host/instance.tf`, using an image available in your AWS region.

Format: An EC2 AMI ID; `ami-00000000000000000` is an intentionally nonexistent example.

Required for the feature described above; the example is synthetic and must be supplied with adopter-owned values before use.

<!-- redaction:a-tool-repository-name -->

`SYMPHONY_BOOTSTRAP_REPO` — Identify the repository containing the host bootstrap and tooling.

Set SYMPHONY_BOOTSTRAP_REPO to owner/repository in the installer environment. Replace example-repo in static clone/workspace examples. Format: example-org/example-repo; also select SYMPHONY_BOOTSTRAP_REF.

In the hosted `scripts/symphony/runtime-bundle/workflow/WORKFLOW.md`, set `hooks.after_run`'s `--repo example-org/example-repo` argument to the same intended repository as the clone URLs in `hooks.after_create`. Keep the corresponding host test expectations synthetic. This hook consumes its explicit argument; setting the installer variable alone does not replace the static workflow placeholder.

Required when using the described integration. The shipped `example-repo` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-google-service-account -->

`SYMPHONY_EXPECTED_GOOGLE_CLIENT_EMAIL` — Validate the service account used for Google Docs source reads.

Set SYMPHONY_EXPECTED_GOOGLE_CLIENT_EMAIL in the local environment. Format: service-account@project.iam.gserviceaccount.com; example example-doc-reader@example-project.iam.gserviceaccount.com. Supply its JSON through GOOGLE_APPLICATION_CREDENTIALS; never commit the private key.

Required when using the described integration. The shipped `example-doc-reader@example-project.iam.gserviceaccount.com` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-linear-bot-email -->

`SYMPHONY_EXPECTED_LINEAR_EMAIL` — Validate the identity used for Linear writes.

Set SYMPHONY_EXPECTED_LINEAR_EMAIL in the local/host environment to the Linear bot account email; example linear-bot@example.invalid. Format: an email address.

Required when using the described integration. The shipped `linear-bot@example.invalid` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-linear-bot-email-regex -->

`SYMPHONY_EXPECTED_LINEAR_EMAIL_REGEX_FIXTURE` — Validate the identity used for Linear writes.

Keep this escaped email representation synthetic in regular-expression test assertions. Format: an email with escaped dots. No live credential or identity is required.

Optional. Default: `linear-bot@example\.invalid` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-symphony-commit-email -->

`SYMPHONY_GIT_AUTHOR_EMAIL` — Attribute host-created commits to the coding bot.

Set SYMPHONY_GIT_AUTHOR_EMAIL in the installer/local environment. Format: email; example symphony@example.invalid. Use the same value for author and committer.

Required when using the described integration. The shipped `symphony@example.invalid` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-symphony-commit-email-regex -->

`SYMPHONY_GIT_AUTHOR_EMAIL_REGEX_FIXTURE` — Attribute host-created commits to the coding bot.

Keep this escaped email representation synthetic in regular-expression test assertions. Format: an email with escaped dots. No live credential or identity is required.

Optional. Default: `symphony@example\.invalid` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-infra-source-reader-secret-name -->

`SYMPHONY_GOOGLE_SA_SECRET_ID` — Local setup locator for the Google Docs service-account JSON secret.

Setting: Store your Google service-account key JSON privately in AWS Secrets Manager. Set `SYMPHONY_GOOGLE_SA_SECRET_ID` for local setup and `SYMPHONY_GOOGLE_SECRET_ID` for the host credential installer to the same secret; align the host IAM allowlist with its name. These are the two existing inputs for the same payload. Local setup's `SYMPHONY_EXPECTED_GOOGLE_CLIENT_EMAIL` must match the key's `client_email`.

Format: A secret name, for example `symphony-google-service-account-json`. Its contents are a Google service-account JSON object with `type: service_account`, `project_id`, `private_key_id`, `private_key`, `client_email`, `client_id` and `token_uri`; this is a JSON key file, not a single API token. Never commit its contents.

Usage: The credential installer and local setup write the key file and set `GOOGLE_APPLICATION_CREDENTIALS` to its path. Share each source document or folder with the service-account email as Viewer. The included reader is `node scripts/fetch-google-doc.mjs <google-doc-url-or-id>`; it reads that key file, obtains a token and calls the Docs API without a separate gcloud login. These are setup instructions, not evidence of a successful setup run.

Required for the feature described above; the examples are synthetic and must be supplied with adopter-owned values before use.

<!-- redaction:a-infra-runtime-secret-name -->

`SYMPHONY_KEYS_SECRET_ID` — Secrets Manager locator for the Symphony runtime credentials.

Setting: Provision one runtime credential secret in AWS Secrets Manager. Use its name in the host IAM allowlist and `infra/static/modules/symphony-host/files/user-data.sh` secret_id; set `SYMPHONY_KEYS_SECRET_ID` for host bootstrap, the credential installer and local setup. Local setup refers to this same secret, not a second credential bundle.

Format: A secret name such as `symphony/runtime-credentials`; the AWS reads also accept a full Secrets Manager ARN. IAM constructs its own ARN from the secret name. Store a JSON object with nonempty string fields `GITHUB_TOKEN` (GitHub bot authentication), `LINEAR_API_TOKEN` (Linear access), and `OPENAI_API_KEY` (model-provider authentication). These are the three fields required by the credential installer; user data reads `GITHUB_TOKEN` to fetch the bootstrap source. Supply sensitive contents privately. The Google service-account JSON remains a separate secret.

Required for the feature described above; the examples are synthetic and must be supplied with adopter-owned values before use.

<!-- redaction:a-tool-runtime-repository -->

`SYMPHONY_RUNTIME_REPO` — Select the external Symphony runtime repository independently of the bootstrap repository.

Set SYMPHONY_RUNTIME_REPO in the host installer environment and select an immutable SYMPHONY_RUNTIME_REF. Format: owner/repository, for example example-org/symphony.

Required when using the described integration. The shipped `example-org/symphony` text is a placeholder, not a live account or repository.

<!-- redaction:a-tool-linear-team-fixture-identifier -->

`TEAM_FIXTURE_IDENTIFIER` — Keep the example team representation consistent with issue identifiers.

Keep this synthetic routing representation paired with the `DEMO` example team. Live team configuration is supplied through adopter-owned tooling configuration. Format: `issue-demo`.

Optional. Default: `issue-demo` (synthetic example).

<!-- redaction:a-tool-linear-team-fixture-symbol -->

`TEAM_FIXTURE_SYMBOL` — Keep the example team representation consistent with issue identifiers.

Keep this synthetic routing representation paired with the `DEMO` example team. Live team configuration is supplied through adopter-owned tooling configuration. Format: `demoIssue`.

Optional. Default: `demoIssue` (synthetic example).

<!-- redaction:a-tool-linear-team-routing-comparison -->

`TEAM_ROUTING_COMPARISON` — Keep the example team representation consistent with issue identifiers.

Keep this synthetic routing representation paired with the `DEMO` example team. Live team configuration is supplied through adopter-owned tooling configuration. Format: `normalize(issue.team?.key) === "demo"`.

Optional. Default: `normalize(issue.team?.key) === "demo"` (synthetic example).

<!-- redaction:a-tool-linear-team-routing-symbol -->

`TEAM_ROUTING_SYMBOL` — Keep the example team representation consistent with issue identifiers.

Keep this synthetic routing representation paired with the `DEMO` example team. Live team configuration is supplied through adopter-owned tooling configuration. Format: `isDemoIssue`.

Optional. Default: `isDemoIssue` (synthetic example).

<!-- redaction:a-infra-state-bucket -->

Terraform state bucket — S3 bucket holding the Symphony Terraform state.

Setting: Supply the bucket through your private Terraform backend configuration for `infra/static/backend.tf`.

Format: An S3 bucket name, for example `example-symphony-tfstate`; use a bucket you control.

Required for the feature described above; the example is synthetic and must be supplied with adopter-owned values before use.

<!-- redaction:a-infra-state-key -->

Terraform state object key — S3 object key separating the Symphony state from other infrastructure.

Setting: Supply the key in your private Terraform backend configuration for `infra/static/backend.tf`.

Format: An S3 object key, for example `symphony/terraform.tfstate`; select a dedicated key for this stack.

Required for the feature described above; the example is synthetic and must be supplied with adopter-owned values before use.

<!-- redaction:a-tool-package-scope -->

`TOOLING_PACKAGE_SCOPE` — Name the extracted tooling workspaces consistently.

If renaming the synthetic @example scope, update the copied package manifests and their workspace command references together. Format: @scope/package; example @example/symphony-dag.

Optional. Default: `@example/` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-root-package-name -->

`TOOLING_ROOT_PACKAGE` — Name the private tooling workspace root.

Keep symphony-tooling or choose a name in package.json. Format: a valid npm package name; example symphony-tooling.

Optional. Default: `"name": "symphony-tooling"` (synthetic example; no live identifier is needed for fixtures).

<!-- redaction:a-tool-workpad-requirement-key -->

`WORKPAD_REQUIREMENT_KEY` — Replace a private planning identifier prefix in examples and fixtures.

Keep these planning keys synthetic. Use your own payload keys only in adopter-owned project plans. Format: a stable textual prefix plus a numeric suffix.

Optional. Default: `WORKPAD-` (synthetic example; no live identifier is needed for fixtures).

<!-- END GENERATED -->
