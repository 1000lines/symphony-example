# Docker and Rust CI delivery items

Each section is one ticket, copied with the full [execution contract](execution-contract.md).
All are hard difficulty because they require installed-state or cross-run proof;
initial label `green`. All file paths are in symphony-example. No temporary seam.
Each published Markdown change runs locked Prettier and `git diff --check`
locally, skips Docker for those checks if they pass, then runs mandatory
current-head implementation CI. Required live Docker execution below is separate.

## DRC-DEPLOY — Install the accepted tooling and verify a new worker

- **Scope:** R01/R06/R07/R08, D01/D06/D07: prepare and execute the operator-owned
  rollout, identify actual installed refs and prove a new worker consumes them.
- **Owned files:** create `docs/symphony-plans/docker-rust-ci/rollout-runbook.md`
  and `docs/symphony-plans/docker-rust-ci/evidence/rollout.md`; no edits/deletes.
- **Source files:** merged BOOT/environment/Redis/Rust guides and code;
  `scripts/symphony/host/install-runtime.sh`, runtime-bundle README,
  deployment/reconciliation procedure and all design pins.
- **Owned external resources:** coordinated with Jeremy, exclusive initial
  drain/install/reload window for `symphony.1000lines.dev`, its installed Compose
  plugin, `/etc/symphony/WORKFLOW.md`, runtime bundle and Symphony service.
  Read nonsecret `/var/lib/symphony-bootstrap/provenance.json` projection,
  `runtime-bundle-manifest.json`, service health and new worker identity.
  Preserve Docker data-root/socket/mounts; no unrelated containers may be moved.
- **Dependencies:** three separate hard blockers, each `linear_blocker: true`:
  BOOT Done/main supplies Compose and mode guidance; REDIS Done/main supplies
  the complete Redis runner (ENV is transitively included); RUST Done/main
  supplies the Rust recipe. Select one accepted bootstrap main SHA containing
  all of them; no task branch or unmerged-source deployment.
- **Estimated PR:** +140–240 / -0 lines, two files.
- **Required actions:** prepare runbook with actual bootstrap/runtime SHAs,
  bundle/workflow hashes, operator commands, expected readbacks and rollback
  refs. Use `scripts/symphony/host/install-runtime.sh --only 35-docker` for the
  reviewed Compose step and `--runtime-bundle-refresh` for source/bundle/config
  refresh, with the existing documented installer inputs. The latter alone
  neither installs Compose nor reloads Symphony. Drain through the existing
  operator procedure, execute the exact approved step order and explicit service
  reload/restart, record exits/logs, then release the worker slot. On a new host
  run the documented full installer. Resolve current service/host identifiers
  from operator configuration; do not guess them or bypass existing grants.
- **Acceptance checks:** selected and installed bootstrap/runtime refs match the
  runbook; actual bundle/workflow hashes, installer exits, health and new worker
  identity are recorded. In that worker run `id`, `uname -m`, `docker version`,
  `docker compose version`, installed config-reader inspection and a pinned
  recipe component probe. Show explicit ticket Docker mode against a native
  default and usable workload paths via `SYMPHONY_TOOLING_ROOT`. Compose version
  alone is insufficient without runtime-user discovery. No hand-edited skills
  or shell PATH dependency. Source merge is not deployment proof.
- **Validation:** local runbook/command review and Markdown checks first;
  execute the required installer/worker probes in the coordinated operator
  window, capturing actual Docker image IDs/digests and exits; then mandatory
  CI for the evidence PR. Full workload runs belong to R1/V1. An unavailable
  operation leaves this item Inactive with exact host/App/error/grant, Jeremy's
  action and required readback; independent preparation is already reviewable.
- **Delivery notes:** release shared-host mutation ownership to REHEARSE only
  after R1/V1 finish. **Exclusions:** replacing runtime architecture, upstream
  writes/grant expansion, workload execution claims based on probes alone.

## DRC-R1 — Execute the complete first hosted Redis run

- **Scope:** R01/R02/R04/R05/R07/R08, D02–D05/D07: actual hosted ticket execution
  of every selected Redis CI cell using DEPLOY's installed tooling.
- **Owned files:** create `docs/symphony-plans/docker-rust-ci/evidence/redis-first.md`;
  no code edits/deletes. Source: installed refs/rollout index, merged Redis
  guides/locks and pinned upstream workload sources.
