# Docker and Rust CI ticket execution contract

Copy this contract and the complete owning item into every generated ticket.
These are future obligations, not evidence that a workload has passed.

## Scope, sources and delivery

- Implementation repository: `1000lines/symphony-example`; branch base and PR
  base: `main`. Project `docker-rust-ci`, green; human lead Jeremy Carroll,
  Linear `c65b9fbe-e740-47e9-b444-3172d3526ff2`, GitHub `jeremycarroll`.
- Read the accepted [requirements/design](requirements-and-design.md), especially
  R01–R08, D01–D07 and its exact workload commands/image inventory; the accepted
  [plan](fan-out-plan.md); current issue/project/human feedback; target README,
  applicable AGENTS/CLAUDE, `SYMPHONY.md`, selected-base configuration and CI.
  Use the installed repository and Karpathy skills. Pin one Codex workpad first.
- Branch `symphony/docker-rust-ci/${issue}/<manifest-suffix>` from current main.
  Never commit predecessor work absent from main. Hard predecessors must be Done
  and their required code merged before dependent execution. Independent draft
  notes are permitted while waiting; keep dependency-gated work Active.
- Initial Linear label: `green`. Create in Backlog, verify all direct relations,
  then activate. No hold was requested. Do not create Blocked or use Do Not Use.
  Pending CI: Unhappy plus `wake:15m`; review/operator input: Inactive. Human
  acceptance owns Done. Preserve terminal states and unrelated labels.
- Open a draft PR titled `[${issue}]: <outcome>`, assigned to `jeremycarroll`.
  Apply and read back `green` and `symphony` using the shared label helper.
  Include Context, TL;DR, accepted-plan progress diagram with actual links and
  current-node outline, Summary, Tested and selected base. No guessed links.
- Before ready/human review or blocker-side `mature`, require passing current-head
  mandatory CI, fresh configured Cadence approval at that SHA, closed mandatory
  feedback, clean branch and ready PR. Record reviewer, SHA, verdict and matching
  workpad. Inspect submitted reviews, inline comments/threads, conversation and
  Linear comments. New review-relevant activity needs another review. Remove
  maturity for request-changes, rejected/stale acceptance evidence or severe
  downstream-invalidating regression; ordinary edits alone do not revoke it.
- Fail closed for missing labels, states, assignee, branch refs, IDs/endpoints,
  relation direction or required source access. Record exact failure and affected
  action in the workpad. Operator/artifact access gates only its dependent work.
  No upstream write access is needed for public source checkout or local runs.

## Validation order and implementation CI

Run relevant local checks first; fix failed assertions. Use Docker for a missing
local test environment, otherwise record `Docker: skipped — passed locally`.
**Explicit Docker workload execution remains mandatory**, including after a
native pass: R01 and D02 require Docker for both acceptance repositories.
Fixture validation alone does not satisfy required live Docker topology checks.

All repository changes, including evidence-only Markdown, then require the
current published commit's configured CI: `CI Required` from
`.github/workflows/ci.yml`, including build/lint/test/Changed Markdown children,
and `Client template tests` from `.github/workflows/client-template-test.yml`.
Both are GitHub Actions App `15368` at the planning baseline. Recheck main's
config and applicable branch rules at execution. Capture head, event/ref,
run/attempt, workflow, emitting App, child-job IDs/results and links. Missing,
pending, canceled, skipped, failed or stale results are not passing evidence.
Cadence's advisory check does not replace these checks. Metadata-only API work
without a repository change needs readback rather than a manufactured commit.

Use locked Node 20.20.0/npm 11.13.0 (`npm ci`) for tooling. Run locked Prettier
on each changed Markdown file and `git diff --check`. Item sections name further
local tests. If the Node environment is unavailable, use the repository's
documented container or `node:20.20.0-bookworm`, resolve/record its immutable
digest before use, select npm 11.13.0 inside it, and run the same checks with
only the issue workspace mounted and its UID/GID. Do not mount the Docker socket
inside that container or mutate shared host tooling to get a test green.

## Workload commands and immutable inputs

Use redis-py `41585545ee8284d3a51797fdfa1ff995866ab558` (master) and
venn-search-rs `99528c2e4da241ec2c9961d0a155357611f16a76` (main).
Changing either pin requires a recorded upstream workflow/coverage diff and
matching complete evidence. Never mix revisions in a green result.

Redis must retain **351 integration cells**: 208 primary, 39 CPython
compatibility, 26 PyPy, 52 hiredis (including `<3.0.0`), 26 uvloop; plus two
MultiDB substeps, two package build/install/test cells and seven exact-commit
install cells. Preserve all 13 configurations, protocol/response/topology axes,
version mappings, real modules, TLS, replica/sentinel/proxy and both clusters.
Run `invoke linters` and the design's `pip-audit` command separately and retain
their failures. Do not claim every upstream workflow passed. Preserve only the
design's justified exclusions: Codecov upload, Actions transport, existing
external scenario exclusions and unrelated workflows. Missing MultiDB topology
must fail acceptance rather than produce a successful skip.

