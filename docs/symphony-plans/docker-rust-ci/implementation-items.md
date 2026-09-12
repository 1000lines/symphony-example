# Docker and Rust CI implementation items

Each section is one ticket. Copy it with the complete
[execution contract](execution-contract.md). Paths are in symphony-example;
upstream paths are read-only context or disposable workspace copies.
All four items are hard difficulty; initial label `green`; no temporary seam.
New unit/fixture suites live directly under `scripts/symphony/` so the existing
`npm test` glob selects them in mandatory CI. Docker workload probes are explicit
separate commands; fixtures must not require live host mutation.

## DRC-BOOT — Install Compose and preserve explicit Docker execution

- **Scope:** R01/R06, D01/D06: make Compose available after bootstrap and make
  explicit ticket Docker direction win over native/remote defaults using the
  existing mode/command-array contract. Keep other modes' behavior intact.
- **Owned files (edits):** `scripts/symphony/host/install.d/35-docker.sh`,
  `scripts/symphony/host/docker.test.mjs`,
  `scripts/symphony/runtime-bundle/workflow/WORKFLOW.md`,
  `scripts/symphony/runtime-bundle/codex/AGENTS.md`,
  `scripts/symphony/runtime-bundle/skills/symphony-repository/SKILL.md`,
  `scripts/symphony/runtime-bundle/skills/symphony-repository/references/config.md`,
  `scripts/symphony/repository-config.test.mjs`.
  Create `docs/engineering/symphony/docker-rust-ci-bootstrap.md` for the narrow
  install/mode handoff and `scripts/symphony/docker-compose.test.mjs` for Compose
  fixtures selected by the existing root `npm test` glob. No deletes. Do not change the mode schema or renderer.
- **Source files:** those owned paths; `host/lib.sh`, `host/install-runtime.sh`,
  `host/install.d/10-os-packages.sh`, `host/install.d/60-dev-tools.sh` under
  `scripts/symphony/`; repository skill `scripts/config.mjs`; runtime bundle README.
- **Owned external resources:** workspace-only stub download/install directories
  and task test outputs. Compose release assets are read-only. No live daemon,
  installed plugin, systemd service or shared-host write authority in this item.
- **Dependencies:** none. **Estimated PR:** +180–320 / -10–40 lines, nine files.
  **Split criteria:** operational-prerequisite, cross-package-contract.
- **Required actions:** install Compose v2.39.4 as a discovered CLI plugin through
  existing installer mechanisms; pin the design's x86_64/aarch64 checksums;
  verify downloads and idempotent reruns; reject unsupported architecture,
  checksum mismatch or conflicting operator installation without overwriting it.
  Preserve daemon data-root/socket ownership/mount ordering. Align installed
  instructions on ticket Docker precedence and point workload recipes at
  `SYMPHONY_TOOLING_ROOT`; no implicit command wrapping or global mode change.
- **Acceptance checks:** a fixture covers first install/rerun/conflict/checksum/
  unsupported architecture and runtime-user discovery. Verify existing config
  acceptance of native/docker/remote and invalid modes; document the effective
  ticket override source. A fixture is not installed worker evidence: DEPLOY
  must read it back in a new worker. Source already supports `ci.mode`; refresh
  the installed reader later instead of adding a second schema.
- **Validation:** local `bash -n scripts/symphony/host/install.d/35-docker.sh`;
  `node --test scripts/symphony/docker-compose.test.mjs scripts/symphony/host/docker.test.mjs scripts/symphony/repository-config.test.mjs`;
  `node --test scripts/symphony/runtime-bundle/runtime-bundle.integration.test.mjs`;
  locked Prettier on changed Markdown and `git diff --check`. Docker only for a
  local fixture environment gap, using the execution contract's Node image;
  skip when these checks pass. Then mandatory implementation CI. Live install
  and worker-mode probes belong to DEPLOY, not a claimed local pass here.
- **Delivery notes:** hand exact install step, discovery path, accepted source
  SHA and worker readback commands to DEPLOY. Shared-host changes start only
  after this PR lands. **Exclusions:** new dispatcher/modes, client-template
  changes, native Python/Rust installation, running full acceptance or deployment.

## DRC-ENV — Prepare reproducible isolated Redis environments

- **Scope:** Redis environment half of R02/R04/R05, D02/D04/D05: translate the
  pinned Compose topology, build constrained interpreter/parser environments
  and prove safe setup/teardown. DRC-REDIS consumes this durable interface.
- **Owned files:** all new files under
  `scripts/symphony/ci/redis-environment/` (exclusive prefix: topology renderer,
  image/constraint inputs and lifecycle command), new
  `scripts/symphony/redis-ci-environment.test.mjs`, and new
  `docs/engineering/symphony/redis-ci-environment.md`. No existing-file edits
  or deletes. No root package manifest/lockfile edits; use existing libraries.