- **Owned external resources:** only this issue's `drc-${issue}-${run}-${cell}`
  containers/anchors/Compose projects, workspace locks/caches and its attached
  logs/results. Host service and installed files are read-only. V1 owns separate
  resources; apply the shared aggregate-headroom rule before concurrent runs.
- **Dependency:** `item: DRC-DEPLOY`, `type: hard`, `linear_blocker: true`;
  requires Done, installed refs/new-worker proof and code on main; reason:
  acceptance must exercise delivered tooling under the hosted identity.
- **Estimated PR:** +120–220 / -0 lines, one index (full logs attached).
- **Required actions:** explicitly require Docker in the ticket. From the issue
  workspace invoke installed ENV prepare/check and Redis runner `--list` then
  full execution with recorded source SHA, environment lock and output directory
  using REDIS's exact documented command arrays. Execute all 351 integration,
  two package, seven install cells plus two MultiDB substeps; run lint/audit.
  Record R08 fields and full durable artifacts. Copy no container secrets.
  One cell at a time; resume bounded batches only at identical immutable inputs.
  Budget/time interruption leaves cells unrun, never omitted from the ledger.
- **Acceptance checks:** complete expected/executed ledger, every required
  build/test cell passed, both MultiDB topologies exercised, separate lint/audit
  outcomes, no missing JUnit/coverage or overwritten package results. Retain
  upstream skips and all earlier failures; no full-CI green claim with lint/audit
  failure. Cleanup exits/resource readback pass without disturbing Symphony.
  Share immutable inputs and artifact hashes with R2; R2 must rerun every cell.
- **Validation:** local source/lock/ledger preflight, then **mandatory actual
  Docker workload**, then local formatting/index consistency and mandatory
  implementation-repository CI for the evidence commit. An upstream GitHub run
  is context only. **Exclusions:** fixing upstream code, reduced matrix,
  installation changes, using development probes as full acceptance.

## DRC-V1 — Execute the complete first hosted Rust run

- **Scope:** R01/R03/R04/R05/R07/R08, D02/D05/D07: actual hosted release build,
  four release test/doc-test pairs, both clippy checks and formatting.
- **Owned files:** create `docs/symphony-plans/docker-rust-ci/evidence/rust-first.md`;
  no code edits/deletes. Source: DEPLOY index, merged Rust guide/lock and pinned
  upstream CI/Cargo/README.
- **Owned external resources:** only this issue's `drc-${issue}-${run}-rust`
  runner/derived images, workspace CARGO_HOME/CARGO_TARGET_DIR and attachments.
  Host installed state and other tasks' resources are read-only. R1's resources
  are disjoint; concurrent resource bounds follow the execution contract.
- **Dependency:** `item: DRC-DEPLOY`, `type: hard`, `linear_blocker: true`;
  requires Done and installed worker proof; reason: verify delivered tooling.
- **Estimated PR:** +90–160 / -0 lines, one index.
- **Required actions:** explicitly require Docker. Invoke the installed Rust
  recipe with exact target, retained Cargo.lock, image and output arguments from
  its merged guide. Execute all twelve execution-contract commands under worker
  UID with a cold compiled-output cache. Record compiler/components, individual
  exits/logs/counts, zero doc tests where observed and full R08 evidence. Preserve
  command failures and clean only this runner. Archive inputs for V2.
- **Acceptance checks:** `cargo build --release --locked`, ncolors_3/4/5/6
  release and explicit doc tests, default/ncolors_5 clippy and fmt all pass for
  full CI success; failures are visible separately and routed to Jeremy.
- **Validation:** local source/lock preflight, **mandatory Docker workload**,
  local evidence/Markdown checks then mandatory implementation CI. **Exclusions:**
  upstream product fixes, reduced feature coverage, host Rust installation,
  accepting a pre-existing upstream run as proof.

## DRC-REHEARSE — Reconcile bootstrap and recreate cold environments

- **Scope:** R04/R07/R08, D07: exercise repeatable installation after first-run
  evidence, then hand a freshly verified installed environment to both repeats.