Reuse `tasks.py`, `.github/actions/run-tests/action.yml`, `docker-compose.yml`
and `.github/workflows/install_and_test.sh`. The design's commands are normative:
`pip install -r dev_requirements.txt`, uninstall Redis, install `.[jwt]`, selected
hiredis; `invoke fixed-client-tests`, `standalone-tests` and `cluster-tests`
with the exact RESP/legacy/uvloop flags; `invoke multidb-integration-tests`;
both `bash .github/workflows/install_and_test.sh tar.gz` / `whl`; seven
`pip install --quiet git+https://github.com/redis/redis-py.git@41585545ee8284d3a51797fdfa1ff995866ab558`.
Constrain nested venv/build/pip/Hatchling installs too. Retain hashes, per-axis
locks and a wheelhouse or equivalent immutable image artifact; freeze alone
does not reproduce a build. Package-script adaptation replaces only the exact
host setup line with an assertion of the freshly provisioned environment;
preserve both pytest invocations and their markers/ignores, with distinct JUnit
paths per invocation so the second command cannot overwrite the first result.

Rust uses the design's `rust:1.90.0-slim` base digest, derived with clippy and
rustfmt. Generate and retain Cargo.lock once; replay with `--locked`:

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

Capture and propagate each exit, including inside the loop. Twelve commands
are required; never use `--all-features` or omit explicit doc tests. Preserve
zero-doc-test observations. Build/test success with clippy/fmt failure is not
full CI success; report upstream defects to Jeremy without changing product code.

## Resource and evidence rules

Containers receive only issue-workspace paths and an explicit nonsecret
environment allowlist. Source acquisition/orchestration stays on the host;
no GitHub/Linear credentials, Docker socket, public ports or host networking
inside workloads. Use workspace UID/GID, task-owned writable paths and
resource limits. Keep `CARGO_HOME`/`CARGO_TARGET_DIR` workspace-local and the
image's installed rustup toolchain intact. Resolve final image IDs/digests and
dependency artifacts before execution/replay; preserve original failures.

Redis resource names use `drc-${issue}-${run}-${cell}`; Rust uses
`drc-${issue}-${run}-rust`. Each item owns only its exact names, Docker labels,
workspace caches and evidence attachments. Parallel Redis/Rust runs require
operator-confirmed aggregate CPU/memory/disk headroom and per-run limits;
otherwise queue one of them without adding an inferred DAG relation. One Redis
cell runs at a time. Concurrent isolated Redis pairs are only the bounded
isolation probe. Never reset shared databases, publish to shared tags, prune
Docker globally or invoke unscoped upstream cleanup.

Redis uses a task-owned namespace anchor, generated Compose file/project and
no published ports. Preserve the design's address adaptations and Stack port 6479. Save logs before scoped `docker compose --profile '*' down --volumes
--remove-orphans`, remove runner/anchor and read back remaining task IDs/labels.
Cleanup applies to success, failure, timeout, cancellation and partial startup;
preserve its separate exit and the original failure. Next attempt/operator
cleans recorded orphan IDs after abrupt termination. Rust similarly removes
only its runner and scoped outputs after preserving artifacts.

Every attempt's durable index must include issue/run/cell/time identity; target,
workflow and adapter SHAs; source patch/hash; selected and installed bootstrap
and runtime refs; bundle/rendered-workflow hashes; worker/instance identity,
UID/GID/architecture, Docker/Compose/toolchain versions; image digests/IDs and
dependency locks/hashes; limits and cache paths; exact commands/environment
allowlist, individual exits/timing, complete logs, JUnit/coverage/cargo output,
test and skip counts/reasons, expected/executed/missing cell inventory; cleanup
exits/readback; result, limitations and next owner. Retain failed attempts.

Use existing authorized GitHub/Linear attachments for full logs/results and
record their URLs/hashes in the committed index. Source links, private local
paths, upstream green runs and source-only merges are not hosted execution
proof. Each proof item records target ref, command/environment, criterion,
artifact, result, limitation and handoff per the shared proof standard.

## Scoped inputs and completion

Jeremy owns shared-host drain/install/reload, provenance readback and rollback.
Prepare an exact reviewable runbook before an unavailable operation is handed
off: target host/repository/App, actual operation/error, needed grant, Jeremy's
action and expected readback. Do not invent installed refs or request expanded
App grants merely to run public source. No source credential enters a container.

No temporary seam is planned. Workload adapters are deliberately durable
translations of the pinned upstream CI, not a generic runner. If implementation
needs temporary scaffolding, update the plan's `integration_pattern` and
`finalization_responsibility` with exact markers/files and FINAL ownership
before adding it. FINAL audits all project-scoped TODO/FIXME/stub/disabled paths,
promotes justified durable adapters explicitly, verifies complete first/repeat
evidence and cleanup, and hands human acceptance to Jeremy. An unrun or failed
required workload blocks completion unless a human explicitly changes scope.
