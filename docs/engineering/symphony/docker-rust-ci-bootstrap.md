# Compose bootstrap and ticket Docker execution

[100-87](https://linear.app/1000lines/issue/100-87) implements BOOT from the
[accepted design](../../symphony-plans/docker-rust-ci/requirements-and-design.md)
and [plan](../../symphony-plans/docker-rust-ci/fan-out-plan.md), accepted at
`dcafa8d17959762945e760bb5ddf2c38c8b6a0cb`. Its branch starts from
`main@49403712a566d66a9867da88b2ae390663ecdf9b`. The BOOT PR/workpad records the
tested implementation SHA; DEPLOY must select an accepted merged source SHA
containing BOOT and its other prerequisites before any shared-host change.

## Installed behavior

`scripts/symphony/host/install-runtime.sh --only 35-docker` installs Compose
**v2.39.4** at `/usr/local/lib/docker/cli-plugins/docker-compose`, Docker's
[system plugin location](https://docs.docker.com/compose/install/linux/).
`SYMPHONY_DOCKER_CLI_PLUGIN_DIR` permits an isolated fixture destination; a live
override must already be discoverable by the installed Docker CLI.

| Linux architecture   | Release asset                | SHA-256                                                            |
| -------------------- | ---------------------------- | ------------------------------------------------------------------ |
| x86_64               | docker-compose-linux-x86_64  | `7af95166a730b87e172d4fc9aefea8725d3c6c7327d59149267b452114ddb7d4` |
| aarch64 (also arm64) | docker-compose-linux-aarch64 | `49082844b87f03cdcd5f5bbef1ba8c9c897b7a2dfb80cea18d61ec8ca6117e0c` |

The step verifies downloaded bytes before publishing an executable plugin.
Reruns verify and retain matching installed bytes without downloading again.
Unsupported architectures, checksum failures and conflicting existing plugins
fail the step. CLI metadata identifies installer-user and runtime-user candidates,
including shadowed plugins; conflicts require operator reconciliation and are
never overwritten. Runtime-user discovery uses that account's default Docker
config when switching users. DEPLOY also checks the actual new worker's config.
The installer verifies `docker compose version --short` for both identities
before continuing with existing daemon data-root, socket group and workspace
mount ordering. `SYMPHONY_SKIP_PACKAGES=1` still skips the whole Docker step.

An explicit ticket Docker requirement takes precedence over configured `native`
or `remote`, including when native tests pass. Record configured mode (or omitted
native default), effective `docker`, and the issue section/human comment URL
requiring it. Execute the ticket's explicit command arrays and accepted workload
recipes under `SYMPHONY_TOOLING_ROOT`. No reader/schema/renderer change, automatic
wrapping or repository-wide mode change occurs. Without a ticket override,
native, docker and remote behavior remains unchanged. Implementation fixtures
may pass locally; that does not waive the later Docker acceptance workloads.

## Handoff to DEPLOY / Jeremy

[100-91](https://linear.app/1000lines/issue/100-91) owns the exact host identity,
operator window, accepted bootstrap/runtime refs, rollback refs and full rollout
runbook. Target: Jeremy's hosted Symphony installation of
`1000lines/symphony-example`. BOOT has no shared-host write authority and attempted
no live install. Required authority is Jeremy's existing host administration;
GitHub App grant expansion is not needed for this step.

After draining workers through the existing operator procedure, Jeremy uses the
existing trusted installer environment with explicit immutable
`SYMPHONY_BOOTSTRAP_REF` and `SYMPHONY_RUNTIME_REF`. Keep the runtime ref unchanged
unless DEPLOY explicitly selects another accepted ref. On the existing host,
run from its tooling checkout with that environment exported in the root shell:

```bash
bash scripts/symphony/host/install-runtime.sh --runtime-bundle-refresh
bash scripts/symphony/host/install-runtime.sh --only 35-docker
bash scripts/symphony/host/install-runtime.sh --only 35-docker
```

Capture each exit/log and stop on failure. Refresh runs source/bundle/config/
provenance steps; it neither installs Compose nor reloads Symphony. DEPLOY must
explicitly perform and record the service reload after installation, including
any operator workflow override migration. A replacement/rehearsal host uses the
full installer. Preserve the existing Docker data and operator plugins during
rollback; DEPLOY records restoration commands for its actual previous refs.

In a **new worker**, collect these nonsecret readbacks without sourcing or
printing credential files:

```bash
id
uname -m
docker --version
docker compose version --short
docker info --format '{{json .ClientInfo.Plugins}}'
sha256sum /usr/local/lib/docker/cli-plugins/docker-compose
git -C "$SYMPHONY_TOOLING_ROOT" rev-parse HEAD
jq '{repo, bundle}' "$CODEX_HOME/runtime-bundle-manifest.json"
sha256sum /etc/symphony/WORKFLOW.md
node "$CODEX_HOME/skills/symphony-repository/scripts/config.mjs" inspect "$PWD" main
```

Run config inspection in the implementation checkout after fetching `main`.
Retain selected-base revision and configured mode from its JSON output; absence
of output is a failure. Verify the installed reader accepts native/docker/remote
and rejects invalid modes with DEPLOY's workspace fixtures. Have that worker read
its installed instructions and record a Docker-required ticket's effective mode
and override source; parser acceptance alone does not demonstrate instruction
following. Record installed instruction/reader hashes, worker identity and
Jeremy's nonsecret bootstrap/runtime provenance projection alongside these logs.
Expected Compose version is `2.39.4` and its discovered path/hash must match the
selected architecture above. An arm64 plugin fixture is not arm64 workload proof.

BOOT's stub fixtures test installation and failure behavior without touching a
live daemon or installed plugin. They simulate release downloads/checksums and
user discovery. Passing fixtures and implementation CI do not establish host
reload, installed provenance or either full workload; DEPLOY and the later
execution/replay tickets own that evidence.
