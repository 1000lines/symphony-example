# Symphony Runtime Bundle

This directory supplies the personal instructions, skills and workflow used by
the host installer in `scripts/symphony/host/`. The executable Symphony runtime
is a separate dependency. Bundle files live outside ordinary repository skill
discovery and are installed into the runtime user's personal Codex home.

## Source and installed files

`manifest.json` identifies the bundle and shared skill links. The loader copies
the bundle tree, discovers private skills under `skills/`, and records installed
files separately; the source manifest is not a file-by-file install recipe.
The skill bodies under `skills/` are canonical; no
matching common `.codex/skills` copies are required. The installer also stages
`karpathy-guidelines` and `linear-graphql` from the repository's `.agents/skills`.
The human-only `symphony-project-factory` skill is excluded from the unattended
profile. There are no shipped executable wrappers; `45-runtime-bundle.sh`
generates `codex-with-runtime-bundle.sh` during installation.

The loader stages releases by bootstrap repository SHA, copies personal
`AGENTS.md` and `config.toml`, links the selected skills, and writes a separate
`runtime-bundle-manifest.json` with installed provenance. The source manifest
contains no installed checksums. `lib.sh:sha256_tree` hashes concatenated file
contents in sorted relative-path order; filenames determine order but are not
themselves hashed. Shared skills have separate recorded digests and are outside
the bundle freshness digest. Use a new source commit for a changed release:
an already staged repository SHA is reused. These checks do not establish that
the runtime can start or that external services are configured.

## Workflow source migration