- **Source files:** pinned redis-py Compose, `dockers/sentinel.conf`, `tasks.py`,
  dev requirements, pyproject, CI/composite action and test networking helpers;
  design's environment inventory and topology. Read upstream AGENTS/CLAUDE
  before handling its disposable source copies.
- **Owned external resources:** only issue-namespaced `drc-${issue}-${run}-${cell}`
  Compose projects/anchors, derived image IDs, workspace wheelhouses/locks and
  their evidence. Registry/base image access is read-only. No shared tags,
  published ports, worker secrets, host socket mounts or daemon configuration.
- **Dependencies:** none. Compose can be fetched into this workspace using the
  design's checksum pin for its probes if the host lacks it; do not write an
  installed plugin or wait for BOOT solely for development. **Estimated PR:**
  +550–850 / -0 lines, approximately 6–10 new files. **Split criteria:**
  external-system-boundary, risk-blast-radius, size-budget.
- **Required actions:** reuse the complete upstream Compose definitions; remove
  fixed names/ports/per-service networks, join one task anchor namespace, retain
  profiles/healthchecks/TLS/mounts and apply only design-approved loopback
  address changes and Stack port 6479. Resolve every design-pinned Redis/Stack/
  proxy and seven Python/PyPy image digests, compatible UID/GID/writable paths,
  bounded resources and any narrowly derived image needed. Retain constrained
  pip/build/Hatchling and parser/uvloop dependencies with hashes and replay
  artifacts, including nested package-script installs. Do not weaken old hiredis
  coverage on resolution failure.
- **Interface handoff:** the environment directory supplies a host CLI with
  `prepare`, `up`, `check`, `down` operations, taking explicit source directory,
  immutable environment lock, issue/run/cell identity and output directory.
  `prepare` writes resolved Compose/config diffs and the lock; `up` records the
  anchor ID, exact Compose project/file, image IDs and task resource IDs;
  `check` verifies required topology; `down` consumes those recorded IDs and
  retains cleanup exit/readback. Document concrete invocations and artifact
  paths in the owned environment guide. No generic plugin/provider interface.
- **Acceptance checks:** compare rendered Compose against the pinned source;
  assert no public port or credentials/socket mount; exercise standalone/TLS,
  replica, sentinel, proxy, modules and cluster/cluster2 health as workspace UID.
  Run a bounded concurrent pair and verify host port 4000 is unchanged. Exercise
  failed health, partial startup, command failure, cancellation and cleanup;
  unrelated containers survive. Snapshot every image/constraint pin, actual
  interpreter/server version and derived image ID. Image availability alone
  does not pass compatibility; report failures before handoff.
- **Validation:** local `node --test scripts/symphony/redis-ci-environment.test.mjs`
  for translation, pin enforcement and lifecycle failure behavior, plus formatting
  and diff checks. Required Docker probes then run the documented environment
  CLI with the design's immutable Python/Redis/Stack/proxy images, worker UID,
  one-workspace mount and scoped networking. These live integration probes
  cannot be replaced by fixtures even when fixtures pass. Full matrix runs are
  later work. Then mandatory implementation CI on this PR's commit.
- **Delivery notes:** publish immutable environment lock, replay artifact route
  and lifecycle invocation contract before DRC-REDIS starts. Prefix ownership
  includes all new environment files; DRC-REDIS may import/read but not edit
  them. **Exclusions:** matrix runner, upstream test edits, full acceptance,
  bootstrap/service changes, new dependencies requiring root manifest edits.

## DRC-REDIS — Run and account for the full Redis CI workload

- **Scope:** Redis command/coverage half of R01/R02/R04/R05/R08, D02–D05:
  a bounded upstream-specific runner that preserves every cell and result.
- **Owned files:** all new files under `scripts/symphony/ci/redis-workload/`
  (exclusive prefix: exact matrix mapping, runner and fixtures), new
  `scripts/symphony/redis-ci-workload.test.mjs`, plus new
  `docs/engineering/symphony/redis-ci-workload.md`. No existing-file edits/deletes.
- **Source files:** ENV's merged lifecycle guide/interface and locked inputs;
  pinned Redis integration workflow, composite action, package script and
  tasks.py; requirements/design Redis workload contract.
- **Owned external resources:** only this issue's namespaced Redis environments,
  locks/caches and result artifacts via ENV. No ENV issue's containers or image
  tags are mutated; consume its immutable replay artifacts read-only.
- **Dependencies:** `item: DRC-ENV`, `type: hard`, `linear_blocker: true`;
  requires Done plus environment interface/locks on main; reason: runner calls
  actual lifecycle operations and composed failure tests must use that code.
  **Estimated PR:** +450–750 / -0 lines, about 4–7 files.
  **Split criteria:** validation-surface, durable-data-contract.