- **Owned files:** create `docs/symphony-plans/docker-rust-ci/evidence/rehearsal.md`;
  edit `docs/symphony-plans/docker-rust-ci/rollout-runbook.md` only for observed
  replay commands/readbacks, after DEPLOY's ownership ends. No deletes.
- **Source files:** accepted runbook, rollout/R1/V1 indexes and immutable inputs;
  existing full installer/reconciliation/rollback guidance.
- **Owned external resources:** Jeremy's exclusive shared-host/rehearsal-host
  drain/install/reload window after first-run resources are cleaned. Same
  installed plugin/bundle/service as DEPLOY, now handed off explicitly; only
  project-owned caches/containers may be removed. Never delete a Docker-wide
  cache or another worker's resources to simulate a cold environment.
- **Dependencies:** R1 and V1 separately, `type: hard`, `linear_blocker: true`;
  each must be Done with complete first-run artifacts and cleanup. Reason:
  preserve before/reconciliation/after ordering and avoid reloading an active
  acceptance worker. DEPLOY is transitively required; no redundant direct edge.
- **Estimated PR:** +90–180 / -0–20 lines, two files.
- **Required actions:** coordinate a replacement/rehearsal host with Jeremy and
  run the existing full bootstrap at the accepted pins. If unavailable, execute
  the design-authorized idempotent reconciliation on the existing host, then
  recreate workload environments/caches in fresh issue-owned directories and
  explicitly record that replacement-host behavior was not tested. Reuse the
  same target/dependency pins; capture installer logs, installed provenance,
  hashes, worker/host identity, mode/Compose/component readbacks and rollback.
- **Acceptance checks:** idempotent second installation and new worker function
  without manual installed changes; stored dependency/image artifacts can
  recreate both environments with empty compiled caches. A warm image or bundle
  fixture alone does not pass. Release the host mutation window before R2/V2.
- **Validation:** local runbook/Markdown checks, actual required bootstrap and
  Docker environment recreation/probes, then mandatory CI for published docs.
  Complete repeat workloads remain R2/V2. **Exclusions:** new runtime platform,
  arbitrary pin refresh, claiming host replacement when only reconciliation ran.

## DRC-R2 — Repeat every Redis cell after rehearsal

- **Scope:** R01/R02/R04/R05/R07/R08, D02–D05/D07: cold complete replay of R1's
  exact pinned workload after the recorded rehearsal.
- **Owned files:** create `docs/symphony-plans/docker-rust-ci/evidence/redis-repeat.md`;
  no edits/deletes. Read R1, rehearsal, Redis guides/locks and pinned source.
- **Owned external resources:** this new issue's uniquely namespaced Redis
  projects/anchors/caches/artifacts, using retained immutable inputs read-only.
  V2 has disjoint resources; enforce aggregate headroom. No host writes.
- **Dependency:** `item: DRC-REHEARSE`, `type: hard`, `linear_blocker: true`;
  requires Done plus readback/new worker and host window released; reason:
  replay must follow bootstrap rehearsal, with R1 inputs already in ancestry.
- **Estimated PR:** +120–220 / -0 lines, one index.
- **Required actions:** explicitly require Docker; repeat R1's full documented
  commands and all cells/substeps/lint/audit in a fresh workspace environment
  with the same target/image/dependency pins. Use a separate output ledger;
  never import first-run passing cells as repeat results. Prove cache/input
  provenance, record full R08 evidence and compare expected/executed inventories
  and test/skip counts to R1, explaining differences without suppressing them.
- **Acceptance checks:** all required cells pass and every difference/failure/
  skip is visible; complete cleanup and durable artifact hashes; explicit
  rehearsal link and installed refs. **Validation:** local immutable-input
  preflight → mandatory full Docker replay → local index/Markdown checks →
  mandatory implementation CI. **Exclusions:** upstream changes, partial replay,
  pin drift, copied first-run results or installed-state changes.

## DRC-V2 — Repeat the full Rust workload after rehearsal

- **Scope:** R01/R03/R04/R05/R07/R08, D02/D05/D07: reproduce V1's twelve commands
  with retained Cargo.lock and derived image after bootstrap rehearsal.
- **Owned files:** create `docs/symphony-plans/docker-rust-ci/evidence/rust-repeat.md`;
  no edits/deletes. Read V1, rehearsal and the merged Rust recipe/pinned sources.