`workflow/WORKFLOW.md` in this bundle is the single repository source for hosted
and local execution. The former root `WORKFLOW.md` has been removed. Host
installation still renders `/etc/symphony/WORKFLOW.md` from the staged bundle,
falling back to this bundle's source before staging; the rendered file and staged
release are installation artifacts, not independently maintained profiles.
The systemd service passes that rendered path explicitly. There is no fallback
to a root workflow. Replace local commands that pass the deleted root
`WORKFLOW.md` or rely on implicit path discovery with an explicit source path; use
the [local invocation](../../../docs/engineering/symphony/tooling-setup.md#repository-workflow-and-guardrails).

`SYMPHONY_WORKFLOW_SOURCE` selects a complete operator-owned override for the host
renderer and documented local invocation. It takes precedence over the default;
no merging or automatic migration occurs. Remove an override that only selected
the old root path, or update it to the nested source. For customized files,
compare against the authoritative source and retain deliberate environment
settings. The old `after_create` hook cloned a fixed repository and required
`GITHUB_TOKEN`, `LINEAR_API_TOKEN`, and an executable `GIT_ASKPASS`. Move that setup
to repository discovery and bound credentials, install the repository skill, and
make shared tooling available through `SYMPHONY_TOOLING_ROOT`. Review the worker
model change from GPT-5.5 to GPT-6 Astra, both with xhigh reasoning.
Repository-specific hooks remain an operator choice.
Default hooks are no-ops; required PR labels are verified during publication.

If the selected source is missing, host rendering aborts with `workflow source
is missing` before replacing `/etc/symphony/WORKFLOW.md`. The last rendered file
remains intact; a failed render does not update or reload the running service.

The retained CI profile uses `Unhappy` with `wake:15m`, dispatches `Evaluating`,
and caps concurrent evaluations at one. Supply `Active`, `Inactive`, `Unhappy`,
`Evaluating`, and the `wake:15m` label in the configured Linear team before
enabling CI reconciliation. The GitHub workflow requires the wake label even
when removing it on success or failure. Reconcile older overrides that still
disable these states or tell workers to sleep while CI runs; otherwise they
will not provide the server timer behavior described by the source profile.

For an existing host, `scripts/symphony/host/install-runtime.sh
--runtime-bundle-refresh` runs `05-source`, `45-runtime-bundle`, `80-config`, and
`90-provenance`. It stages the selected source and renders
`/etc/symphony/WORKFLOW.md`; it does not restart the service. Select an accepted
source and refresh and reload through the authorized deployment procedure.
Running only `45-runtime-bundle` does not render the workflow. Custom overrides
and later reconciliation need the same explicit source setting. A source edit,
merge, or fixture test is not
proof that a running host loaded the new workflow; deployment is a separate
operator action with its own evidence.

## Repository discovery and onboarding

The hosted `symphony-repository` skill resolves each target from its Linear
project or explicit task direction. The startup hook leaves an empty workspace;
the worker clones the selected repository and chooses its setup commands.
There is no controller-side repository list. GitHub App installations determine
available access, and the credential broker's `bind` command produces a private,
per-task configuration from live repository/installation discovery. The existing
AWS signing secret remains compatible; adding a repository needs no new secret
or Terraform change when the App already has access to it.

Repositories own `.symphony.cfg.json`; see the skill's
[configuration reference](skills/symphony-repository/references/config.md).
The worker reads configuration from the fetched selected base commit. Missing
configuration is inferred from repository evidence and proposed for review:
PR first, GitHub issue if branch/PR writes are denied, then the pinned Linear
workpad if GitHub publication is unavailable. Proposed rules are not active
until merged into the selected base. `AGENTS.md` remains working guidance.

Read the target's README, applicable AGENTS/CLAUDE guidance, toolchain files and
`.github` workflows. Repository selection has no hardcoded clone target;
commands and required CI come from each target's selected base. The installed
config helper and App broker provide this interface without executable hooks.

In App mode, `40-credentials` installs `github-app-auth.mjs`, the `gh` adapter
and Git askpass outside the checkout. Follow the repository skill's `bind` and
resume-preflight steps before Git/CLI access, using a private task config under
`SYMPHONY_GITHUB_APP_CACHE`. Never overwrite the shared signing configuration,
reuse another task's binding or borrow a PAT after denial. Credential installation
also requires explicit App bot author email, human login, Cadence App ID/slug and
the real `gh` binary; the adapter clears inherited legacy token variables.

The freshness wrapper exports `SYMPHONY_TOOLING_ROOT` for shared tools and docs
outside the target checkout. Label repair runs as part of the worker's publish
steps with the actual target and its bound credentials, using
`$SYMPHONY_TOOLING_ROOT/scripts/symphony/ensure-pr-labels.mjs`. The after-run hook
no longer edits a fixed controller repository using controller credentials.

Deploy the accepted bundle and updated App credential broker together. For a
running host this requires the accepted checkout's `40-credentials` (in App
mode), `45-runtime-bundle` and `80-config` installation steps, plus the normal
service reload. Merging the source does not activate it on an existing host.
Operator-supplied `SYMPHONY_WORKFLOW_SOURCE` overrides need equivalent updates.

