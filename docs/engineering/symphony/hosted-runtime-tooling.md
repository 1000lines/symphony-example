# Hosted Runtime Tooling


## Runtime Bundle Source

The repo-owned source for the personal runtime is
`scripts/symphony/runtime-bundle`. Keeping it under `scripts/symphony` prevents
ordinary repo discovery from loading hosted-only instructions or skills when an
engineer opens the checkout.

The bundle source contains:

- `manifest.json`, which declares install destinations, owner/mode policy,
  checksum rules, private skills, shared skill links, and excluded human-only
  tools.
- `codex/AGENTS.md`, installed as `$CODEX_HOME/AGENTS.md` for the hosted
  `symphony` user.
- `codex/config.toml.template`, installed as `$CODEX_HOME/config.toml`.
- `workflow/WORKFLOW.md`, rendered to `/etc/symphony/WORKFLOW.md`.
- `skills/`, installed into `$CODEX_HOME/skills` as the hosted-only skill set,
  plus linked shared skills that are safe for unattended workers.

The default unattended profile installs `karpathy-guidelines` and
`linear-graphql` from `.agents/skills`. It intentionally excludes the human-only
`symphony-project-factory` skill and any human-operated host-maintenance skill.
Host replacement, startup recovery, and Terraform cold restore remain
human-operated procedures in `docs/operations/symphony-host.md`.

## Loader Install

The host installer stages and activates the runtime bundle in
`scripts/symphony/host/install.d/45-runtime-bundle.sh`.

Install flow:

1. Validate that the bundle source exists and that `manifest.json` has schema
   `symphony-runtime-bundle/v1`.
2. Create a release directory under
   `$SYMPHONY_WORKSPACE_ROOT/cache/runtime-bundle/releases/<repo-sha>/`.
3. Copy the bundle source into that release and copy approved shared skills
   into the release's `shared-skills/` directory.
4. Normalize directory and file modes, then atomically repoint
   `$SYMPHONY_WORKSPACE_ROOT/cache/runtime-bundle/current` to the release.
5. Stage a new personal runtime under `$CODEX_HOME/.bundle-next.*`.
6. Install `$CODEX_HOME/AGENTS.md`, `$CODEX_HOME/config.toml`,
   `$CODEX_HOME/runtime/bin`, `$CODEX_HOME/runtime-bundle-manifest.json`, and a
   fresh `$CODEX_HOME/skills` tree.
7. Verify staged files and skill links, then atomically swap the staged
   `$CODEX_HOME/skills` tree into place.

Private and shared skills are installed as links to the active runtime-bundle
release. Duplicate skill names fail the install. The personal Codex config is
mode `0600`; the personal instruction file and installed manifest are mode
`0644`; runtime wrappers are executable.

## Refresh And Freshness

Use the host-management path, not an ad hoc edit inside `$CODEX_HOME`, when the
installed runtime needs to pick up a new repo ref.

`scripts/symphony/host/install-runtime.sh --runtime-bundle-refresh` runs only
the steps needed for a lightweight refresh:

- `05-source`
- `45-runtime-bundle`
- `80-config`
- `90-provenance`

The refresh runs under the runtime-bundle lock, stages a new release, swaps the
active release link, installs the personal runtime, and rewrites provenance.
When `05-source` moves the checkout, the installer re-execs so the remaining
steps come from the updated source.

`$CODEX_HOME/runtime/bin/codex-with-runtime-bundle.sh` is the freshness guard.
Before invoking `codex`, it runs:

```sh
scripts/symphony/host/install-runtime.sh --check-runtime-bundle-fresh
```

If the installed bundle is stale, the wrapper fails closed and prints the
refresh command to run. Codex reads instructions at process start, so a refresh
only affects new hosted worker runs after the current agent exits or restarts.

For human host operations, build the host CLI and run `reconcile --yes` only
after the required approval gates in `docs/operations/symphony-host.md` are
satisfied. The reconcile command restarts `symphony-reconcile.service`, waits
for the SSM command to finish, and prints runtime-bundle freshness plus service
and HTTP readiness evidence.

## Provenance

The installer writes `$CODEX_HOME/runtime-bundle-manifest.json` during bundle
activation. `scripts/symphony/host/install.d/90-provenance.sh` then writes
`/var/lib/symphony-bootstrap/provenance.json` and fails closed if required
fields are missing or inconsistent.

Runtime provenance records:

- installer path and checksum;
- host instance, AMI, and region;
- selected bootstrap and runtime refs, resolved SHAs, and checkout paths;
- Codex version, `$CODEX_HOME`, and config path;
- runtime bundle repo SHA, bundle checksum, manifest checksum, workflow-source
  checksum, release path, current link, current target, installed manifest path,
  installed manifest checksum, and installed skills;
- credential-presence checks and their manifest checksum.

The runtime-bundle repo SHA must match the bootstrap checkout SHA. Provenance
records credential presence, not secret values. Do not paste credential files,
secret strings, or expanded environment values into Linear, GitHub, or operator
logs.

Expected reconcile evidence includes:

- `Reconciliation provenance:` with the host provenance JSON;
- `Runtime bundle freshness: installed bundle matches current source`;
- `Symphony service readiness: symphony.service active`;
- `Symphony HTTP readiness: ok`.

## Common-Path Cutover

The common-path cutover separates repo-wide agent guidance from hosted
Symphony-only automation.

Supported common discovery after cutover:

- `.agents/skills/karpathy-guidelines`
- `.agents/skills/linear-graphql`
- `.agents/skills/symphony-project-factory`, only when a human explicitly asks
  to create or reshape a Symphony project
- package-local `AGENTS.md` files that contain ordinary repo guidance
- Claude Code shared skills that are not Symphony-private

Supported hosted-only discovery:

- `$CODEX_HOME/AGENTS.md`
- `$CODEX_HOME/config.toml`
- `$CODEX_HOME/skills/<private-skill>`
- `$CODEX_HOME/runtime/bin`
- `/etc/symphony/WORKFLOW.md`
- `$CODEX_HOME/runtime-bundle-manifest.json`

Private runtime skills must not remain loadable from `.codex/skills` or another
ordinary checkout path after cutover. `symphony-update-hosted-runtime` remains
human-operated and outside the default unattended hosted bundle.
