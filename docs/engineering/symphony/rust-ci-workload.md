# Pinned Rust workload

This durable adapter packages the Rust workload defined by the
[accepted design](../../symphony-plans/docker-rust-ci/requirements-and-design.md#rust-workload-contract)
for [100-89](https://linear.app/1000lines/issue/100-89). It builds
`jeremycarroll/venn-search-rs@99528c2e4da241ec2c9961d0a155357611f16a76`
in Docker. Source acquisition and Docker orchestration run on the host.
The upstream checkout remains unchanged; a source archive receives only the
generated Cargo.lock. No host Rust installation is needed.

## Prepare once

Use Node 20.20.0, Docker, Git, tar and gzip on Linux amd64. Run as the workspace
owner. Queue Rust while Redis is running unless Jeremy confirms aggregate
CPU/memory/disk headroom. Check `docker ps`, available memory and workspace disk
before execution. The example allocates two CPUs, 4 GiB RAM (no extra swap) and
256 PIDs per container; select explicit limits appropriate to the worker.
Allow several GiB of disk for the image archive and fresh compiled caches.

From the implementation checkout inside the issue workspace:

```bash
git clone https://github.com/jeremycarroll/venn-search-rs.git ../venn-search-rs
git -C ../venn-search-rs checkout --detach 99528c2e4da241ec2c9961d0a155357611f16a76
rust_workspace=$(realpath ..)
node scripts/symphony/ci/rust-workload/runner.mjs prepare \
  --workspace "$rust_workspace" --source ../venn-search-rs \
  --lock scripts/symphony/ci/rust-workload/Cargo.lock \
  --output ../rust-bundle --issue 100-89 --run prepare-1 \
  --cpus 2 --memory 4g --pids 256
```

The checked-in lock was generated with this toolchain during development, not
supplied by upstream. `prepare` reuses an existing `--lock`; if absent, it runs
`cargo generate-lockfile` once and writes the retained lock exclusively. It
then runs `cargo fetch --locked`. Never regenerate a lock to conceal a workload
failure. All paths must be beneath the issue workspace; output directories
must not exist, and their parents must exist.

The exact image build is recorded in `image-build.log` and `index.json`:

```bash
docker build --platform linux/amd64 \
  --label drc.owner=drc-100-89-prepare-1-rust \
  --iidfile ../rust-bundle/image.id scripts/symphony/ci/rust-workload
```

The Dockerfile derives from
`rust@sha256:7fa728f3678acf5980d5db70960cf8491aff9411976789086676bdf0c19db39e`
and installs clippy/rustfmt for 1.90.0. Five worker-UID probes retain compiler,
Cargo, clippy, rustfmt and installed-component output. The image's
`/usr/local/rustup` is preserved; only Cargo/home/target paths move into the
workspace. No shared image tag is created or overwritten.

Preparation retains `bundle.json`, `image.tar.gz`, `cargo.tar.gz`, `Cargo.lock`,
the source archive and complete preparation logs. `bundle.json` records the
image ID and SHA-256 hashes of the three replay inputs. Preserve these exact
bytes; rebuilding a Dockerfile alone is insufficient to reproduce a resolved
image or crate set.

## Run all twelve commands

```bash
node scripts/symphony/ci/rust-workload/runner.mjs run \
  --workspace "$rust_workspace" --source ../venn-search-rs \
  --lock scripts/symphony/ci/rust-workload/Cargo.lock \
  --bundle ../rust-bundle --output ../rust-run-1 \
  --issue 100-89 --run run-1 --cpus 2 --memory 4g --pids 256
```

Replay verifies the lock and archive hashes, loads the retained image by ID,
and restores only the Cargo download cache. Compiled target directories start
empty and are separated by feature. Each attempt has its own image/architecture/
lock identity and cache paths in the index. Replay containers have networking
disabled and `CARGO_NET_OFFLINE=true`; preparation needs registry access.

The runner executes exactly these selections, each in a separate container with
a 60-minute bound:

```bash
cargo build --release --locked
for colors in 3 4 5 6; do
  cargo test --release --locked --features "ncolors_${colors}" --verbose
  cargo test --release --locked --doc --features "ncolors_${colors}" --verbose
done
cargo clippy --locked --all-targets -- -D warnings
cargo clippy --locked --all-targets --features ncolors_5 -- -D warnings
cargo fmt --all -- --check
```

This shell listing describes coverage; use the runner to preserve failures
inside the loop. It continues after ordinary failures to report every command,
returns a nonzero result if any command or cleanup fails, and marks commands
not started after cancellation as missing. Timeout returns 124; cancellation
returns 130. Cargo's original exit, container exit/OOM state, cleanup exit and
readback remain separate. Explicit doc steps and zero-test observations remain
in the ledger. Logs preserve ignored/filtered tests and available reasons;
no test count is inferred when Cargo never reports one.

Every container uses the caller UID/GID, one mount of the attempt's sanitized
workspace, a read-only image, bounded executable `/tmp` for rustdoc's test
binaries, dropped capabilities and no new
privileges. The recorded environment allowlist is HOME, CARGO_HOME,
CARGO_TARGET_DIR, RUSTUP_TOOLCHAIN, CARGO_TERM_COLOR, RUST_BACKTRACE and replay's
CARGO_NET_OFFLINE. Source `.git`, host credentials and Docker socket are absent.
There are no published ports or host networking.

## Evidence, cleanup and replay handoff

`index.json` records source/workflow and adapter identity, worker/UID/architecture,
limits, paths, versions, exact commands, logs/hashes, per-step timestamps and
exits, test summaries, expected/executed/missing inventory and next owner.
Each command also has independent `.json`, output, create, inspect, cleanup and
readback logs. The runner captures container IDs before starting commands and
removes only those IDs after inspection. A name collision does not authorize
removing an existing container. Cleanup errors preserve the workload failure.
Stdout and stderr are retained separately (`.log` and `.log.stderr`) to prevent
Cargo's progress messages from corrupting libtest summary lines. Adapter source
snapshots and hashes identify uncommitted development execution precisely.

SIGINT/SIGTERM stop the current command, retain evidence and remove its
container. After abrupt termination, inspect `*.cid`, `active-container.json`
and `docker ps -a --filter label=drc.owner=drc-ISSUE-RUN-rust`. Verify each ID's
name/label against this attempt, save its logs/inspect, then remove only those
IDs and record readback. Never use global prune or delete another task's caches.

Before DEPLOY/V1/V2, attach the complete bundle and logs through the existing
authorized Linear file-upload route; put asset URLs and archive hashes in the
committed evidence index. Download using authorized Linear access, verify the
archive hash, extract beneath the receiving issue workspace and verify
`bundle.json` before replay. Use the receiving issue/run identity and a new
output directory. Preserve failed attempts as well as passes.

Archive `index.json`, all per-command logs/JSON/CID files, Cargo.lock, source.tar
and the runner input manifest. After checking durable upload/readback, remove
only the attempt's `workspace` directory (source copy, Cargo cache and targets).
Keep the replay image/crate archives; no image removal is required for handoff.
Record the cleanup command and its result with the uploaded evidence. No cache
or output directory is deleted automatically before its artifacts are retained.

For installed acceptance, pass `--provenance <workspace/nonsecret-provenance.json>`
with Jeremy's verified selected/installed bootstrap and runtime refs, bundle and
rendered-workflow hashes, worker/instance identity and readback source. The helper
records the supplied projection verbatim; it does not verify a host deployment.
Without it, the index explicitly identifies a development run with unverified
installed refs. DEPLOY owns installation/readback; V1/V2 own hosted first/repeat
acceptance. Local Docker execution alone does not close those obligations.
After DEPLOY, invoke the accepted helper through
`$SYMPHONY_TOOLING_ROOT/scripts/symphony/ci/rust-workload/runner.mjs` and copy the
retained Cargo.lock into the receiving issue workspace for `--lock`. Keep the
source checkout, downloaded bundle, output and provenance projection in that
workspace; never use the installed tooling directory as a writable cache.

Real upstream build/test/clippy/fmt failures belong to Jeremy. Keep their output,
leave this issue's acceptance incomplete, and route an upstream change or
explicit scope decision to him. Do not edit upstream product files, reduce
features, switch to floating stable or report a partial workload as green.

## Local validation

```bash
npm ci
node --test scripts/symphony/rust-ci-workload.test.mjs
node_modules/.bin/eslint scripts/symphony/ci/rust-workload/runner.mjs scripts/symphony/rust-ci-workload.test.mjs
node_modules/.bin/prettier --check docs/engineering/symphony/rust-ci-workload.md
git diff --check
```

Fixture tests cover every command selection and failure position, timeout,
cancellation, output retention, missing inventory, container collision/partial
startup, OOM, cleanup failure and zero doc tests. They complement the mandatory
live Docker run and current-head implementation CI.

## Retained development artifacts

The [development index](../../../scripts/symphony/ci/rust-workload/development-evidence.json)
records the exact image, generated lock, artifact URLs and hashes. The replay
archive is split into four Linear attachments. Download them in part order,
verify each hash, concatenate parts 00–03 to `rust-bundle-dev1.tar`, verify the
whole archive hash and extract it. Each uploaded part was downloaded again and
verified byte for byte. The contained preparation index retains its actual
development runner hash; the execution index identifies the tested adapter
commit separately. These artifacts remain preparation/development proof.

Consult the development index for each attempt's outcome, limitations and cleanup
evidence. A complete twelve-command integration run is required before acceptance.
Queue execution while Redis is running unless Jeremy confirms aggregate headroom.
Start each attempt with a new output/run identity and the retained inputs above.