Normal acceptance requires passing required CI and a fresh Cadence review of
the current head, closed mandatory feedback, a clean branch and ready PR. The
[native review contract](../../../docs/engineering/review/cadence-ai-review.md#acceptance-contract)
describes the Claude reviewer's PR-review output and workpad. Run local tests
first, Docker only for an environment gap, then mandatory CI on the published
head. Source/staged/rendered fixtures prove installation behavior; they do not
prove host reload, App grants, provider execution, or a timer wake.

## Human feedback and replanning

The installed `symphony-replan` skill follows the
[replanning guide](../../../docs/engineering/symphony/replanning.md): apply small
node changes directly; create a replanning ticket and dependent fan-out ticket
for larger changes, using the existing templates. Install the accepted runtime
bundle and workflow to activate these instructions on an existing host.

## Supplying host settings

The existing installer inputs are environment variables; it does not
automatically read an installer configuration file. An operator can keep trusted,
nonsecret `NAME=value` settings in an owned file such as
`/etc/symphony/installer.env` and export them in the shell launching bootstrap
or a standalone install step. Do not edit the shipped scripts to set those
inputs. Secret payloads belong in the credential store described below.

Reconciliation is a separate process. The shipped reconcile systemd unit has
no installer `EnvironmentFile`, and `runtime.env` is generated for the runtime
service, not a persistent copy of all installer inputs. Arrange the same settings
for later launches, for example with an operator-owned systemd drop-in for
`symphony-reconcile.service`. A shell-only override is not a reboot configuration.
The following locations describe the retained defaults and the points needing
operator setup; they are not an installation guarantee.

## Source repositories and runtime

Set `SYMPHONY_BOOTSTRAP_REPO` and `SYMPHONY_RUNTIME_REPO` to GitHub
`owner/repository` names for the tooling source and executable runtime source,
respectively. Their shipped values are synthetic placeholders. Select immutable
commit IDs with `SYMPHONY_BOOTSTRAP_REF` and `SYMPHONY_RUNTIME_REF`. Both refs are
required: `lib.sh` uses the explicit environment first, then EC2 tags
`symphony:bootstrap-ref` and `symphony:runtime-ref`, and fails if neither supplies
a value. The scripts accept other Git refs but do not enforce immutability.
`bootstrap.sh` initially clones the repository's default branch; `05-source.sh`
then synchronizes the selected bootstrap ref.

`70-symphony-escript.sh` expects `mix.exs` at the runtime repository root or in
`elixir/`. It installs Hex/Rebar, resolves production dependencies and runs
`mix escript.build`. `SYMPHONY_RUNTIME_ESCRIPT_NAME` is optional and defaults to
`symphony`; the build must produce that executable in `bin/`, the build root,
or `_build/prod/escript/`. `SYMPHONY_RUNTIME_BUILD_HOME` defaults to a
`runtime-build-home` directory beneath the bootstrap state directory.

`SYMPHONY_RUNTIME_BIN_SOURCE` optionally names an existing executable file.
That path bypasses the Mix build only: the current code still requires and
synchronizes the runtime checkout first. No runtime source, binary, or known
compatible runtime revision is bundled here. Matching the workflow schema and
service command-line options to the selected external runtime remains setup work.

## Host layout and prerequisites

`10-os-packages.sh` installs the Amazon Linux Docker package.
`35-docker.sh` enables Docker after the workspace volume is mounted, stores its
data under `/var/lib/symphony/docker`, and gives the existing runtime group
access to the local Unix socket. Docker access grants host-level control to
that trusted runtime account. No Docker TCP listener is configured. Existing
Docker configurations/data that conflict with these settings require explicit
reconciliation; the installer does not move or delete them. Package-skipping
fixtures also skip Docker setup. Use container tests alongside repository CI.
Installation follows the [AWS Docker package guidance](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/create-container-image.html);
storage and socket settings use the [Docker daemon configuration](https://docs.docker.com/reference/cli/dockerd/).

The scripts assume Linux, systemd, GNU filesystem utilities and root installation.
`10-os-packages.sh` installs packages through `dnf` when available; its fallback
only checks a few commands and does not provision another distribution. Bootstrap
itself needs `curl`, `jq` and Git before the package step. The later steps also use
AWS CLI, `flock`, `findmnt`, `blkid`, `lsblk`, XFS tools, archive tools and BEAM
build dependencies. Node supports Linux x64/arm64; `60-dev-tools.sh` has its own
platform restrictions. Adapting a different host image remains operator work.

The following optional defaults in `host/lib.sh` can be overridden in the installer
environment:

| Inputs                                                                                                                     | Defaults and purpose                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SYMPHONY_RUNTIME_USER`, `SYMPHONY_RUNTIME_GROUP`                                                                          | `symphony` / `symphony`; runtime account and file ownership. The user step creates a system account with workspace home and a non-login shell.         |
| `SYMPHONY_OPT_ROOT`                                                                                                        | `/opt/symphony`; immutable releases, source checkouts and tool installations.                                                                          |
| `SYMPHONY_RELEASES_DIR`, `SYMPHONY_CURRENT_LINK`, `SYMPHONY_BOOTSTRAP_BIN_DIR`, `SYMPHONY_SRC_ROOT`, `SYMPHONY_TOOLS_ROOT` | Respectively `releases`, `current`, `bootstrap`, `src`, `tools` beneath the opt root. Each accepts an absolute path override.                          |
| `SYMPHONY_CONFIG_DIR`, `SYMPHONY_SYSTEMD_DIR`                                                                              | `/etc/symphony`, `/etc/systemd/system`; generated runtime files and service units.                                                                     |
| `SYMPHONY_BOOTSTRAP_STATE_DIR`, `SYMPHONY_BOOTSTRAP_LOG_DIR`                                                               | `/var/lib/symphony-bootstrap`, `/var/log/symphony-bootstrap`; root-owned state/markers and bootstrap logs. Keep state outside the workspace mount.     |
| `SYMPHONY_WORKSPACE_ROOT`, `SYMPHONY_LOGS_ROOT`                                                                            | `/var/lib/symphony`, `/var/log/symphony`; persistent workspace/cache and runtime logs.                                                                 |
| `SYMPHONY_TEMPLATES_DIR`, `SYMPHONY_STEPS_DIR`, `SYMPHONY_HOOKS_DIR`                                                       | `templates`, `install.d`, `hooks.d` beside `host/lib.sh`; optional operator-owned directories. Steps/hooks are executable Bash files in lexical order. |
| `SYMPHONY_INIT_WORKSPACE_SCRIPT`                                                                                           | `infra/static/modules/symphony-host/files/init-workspace-volume.sh` beneath the tooling root; optional replacement executable path.                    |

Checkout subdirectory names remain fixed in `bootstrap.sh` and `lib.sh`.
`reconcile.sh` also retains absolute defaults for the bootstrap and installer
entrypoints. When relocating a host, supply `SYMPHONY_BOOTSTRAP_SCRIPT` and
`SYMPHONY_INSTALLER_SCRIPT` as executable paths to reconciliation. The generated
freshness wrapper accepts `SYMPHONY_RUNTIME_BUNDLE_INSTALLER` for its installer
path. Check the service templates and writable paths together; changing one
root variable alone does not relocate every launch path.

The workspace step expects an existing filesystem labeled `SYMPHONYWS` or an
explicit `SYMPHONY_WORKSPACE_DEVICE` such as `/dev/xvdf`; inspect the volume
helper before allowing it to initialize a device. `SYMPHONY_WORKSPACE_LABEL`
changes discovery's label, while the helper retains its own label default.
`SYMPHONY_WORKSPACE_DEVICE_WAIT_TIMEOUT_SECONDS` and
`SYMPHONY_WORKSPACE_DEVICE_WAIT_INTERVAL_SECONDS` default to `180` and `5`.
These are positive integer seconds, except the timeout may be zero. Label and
path changes need to agree with the volume helper's inputs.

AWS region, instance ID and AMI ID come from EC2 metadata unless supplied as
`SYMPHONY_AWS_REGION`, `SYMPHONY_INSTANCE_ID` and `SYMPHONY_AMI_ID`.
`SYMPHONY_GITHUB_BASE_URL` and `SYMPHONY_GITHUB_API_URL` override the ordinary
GitHub web/API endpoints in bootstrap/library code. The credential step and
workflow still contain public-GitHub-specific configuration; these two overrides
alone do not establish enterprise-host support.

## Toolchain and service settings

| Input / setting location                                                                                  | Default and format                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SYMPHONY_ERLANG_VERSION`, `SYMPHONY_ELIXIR_VERSION` in `host/lib.sh`                                     | `28.5.0.5`, `1.19.5-otp-28`; matching Erlang release and Elixir release/OTP strings.                                                                            |
| `SYMPHONY_MISE_BIN` in `host/lib.sh`                                                                      | `bin/mise` beneath the tools root; existing executable path, with PATH discovery taking precedence. Otherwise the step downloads the installer from `mise.run`. |
| `SYMPHONY_MISE_DATA_DIR`, `SYMPHONY_MISE_CONFIG_DIR`, `SYMPHONY_MISE_CACHE_DIR` in `50-beam-toolchain.sh` | `mise`, `mise-config`, `mise-cache` beneath the tools root; absolute directory overrides.                                                                       |
| `SYMPHONY_MISE_JOBS`, `SYMPHONY_MISE_ERLANG_COMPILE` in `50-beam-toolchain.sh`                            | `1`, `1`; build parallelism and compile switch. `KERL_CONFIGURE_OPTIONS` retains the headless build flags shown in that file.                                   |
| `SYMPHONY_ELIXIR_INSTALL_DIR` in `50-beam-toolchain.sh`                                                   | `mise/installs/elixir/<version>` beneath the tools root; optional absolute directory override.                                                                  |
| `.nvmrc`, `package.json` `packageManager`                                                                 | Required root files for `55-node-toolchain.sh`: exact `vMAJOR.MINOR.PATCH` and `npm@MAJOR.MINOR.PATCH`. There is no Node/npm environment override in that step. |
| `SYMPHONY_CODEX_VERSION` in `55-node-toolchain.sh`                                                        | `0.153.4`; optional package version. `install_codex` sets `NPM_CONFIG_MIN_RELEASE_AGE=0` only for its Codex npm install.                                        |
| `SYMPHONY_GH_VERSION`, `SYMPHONY_TERRAFORM_VERSION` in `60-dev-tools.sh`                                  | `2.97.0`, `1.4.2`; optional release version strings.                                                                                                            |
| `SYMPHONY_INSTALL_NPM_CACHE` in `55-node-toolchain.sh`                                                    | `npm-cache` beneath the tools root; installer cache directory, distinct from the runtime workspace npm cache.                                                   |
| `SYMPHONY_SERVICE_PORT` in `host/lib.sh`                                                                  | `4000`; runtime CLI port. Keep network and workflow server settings aligned.                                                                                    |
| `SYMPHONY_WORKER_SLOTS` or EC2 `symphony:worker-slots` tag                                                | Optional integer `1`–`64`, default `6`; environment takes precedence over the tag. The renderer replaces `agent.max_concurrent_agents` in workflow frontmatter. |

The Erlang installer explicitly installs with at most three attempts, delays of
5 and 10 seconds, and checks the installed `erl` binary before recording success.
The marker prevents repeating installation for the same Erlang/Elixir pair.
The associated failure, recovery and rerun cases remain in the installer tests.
The Node install step and its regression source agree on Codex `0.153.4` and
the scoped release-age bypass. `host/lib.sh:runtime_codex_version` reports the
installed binary first; if it cannot, it uses `SYMPHONY_CODEX_VERSION` or the
older `0.147.0`. This reporting fallback differs from the install default and
remains unresolved. The hosted workflow's `codex.command`
retains `gpt-6-astra` with `model_reasoning_effort=xhigh`. Change worker policy
in the operator-owned workflow; this snapshot makes no runtime compatibility
claim. The host label-repair test imports `js-yaml`, which is not directly
declared in the tooling manifests. Dependency setup for that optional suite
remains later work.
Fixture switches such as `SYMPHONY_SKIP_RUNTIME_INSTALL` are not usable runtime
defaults; that switch produces a stub executable.

## PR label repair

The worker uses `node "$SYMPHONY_TOOLING_ROOT/scripts/symphony/ensure-pr-labels.mjs"`
with `--issue TEAM-123 --repo owner/repository` for the resolved target. It reads
`project-color` from the owning Linear project, adds missing `symphony` and color
labels to the uniquely associated open PR, and verifies them by readback. Labels
must already exist. Use the target's bound GitHub credentials and Linear read
access (`LINEAR_API_TOKEN`, falling back to `LINEAR_API_KEY`).

The bundled `after_run` hook is a no-op. Operators who enable optional hook
repair must resolve the same issue/repository and bind the matching credentials;
installer repository inputs do not rewrite hook text. A best-effort hook result
does not replace the worker's explicit publication verification.

## Workflow, bundle and credentials

`SYMPHONY_WORKFLOW_SOURCE` optionally selects an operator-owned Markdown workflow.
By default `80-config.sh` uses the staged bundle's `workflow/WORKFLOW.md`, falling
back to the source bundle. A supplied file needs YAML frontmatter with exactly
one indented numeric `max_concurrent_agents` line and one `command: codex` line
so the renderer can substitute worker slots and the freshness wrapper.

Configure `tracker` team/state/maturity mappings, `workspace.root`, `hooks`,
the `codex` command and `server` settings in an operator-owned override as needed.
The bundled hooks default to `true`; the repository skill selects checkout,
setup and publication steps after reading the issue/project context. Optional
misc routing reads `linear.teamKey` from the checkout's `.symphony.cfg.json` and
accepts `lookup.teamKey` in exported functions; assess its project/color policy
before enabling it. These hooks do not define a required product language or
application CI.

The shared review wake helper chooses `Active` first and legacy `Rework` only
when `Active` is absent. The CI YAML instead requires the exact states and wake
label listed in the migration section. Configure these in Linear, not just
runtime state lists. The DAG parser no longer accepts integration-branch/frontier
policies. The profile still carries `mature` and maturity state lists: these
require a compatible external runtime and explicit project policy, not a
replacement integration queue. Projects that disable maturity must arrange a
compatible profile/runtime before execution. Runtime repair is deferred.

`SYMPHONY_RUNTIME_BUNDLE_SOURCE_DIR` optionally selects a complete operator-owned
bundle directory using the same schema and required source files; its default
is this directory. This is also the existing way to supply personal instruction
or Codex template changes. The loader copies `codex/config.toml.template`
verbatim; it is not a general template renderer. The installed personal config
and skill links are replaced on refresh, so edits to installed files do not
persist. Shared-skill source paths still resolve against the tooling repository.

`SYMPHONY_RUNTIME_BUNDLE_CACHE_DIR` defaults to
`$SYMPHONY_WORKSPACE_ROOT/cache/runtime-bundle`. Optional
`SYMPHONY_RUNTIME_BUNDLE_RELEASES_DIR`, `SYMPHONY_RUNTIME_BUNDLE_CURRENT_LINK` and
`SYMPHONY_RUNTIME_BUNDLE_LOCK_PATH` default to its `releases`, `current` and
`runtime-bundle.lock` children. `SYMPHONY_CODEX_HOME` defaults to
`$SYMPHONY_WORKSPACE_ROOT/cache/codex-home` (the loader can also read the generated
`CODEX_HOME` from `runtime.env`). All these overrides are absolute paths.

Provision `SYMPHONY_KEYS_SECRET_ID` with JSON containing nonempty string fields
`GITHUB_TOKEN`, `LINEAR_API_TOKEN` and `OPENAI_API_KEY`, and
`SYMPHONY_GOOGLE_SECRET_ID` with a Google service-account key JSON object.
The values are required by `40-credentials.sh`; the source's secret names are
placeholders, and the host role needs permission to read the selected secrets.
Set bot identity and repository-owner inputs in the installer environment as
described by the root setup reference. The credential step writes `runtime.env`,
the Google key file and personal authentication files; it overwrites its own
outputs on rerun. Supplying `SYMPHONY_GITHUB_TOKEN` only bypasses bootstrap's
initial token lookup, not the later full credential requirements.

No hooks are shipped by default. To add host installation steps, select an
operator-owned `SYMPHONY_HOOKS_DIR` containing executable Bash hooks. They run in
lexical order after the core install steps; a failing hook fails installation.
An absent or empty hooks directory is skipped.