- **Required actions:** reproduce 351 integration cells, two MultiDB substeps,
  two package and seven commit installs at the pinned source. Preserve all
  commands/flags/timeouts/exclusions from the design and execution contract;
  pin both image anchors for later cluster2 startup. Record lint/audit separately.
  Patch only the package script's exact host-setup line in a disposable source
  copy, retaining patch/hash and distinct results for both pytest commands.
  Bound each ordinary/package/install cell at 60 minutes, PyPy at 50 minutes.
  Run one cell at a time; allow a selected cell range and resume only when all
  source/dependency/image inputs match. Preserve earlier failures, unrun cells,
  missing evidence and cleanup errors without collapsing them to success.
- **Acceptance checks:** expected cell inventory exactly matches the upstream
  jobs/axes and two MultiDB conditions. Each cell has its own logs/JUnit/coverage,
  exits/counts/skips and cleanup results. Interrupted runs retain pending cells;
  input drift prevents resume. Missing topology or overwritten package results
  fails the summary. No package smoke-test substitution or broad success based
  on fewer cells. CLI exposes documented `--list`, `--output`, `--resume` and
  explicit immutable source/environment inputs for later tickets; these are
  project-specific arguments, not a new CI-mode schema.
- **Validation:** local `node --test scripts/symphony/redis-ci-workload.test.mjs`,
  dry-run inventory equality, package diff review, formatting/diff checks.
  Run required Docker integration probes through ENV: one primary cell, both
  MultiDB topology checks and package script path; prove failure and cleanup
  propagation with recorded nonzero commands. Use design-pinned images and
  UID/network restrictions. These verify the adapter, not full R02 acceptance.
  Then mandatory implementation CI.
- **Delivery notes:** hand exact invocations, expected inventory, lock/artifact
  inputs and output format to R1/R2 and DEPLOY. **Exclusions:** edits to ENV,
  upstream product/workflows, global scheduler, remote-only execution, full
  acceptance claims. Lifecycle defects return to ENV via the existing replan
  rules; do not silently cross ownership boundaries.

## DRC-RUST — Package the complete pinned Rust workload

- **Scope:** R01/R03/R04/R05/R08, D02/D05: reproduce release build, four feature
  test/doc-test pairs, both clippy invocations and fmt in a bounded Docker recipe.
- **Owned files:** all new files under `scripts/symphony/ci/rust-workload/`
  (exclusive prefix: Dockerfile, lock inputs and runner), new
  `scripts/symphony/rust-ci-workload.test.mjs`, plus
  new `docs/engineering/symphony/rust-ci-workload.md`. No existing edits/deletes.
- **Source files:** pinned venn-search-rs CI, Cargo.toml, README and CLAUDE;
  requirements/design Rust workload and shared execution contract.
- **Owned external resources:** this issue's `drc-${issue}-${run}-rust` image IDs,
  runner, workspace Cargo caches/target and evidence. No host rustup install,
  shared image-tag overwrite or other task caches. Registry inputs read-only.
- **Dependencies:** none. **Estimated PR:** +180–350 / -0 lines, 4–6 files.
  **Split criteria:** domain-boundary, validation-surface.
- **Required actions:** derive from
  `rust@sha256:7fa728f3678acf5980d5db70960cf8491aff9411976789086676bdf0c19db39e`,
  install clippy/rustfmt for 1.90.0, retain derived digest/ID and component
  versions. Generate/retain Cargo.lock with this toolchain, use `--locked`
  afterward and keep image rustup configuration intact under worker UID.
  Run all twelve execution-contract commands separately with 60-minute limits;
  preserve every output/exit and stop false-green aggregation. Provide documented
  prepare/run invocations with source, lock, output and resource arguments.
- **Acceptance checks:** no `--all-features`, missing explicit doc step or
  ignored loop failure. Worker UID can use clippy/rustfmt and workspace caches;
  cold compiled-cache run uses retained lock. Real build/test/lint failures
  remain failures and are routed to Jeremy, without editing upstream product.
- **Validation:** local `node --test scripts/symphony/rust-ci-workload.test.mjs`
  verifies command selection, failure/cancel/timeout and output retention;
  formatting/diff checks. Required Docker integration runs build and all twelve
  workload commands with the derived pinned image, one-workspace mount and
  worker UID, retaining actual counts and cleanup. It is development evidence;
  V1/V2 must still exercise installed hosted operation/repeatability. Then
  mandatory implementation CI.
- **Delivery notes:** record exact image build/run commands, generated lock hash
  and durable replay artifact route for DEPLOY/V1/V2. **Exclusions:** host Rust,
  floating stable, upstream fixes, feature reduction, full project acceptance.