- **Owned external resources:** this issue's Rust runner and empty compiled-output
  cache, workspace CARGO_HOME and attachments, with distinct issue/run names.
  No shared installation mutations or R2 resource use.
- **Dependency:** `item: DRC-REHEARSE`, `type: hard`, `linear_blocker: true`;
  requires Done, fresh worker readback and released host window; reason:
  repeat must establish operation after rehearsal, not another pre-rollout run.
- **Estimated PR:** +90–160 / -0 lines, one index.
- **Required actions:** explicitly require Docker and execute all twelve V1
  commands again with the identical target/lock/image, new output directory and
  cold target cache. Record and compare each command's exits/test/skip counts,
  compiler/components, installed refs, worker identity and artifact hashes.
- **Acceptance checks:** full release/build/test/doc/clippy/fmt success is based
  on this run only; retained failures are visible and cleanup verified.
  **Validation:** local source/lock preflight → mandatory Docker replay → local
  index/Markdown checks → mandatory implementation CI. **Exclusions:** changed
  product/toolchain pins without replan, copied prior success or host Rust.

## DRC-FINAL — Audit acceptance, cleanup and human handoff

- **Scope:** R01–R08, D01–D07: reconcile source, installed state and both complete
  before/after workload runs; close project-scoped cleanup and publish the
  final acceptance index for Jeremy. Use the installed finalize-project skill.
- **Owned files:** create `docs/symphony-plans/docker-rust-ci/evidence/acceptance.md`;
  sequential cleanup-only edits to the exact BOOT file set and the exclusive
  ENV/REDIS/RUST directories, top-level test files and guides listed in
  implementation items. No generic
  planning docs, upstream repository edits or unrelated root changes.
- **Source files:** all accepted task diffs and evidence indexes, requirements,
  reviewed plan, runtime/host installed readbacks and artifact URLs/hashes.
- **Owned external resources:** read-only project evidence/installed probes;
  cleanup only explicitly recorded orphan resources from these project tickets,
  after checking their ownership and inactivity. Jeremy retains host authority;
  no bootstrap reload, grant expansion, package/image publishing or broad prune.
- **Dependencies:** R2 and V2 separately, `type: hard`, `linear_blocker: true`;
  both Done with complete replay and cleanup evidence. Their transitive
  predecessors establish all first-run/rollout/source obligations; no no-op join.
- **Estimated PR:** +120–220 / -0–100 lines, acceptance index plus only justified
  cleanup paths. **Split criteria:** proof-of-work-boundary, integration-validation-dependency.
- **Required actions:** map R01–R08/D01–D07 to source PRs and actual evidence;
  verify all required cells and twelve Rust commands in each run, image/lock
  matching, installed refs/provenance, worker attribution and durable logs.
  Audit owned paths with `rg -n 'TODO|FIXME|stub|placeholder|disabled|temporary'`
  and inspect adapters/flags manually; remove temporary scaffolding or document
  why each durable workload translation remains. Verify no task-owned resource
  survives unintentionally and no secret is in evidence. Record all limitations,
  including reconciliation-only rehearsal when used.
- **Finalization responsibility:** all project markers/temporary seams introduced
  by approved amendments, exact BOOT/ENV/REDIS/RUST paths above, and task-owned
  containers/caches. No temporary marker is pre-authorized by this plan. Promote
  durable upstream-specific adapters explicitly; do not remove required recipes.
- **Acceptance checks:** no unresolved required failures/unrun cells, missing
  installed proof or inaccessible artifacts. Human scope changes must be
  attributed; source presence/upstream badges are never substitutes. Each PR's
  required CI and current-head Cadence closure are recorded; human acceptance
  owns Done and project completion.
- **Validation:** local evidence/hash/count/ownership audit and Markdown checks;
  rerun affected local and required Docker workload checks only if cleanup changes
  behavior, replacing stale acceptance evidence for affected inputs; then
  mandatory current-head implementation CI. Pure evidence audit needs no new
  Docker run when valid first/repeat evidence covers unchanged behavior.
- **Delivery notes:** hand Jeremy a concrete final acceptance index and remaining
  limitations for review. **Exclusions:** inventing successful acceptance, quietly
  accepting partial coverage, changing review/planning process, unrelated cleanup.
