# Hosted Docker and Rust CI: requirements and design

Status: proposed for review under [100-70](https://linear.app/1000lines/issue/100-70).
This document specifies future implementation and acceptance; it does not report
either acceptance workload as passed. The next seed, 100-71, owns decomposition
into `fan-out-plan.md` and its matching `.mmd`; 100-72 owns fan-out.

```yaml
project-code: docker-rust-ci
project-color: green
repository: 1000lines/symphony-example
base-branch: main
human-lead: Jeremy Carroll
human-lead-github: jeremycarroll
design-issue: 100-70
```

## Goal and boundaries

Enable a hosted Symphony ticket to run the real Docker-backed redis-py CI
workload and the venn-search-rs release build/test workload, using environments
that can be recreated after bootstrap or host replacement. A ticket that
explicitly requires Docker must execute in Docker even when native checks pass.
Both the workload and its evidence must survive a repeatable operational handoff.

All project implementation belongs in **1000lines/symphony-example**, based on
`main`. The acceptance repositories are inputs: `redis/redis-py` (`master`) and
`jeremycarroll/venn-search-rs` (`main`). Do not inherit the implementation base
name when selecting Redis sources. Do not change their product code, repository
permissions, or upstream workflows. Evidence and bounded execution adapters can
live in symphony-example; public read-only acceptance checkouts need no upstream
write grant. Keep each checkout inside its owning issue workspace.

Out of scope: engine changes in 1000lines/symphony; client-template enhancement;
a generic CI runner/platform; replacement of upstream CI; package publication;
feature development in either acceptance repository; review/planning-process
changes. This seed creates no implementation, deployment, or verification
tickets and performs no shared-host rollout.

## Sources and observed baseline

Discovery date: 2026-09-11. These are source and capability observations, not
workload acceptance evidence. Full refs below are the initial acceptance pins;
refreshing a target later requires a recorded workflow/coverage diff before
execution. Do not silently follow a floating branch or reuse an older run.

| Input                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Read evidence and use                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Project brief](https://linear.app/1000lines/project/symphony-docker-and-rust-ci-aa1fa72bda08) and [100-70](https://linear.app/1000lines/issue/100-70)                                                                                                                                                                                                                                                                                                                                  | Read through Linear GraphQL, including comments. Authoritative scope, Docker override, evidence and seed ownership. Human request is recorded in the brief and current ticket.                                                                                                                                                                                                                        |
| [Hosted workflow](https://github.com/1000lines/symphony-example/blob/e362e5ad76fa8070ef27bf54fec9d6750195466c/scripts/symphony/runtime-bundle/workflow/WORKFLOW.md)                                                                                                                                                                                                                                                                                                                     | Read at selected `main@e362e5ad76fa8070ef27bf54fec9d6750195466c`; existing native/docker/remote contract, clean task branches and current-head CI.                                                                                                                                                                                                                                                    |
| Bootstrap [packages](https://github.com/1000lines/symphony-example/blob/e362e5ad76fa8070ef27bf54fec9d6750195466c/scripts/symphony/host/install.d/10-os-packages.sh), [Docker](https://github.com/1000lines/symphony-example/blob/e362e5ad76fa8070ef27bf54fec9d6750195466c/scripts/symphony/host/install.d/35-docker.sh), [developer tools](https://github.com/1000lines/symphony-example/blob/e362e5ad76fa8070ef27bf54fec9d6750195466c/scripts/symphony/host/install.d/60-dev-tools.sh) | Read at the same ref. Docker package, data-root/socket ownership and daemon setup already exist. Compose and Rust installation are absent from these steps.                                                                                                                                                                                                                                           |
| [Prior fan-out example](https://github.com/1000lines/symphony-example/blob/e362e5ad76fa8070ef27bf54fec9d6750195466c/docs/symphony-plans/fan-out-plan-100-7-hackathon-ready.md)                                                                                                                                                                                                                                                                                                          | Read for reuse/context. Its Rust work and historical acceptance decisions do not establish this project's deployment or hosted execution.                                                                                                                                                                                                                                                             |
| Redis [integration CI](https://github.com/redis/redis-py/blob/41585545ee8284d3a51797fdfa1ff995866ab558/.github/workflows/integration.yaml), [package script](https://github.com/redis/redis-py/blob/41585545ee8284d3a51797fdfa1ff995866ab558/.github/workflows/install_and_test.sh), [Compose](https://github.com/redis/redis-py/blob/41585545ee8284d3a51797fdfa1ff995866ab558/docker-compose.yml)                                                                                      | Raw GitHub HTTP 200 at `41585545ee8284d3a51797fdfa1ff995866ab558`. Also read the [composite action](https://github.com/redis/redis-py/blob/41585545ee8284d3a51797fdfa1ff995866ab558/.github/actions/run-tests/action.yml), [tasks.py](https://github.com/redis/redis-py/blob/41585545ee8284d3a51797fdfa1ff995866ab558/tasks.py), pyproject/dev requirements, AGENTS/CLAUDE, and test network helpers. |
| Rust [CI](https://github.com/jeremycarroll/venn-search-rs/blob/99528c2e4da241ec2c9961d0a155357611f16a76/.github/workflows/ci.yml), [Cargo manifest](https://github.com/jeremycarroll/venn-search-rs/blob/99528c2e4da241ec2c9961d0a155357611f16a76/Cargo.toml), [README](https://github.com/jeremycarroll/venn-search-rs/blob/99528c2e4da241ec2c9961d0a155357611f16a76/README.md)                                                                                                        | Raw GitHub HTTP 200 at `99528c2e4da241ec2c9961d0a155357611f16a76`; also read CLAUDE and the recursive tree. Edition 2021, release LTO, four mutually exclusive color features, no committed Cargo.lock/toolchain pin at this ref.                                                                                                                                                                     |
| Implementation repository conventions                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Read README, MIGRATION, `.symphony.cfg.json`, package/toolchain files, `.github` guidance/workflows/PR template, bundle repository-config reference, proof-of-work and Cadence acceptance contract. Configuration is valid for team `100`.                                                                                                                                                            |

No pinned primary requirements source is unavailable. Browser cache misses for
GitHub pages were recovered with successful raw source reads. The brief's
Copier revision `e7a9be3` is setup-template provenance with no repository locator;
`git show e7a9be3` in symphony-example reports `bad revision`. Its template contents
were not independently verified. The complete generated issue and current brief
supply this seed's contract; no product or acceptance conclusion depends on that
historical template. Do not claim to have read it.

### Prerequisite findings

| Observation under the hosted worker                                                                                                                                                            | Consequence and owner                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UID/GID `993:993` (`symphony`), Linux `x86_64`; Docker client `25.0.14`, Engine `25.0.16`; daemon reachable                                                                                    | Retain existing Docker architecture. Execution owner must recheck identity, architecture, resource limits and daemon access in every acceptance ticket.                                      |
| `docker compose version`: `docker: 'compose' is not a docker command`                                                                                                                          | Bootstrap owner installs a pinned Compose CLI plugin and exercises discovery through the worker's actual PATH/config.                                                                        |
| Python `3.9.25`; `cargo`/`rustc` commands absent                                                                                                                                               | Redis requires Python >=3.10. Select container toolchains below instead of adding seven Python interpreters and Rust to the host.                                                            |
| Redis publishes proxy API port 4000; `ss -ltn '( sport = :4000 )'` shows Symphony already listening on `*:4000`                                                                                | Redis execution owner must isolate networking; changing only Compose project names is insufficient. Tests hard-code `localhost:4000` in `tests/maint_notifications/proxy_server_helpers.py`. |
| Installed bundle reports source `a3b7428a9e0298592e119a57923854b75a9b61a0`, installed `2026-09-11T22:17:18Z`; bundle digest `f9da3201fffc6bcdb62ef728213b95d5de2c9e39939d1a8b2fba428b1a7e60b3` | Installed repository validator lacks the selected source's `ci.mode` support. Rollout owner must refresh and read back installed behavior; source merge alone is insufficient.               |
| Reading `/var/lib/symphony-bootstrap/provenance.json` returns `PermissionError` / EACCES                                                                                                       | Jeremy/operator supplies a nonsecret bootstrap/runtime provenance projection during rollout. This gates installed-ref evidence, not independent design or implementation.                    |
| Cached `rust:1.90.0-slim` digest is present; an unmounted, UID 993 container reports rustc/cargo 1.90.0, only cargo/rust-std/rustc components                                                  | Build the Rust execution image with clippy and rustfmt. This capability probe ran no repository tests and its container was removed.                                                         |

## Requirements and acceptance criteria

| ID  | Requirement                                                                        | Required proof and completion condition                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 | Honor an explicit ticket Docker requirement using existing CI modes/command arrays | A hosted ticket declaring Docker runs its build/test commands in containers. A passing native check cannot turn this into a Docker skip or remote-only run. Record effective mode and source of the override.                                                              |
| R02 | Run redis-py's applicable integration, build and install workload                  | Execute every cell in the coverage table below at the pinned target, with real Redis dependencies and preserved suite selections. All required build/test cells pass; no missing cell or unavailable dependency is counted as passed.                                      |
| R03 | Run Rust release build and existing CI coverage                                    | Release build, four feature-specific release tests and four explicit doc-test commands pass. Run both clippy commands and formatting; report their actual outcomes independently and require them to pass before claiming the full Rust CI workload is green.              |
| R04 | Reproduce environments                                                             | Record image digests, language/compiler/package versions and dependency locks/constraints; replay from those inputs. Use workspace-owned caches and outputs. A floating tag or the word `stable` alone is insufficient.                                                    |
| R05 | Preserve isolation and truthful failure                                            | No collision with Symphony/another issue; no public test ports, host socket mount, or unrelated resource removal. Capture command exits, timeout/OOM/cancel outcomes, test counts/skips and service logs; verify cleanup on success and failure.                           |
| R06 | Deliver bootstrap/runtime support through symphony-example                         | Necessary installer, bundle/config guidance and bounded workload adapter changes are reviewed on clean `main`-based branches, locally checked and validated by current-head implementation CI. Do not add a new mode schema or dispatcher.                                 |
| R07 | Prove installed operation and repeatability                                        | After accepted rollout, actual hosted tickets execute both workloads. Repeat the complete selected workload set in a fresh workspace/environment after bootstrap/reconciliation rehearsal using recorded refs and locks. No manual installed-file edits are prerequisites. |
| R08 | Leave durable, attributable evidence                                               | Each run links target SHA, implementation/installed refs, worker identity, environment, exact commands/exits and artifacts. Distinguish workload acceptance from implementation GitHub CI and from historical upstream runs. Human acceptance owns completion.             |

## Locked design decisions

| ID  | Decision and rationale                                                                                                                                                                                                                 | Enforcing responsibility                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| D01 | Reuse selected-base `ci.mode` (`native`, `docker`, `remote`) and existing executable/argument arrays. Ticket Docker direction overrides a less restrictive default for that acceptance run. Preserve native/remote behavior elsewhere. | Runtime/config implementation; R01/R06.       |
| D02 | Use Docker for both initial acceptance workloads. Redis requires it; Rust containers avoid a new host toolchain and also exercise explicit Docker support.                                                                             | Both workload owners; R02/R03/R04.            |
| D03 | Preserve the entire pinned integration workflow's build/test matrix. Bound execution concurrency rather than deleting axes to fit one worker turn.                                                                                     | Redis owner; R02.                             |
| D04 | Put Redis services and the test process in one task-owned network namespace with no host port publishing. Adapt Compose networking, not tests or assertions.                                                                           | Redis owner; R05, topology below.             |
| D05 | Keep source acquisition and Docker orchestration on the hosted worker. Containers receive only issue-workspace files and selected nonsecret variables, not GitHub/Linear keys or the host Docker socket.                               | Both workload owners; R05.                    |
| D06 | Extend existing installer/bundle locations only where the observations require it: Compose availability, portable workload instructions/assets, and installed mode support.                                                            | Bootstrap/runtime owner; R06.                 |
| D07 | Keep installation, source validation and hosted acceptance as separate evidence. Full repeatability rehearsal is required even when the existing host already has a useful cached image.                                               | Rollout and final acceptance owners; R07/R08. |

No material product decision remains open. Image compatibility, dependency
resolution, actual check/App identities, run duration and operator grants are
verification inputs with owners, not questions for the planning seed. A
necessary reduction of R02/R03 coverage or a move outside this implementation
repository would be a material change requiring recorded human direction.

## Redis workload contract

The `integration.yaml` job `tests` has 13 configurations: `fixed-clients`, plus
`{default,2,3}-{legacy_responses,unified_responses}-{standalone,cluster}`.
`CURRENT` is **8.8.0**; the custom map resolves **8.10 → 8.10.0**.

| Job                           | Required axes                                                                                                                  | Cells |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----: |
| `tests`                       | Redis 8.10, 8.8.0, 8.6.3, 8.4.3, 8.2.6, 8.0.6, 7.4.9, 7.2.14 × CPython 3.10, 3.14 × plain parser × asyncio × 13 configurations |   208 |
| `python-compatibility-tests`  | Redis 8.8.0 × CPython 3.11, 3.12, 3.13 × plain × asyncio × 13                                                                  |    39 |
| `pypy-compatibility-tests`    | Redis 8.8.0 × PyPy 3.10, 3.11 × plain × asyncio × 13                                                                           |    26 |
| `hiredis-tests`               | Redis 8.8.0 × CPython 3.10, 3.14 × hiredis `>=3.2.0`, `<3.0.0` × asyncio × 13                                                  |    52 |
| `uvloop-tests`                | Redis 8.8.0 × CPython 3.10, 3.14 × plain × uvloop × 13                                                                         |    26 |
| `build-and-test-package`      | CPython 3.10, Redis/Stack 8.8.0; `tar.gz` and `whl` package install/test                                                       |     2 |
| `install-package-from-commit` | CPython 3.10–3.14 and PyPy 3.10/3.11; install the exact Git commit                                                             |     7 |

There are **351 integration cells and 9 package/install cells**. In addition,
the `tests` job runs MultiDB integration in each CPython 3.10/3.14 cell with
Redis 8.8.0 and `default-unified_responses-cluster`: **two extra substeps**, not
extra matrix jobs. They need two clusters and two standalone servers.

Run `lint` (`invoke linters`, after the workflow's dependency install and Redis
uninstall), and `dependency-audit` as separate status entries. Audit uses the
pinned action `pypa/gh-action-pip-audit@v1.0.8` semantics over
`dev_requirements.txt`, ignoring only `GHSA-w596-4wvx-j9j6`, `CVE-2026-34073`,
`CVE-2026-4539` from this source. Its local CLI equivalent is
`pip-audit -r dev_requirements.txt --ignore-vuln GHSA-w596-4wvx-j9j6 --ignore-vuln CVE-2026-34073 --ignore-vuln CVE-2026-4539`;
record the resolved audit tool/database timestamp. A failure is reported even if
all build/test cells pass. `redis_version` is value preparation, not a test.

Excluded with justification: Codecov upload (external reporting, non-fatal in
upstream CI; retain coverage XML locally); Actions checkout/cache/artifact
transport (replace with exact checkout and durable evidence). Preserve upstream
scenario-test exclusions requiring external fault-injection/Enterprise services;
do not newly exclude maintenance-notification tests or MultiDB. Separate docs,
CodeQL, nightly performance, publishing and maintenance workflows are outside
this selected build/test workload. Do not report all repository workflows green.

### Commands and environment translation

Reuse the pinned composite action and `tasks.py`; keep the source ref and the
adapter diff with the run. For each interpreter/parser environment, reproduce:

```bash
pip install -r dev_requirements.txt
pip uninstall -y redis
pip install -e '.[jwt]'
```

For hiredis cells also run `pip install 'hiredis>=3.2.0'` or
`pip install 'hiredis<3.0.0'` as selected, retaining that older-version coverage.
Fresh environments prevent hiredis or uvloop state leaking into another axis.
Set `COVERAGE_CORE=sysmon`; retain upstream compatibility constraints for PyPy
and uvloop. Record `python --version`, `pip --version`, `pip freeze --all`, the
actual parser/interpreter, and the built image ID for every environment.

Map Redis <8 to Stack `rs-7.4.0-v8` for 7.4.9 and `rs-7.2.0-v20` for 7.2.14,
with `REDIS_MOD_URL=redis://127.0.0.1:6479/0`. For Redis >=8 use the same resolved
Redis tag for both service image anchors and
`REDIS_MOD_URL=redis://127.0.0.1:6379`. Both package cells instead set both anchors
to 8.8.0 as their workflow does. Freeze resolved image tags/digests before any
later `cluster2` startup; never fall back to Compose's 8.6.1 default.

Host-side setup reproduces `invoke devenv --endpoints all` (>=8) or
`invoke devenv --endpoints=all-stack` (<8 and package jobs). `devenv` first calls
`clean`, then `docker compose --profile "$endpoints" up -d --build`; keep that
fresh-environment behavior, but scope cleanup to the generated task project.
Validate standalone/TLS, replica, sentinel, module, proxy and cluster health
before tests. The upstream ten-second settling delay is not sufficient proof
that a cluster or dependency is ready.

| Configuration                  | Exact task invocation inside the test container                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| fixed client                   | `invoke fixed-client-tests`                                                                                                                                  |
| default / legacy / standalone  | `invoke standalone-tests --redis-mod-url="$REDIS_MOD_URL" --legacy-responses`                                                                                |
| default / unified / standalone | `invoke standalone-tests --redis-mod-url="$REDIS_MOD_URL" --no-legacy-responses`                                                                             |
| default / legacy / cluster     | `invoke cluster-tests --legacy-responses`                                                                                                                    |
| default / unified / cluster    | `invoke cluster-tests --no-legacy-responses`                                                                                                                 |
| explicit RESP2/RESP3           | Add `--protocol=2` or `--protocol=3` to the corresponding standalone/cluster invocation                                                                      |
| uvloop                         | Add `--uvloop` to every selected invocation, including fixed clients                                                                                         |
| MultiDB substep                | Host: `docker compose up -d --wait --wait-timeout 120 cluster2`; container: `invoke multidb-integration-tests`                                               |
| package build/install/test     | `bash .github/workflows/install_and_test.sh tar.gz` and `bash .github/workflows/install_and_test.sh whl`, with the setup-only adaptation below               |
| install exact commit           | `pip install --quiet git+https://github.com/redis/redis-py.git@41585545ee8284d3a51797fdfa1ff995866ab558` in each of the seven clean interpreter environments |

Run the exact package script in a disposable source copy at its original path.
Its one host-orchestration call, `invoke devenv --endpoints=all-stack`, must be
replaced by a recorded assertion of the already provisioned matching environment.
The worker provisions that environment immediately before the container runs.
Keep the rest of the script unchanged, including venv creation, dependency
install, `invoke package` (`python -m build .`), artifact install and **both**
standalone and cluster pytest invocations/markers/ignores. Record the minimal
patch and upstream script hash; fail if its expected setup line changes. This
avoids passing the Docker socket into a dependency-running container. It is not
permission to replace the package test with a smoke test. Preserve package
pytest results with additive `PYTEST_ADDOPTS=--junitxml=<cell-specific-path>`.

Capture every cell's `junit-results/*-results.xml`, coverage XML, complete command
log, exit status and test/skip counts before starting the next cell; upstream
filenames otherwise overwrite results. MultiDB's unreachable-endpoint skips
must fail acceptance when either required topology is absent. Version-based
upstream skips are reported with their reasons, not counted as tests executed.
Use the upstream 60-minute test-cell timeout and 50-minute PyPy timeout; bound
package/install commands as well (60 minutes each). Start at one Redis cell at
a time. Batching/resume across hosted tickets is allowed with the same immutable
inputs and a complete cell ledger; budget exhaustion leaves remaining cells
unrun. Do not combine results across changed dependency/image/source pins.

### Task network and resource isolation

Use Docker's existing [container network sharing](https://docs.docker.com/reference/cli/docker/container/run/#network)
and Compose's [network_mode](https://docs.docker.com/reference/compose-file/services/#network_mode).
The worker creates a task-owned namespace anchor container; all Redis services
and the test container join it. This retains `localhost` endpoints without
publishing ports. No host networking or nested privileged Docker daemon is needed.

Derive a complete effective Compose file in the workspace from the pinned
source. Give it a unique `COMPOSE_PROJECT_NAME` for issue/run/cell, remove fixed
`container_name`, `ports` and per-service `networks`, and set
`network_mode: container:<anchor-id>`. Retain images, dependency relationships,
profiles, mounts and health checks. Replace only service-to-service address
inputs with `127.0.0.1`: replica's `--replicaof redis 6379`, proxy's
`TARGET_HOST=redis-proxied`, and the `redis` monitor address in a task copy of
`dockers/sentinel.conf`. Record these configuration-only changes. The runner
joins with `--network container:<anchor-id>`; use no `extra_hosts`/`--add-host`
options, which are incompatible with container network sharing.

The source's `redis-stack` would collide with standalone's port 6379 in a shared
namespace. Set that service's existing `PORT` environment input to **6479**;
clients already expect 6479. All other source ports remain: standalone 6379/6666,
replica 6380, cluster 16379–16384/27379–27384, second cluster
16385–16390/27385–27390, sentinel 26379–26381, proxied Redis 3000 and proxy
15379–15381/4000. Verify announced cluster endpoints and replica/sentinel
resolution in the namespace. Preserve TLS material and real module images.
Record the rendered file/diff and verify no service exposes a host port.

Container network sharing and the port adjustment are a design to be exercised,
not a proven compatibility claim. Failure to run a service under this topology
is a failed environment test; repair the adapter without weakening coverage.
Run a concurrent pair of isolated small environments and confirm Symphony's
port 4000 listener remains unchanged before the full matrix.

Run build/test containers with the workspace UID/GID and workspace-local writable
venvs/cache/target paths. Pre-create bind-mounted data with correct ownership;
verify the Redis images can also operate with that UID and bounded writable
paths before matrix execution. If an image's entrypoint cannot, record the exact
failure and implement a narrowly derived image/writable-path adjustment rather
than making worker artifacts root-owned. Pin that derived image as well.

On success, failure, timeout, cancellation or partial startup: save service
logs/inspect results first, then use the generated project/file for
`docker compose --profile '*' down --volumes --remove-orphans`, remove its runner
and namespace anchor, and verify their IDs and project-labelled resources are
gone. Capture cleanup's independent exit status while preserving the original
test failure. Abrupt termination requires the next attempt/operator to clean
the recorded task IDs before reuse. Never run a global Docker prune or an
unscoped upstream `invoke clean` on the host.

## Rust workload contract

Use `rust:1.90.0-slim` at
`rust@sha256:7fa728f3678acf5980d5db70960cf8491aff9411976789086676bdf0c19db39e`,
Linux amd64. Derive an image that runs
`rustup component add --toolchain 1.90.0 clippy rustfmt` at image-build time;
record the resulting immutable image ID and verify components as the worker UID.
The base probe reported `rustc 1.90.0 (1159e78c4 2025-09-14)` and
`cargo 1.90.0 (840b83a10 2025-07-30)`. Upstream uses floating `stable`; this
project chooses a concrete toolchain for reproducibility. A compatibility
failure can justify a reviewed pin update with a full rerun, never a silent
switch to latest or a reduction in feature coverage.

Use a task-owned `CARGO_HOME` and `CARGO_TARGET_DIR` under the workspace. Keep
rustup's image-installed toolchain path intact. The pinned repository has no
Cargo.lock: generate one once with this toolchain, retain its contents and hash
as an acceptance artifact, and reuse it for replay. Use `--locked` after that
preparation; do not imply that the lock came from upstream. Cache keys include
toolchain/image, architecture, lock hash and feature; acceptance must work with
an empty compiled-output cache. Resolve registry access before offline claims.

Run these commands separately so every exit and feature is attributable:

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

The runner must record and propagate failures from every command, including
inside the loop; the listing is a workload specification, not a failure-handling
wrapper. Never use `--all-features`: the manifest says only one color feature
should be active at a time. Retain the explicit doc-test steps even if cargo test
also invokes doc tests. Give each command a 60-minute bound and preserve output,
test counts and zero-doc-test observations without inventing coverage. Do not
repair upstream clippy/format findings in this project; report them as failures
and route any product change to Jeremy. A build/test pass with lint failure is
not a fully passing CI workload.

## Reproducible environment inventory

Install Compose **v2.39.4** as a CLI plugin through the existing bootstrap tooling.
The [official release](https://github.com/docker/compose/releases/tag/v2.39.4)
asset metadata was read successfully: Linux x86_64 binary SHA-256
`7af95166a730b87e172d4fc9aefea8725d3c6c7327d59149267b452114ddb7d4`;
aarch64 `49082844b87f03cdcd5f5bbef1ba8c9c897b7a2dfb80cea18d61ec8ca6117e0c`.
Verify downloads/checksums and an idempotent rerun; do not overwrite an
operator-managed conflicting installation. Initial acceptance is Linux amd64;
arm64 assets alone do not prove image/workload compatibility on another host.

The following Docker Hub manifest/config reads succeeded on the discovery date.
Use each listed digest, not the discovery tag. These are image availability and
metadata observations; actual interpreter/server versions, pulls, derived image
builds and workload compatibility still require execution readback.

| Image discovery tag                       | Interpreter metadata / purpose               | Immutable manifest digest                                                 |
| ----------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| `library/python:3.10-bookworm`            | PYTHON_VERSION=3.10.21                       | `sha256:94c362db08c5b38857943d31b10558ff1856e918605c474d205d72a534929d4e` |
| `library/python:3.11-bookworm`            | PYTHON_VERSION=3.11.16                       | `sha256:35d3a4a3d5e42e02ab916d44513a050689f12c0533d45598d229672503fe77ca` |
| `library/python:3.12-bookworm`            | PYTHON_VERSION=3.12.14                       | `sha256:581429e3df12d76e6af4be5ab7d0e7fc2013eb57dc23d2de691411c8efdbb970` |
| `library/python:3.13-bookworm`            | PYTHON_VERSION=3.13.15                       | `sha256:933b46a028fd786c9c3d426ebabc237e29a15912231ea8de576e95f0e4f41a4c` |
| `library/python:3.14-bookworm`            | PYTHON_VERSION=3.14.7                        | `sha256:ecac9e212daacda8a702eae372fceebc0ee36f5805abe087880367e8d061fa5b` |
| `library/pypy:3.10-bookworm`              | PYPY_VERSION=7.3.19                          | `sha256:561e43edba15cf42380165f336ac8bafd8245adbd150d8ffe1439c708d0a7683` |
| `library/pypy:3.11-bookworm`              | PYPY_VERSION=7.3.23                          | `sha256:7670cfb80d068a3102e8abb84d0c339ac0ab3d75291377c3d8121894eb9929fa` |
| `redislabs/client-libs-test:8.10.0`       | Redis/Stack service                          | `sha256:d349c6875600403edaa02fa0e7f6f79b6fab74c0e490822b0c37d8d85f6f0d89` |
| `redislabs/client-libs-test:8.8.0`        | Redis/Stack service                          | `sha256:319b628cb1f3347ac22c883860d7db10bec69948bbd0f9aee4d676899285cde4` |
| `redislabs/client-libs-test:8.6.3`        | Redis/Stack service                          | `sha256:adacb737b2fb2d3af13c174d8dff3aaaa568c3d71d8442c71c2f4e1c658029ff` |
| `redislabs/client-libs-test:8.4.3`        | Redis/Stack service                          | `sha256:f197b4e7cb3fcc579c80137dd93b18667e87d315aa8588071125117a91402a12` |
| `redislabs/client-libs-test:8.2.6`        | Redis/Stack service                          | `sha256:6b46280e521cc542d0da8bf110731127b7892efa716cf91e9a658b4361a2f175` |
| `redislabs/client-libs-test:8.0.6`        | Redis/Stack service                          | `sha256:59d7b984e44cc23f080de72f29f2427ef159656184e6e75360bc82a6f1a3a820` |
| `redislabs/client-libs-test:7.4.9`        | Redis/Stack service                          | `sha256:bc45dc80848d1c818e330fa24d3c1958ea3ebf37aeaa931a2ec68c8397c15d4f` |
| `redislabs/client-libs-test:7.2.14`       | Redis/Stack service                          | `sha256:58b1a5f3ba536b7cde2acccb6846d01a2d82e5e3ef295e173a1b5ea092dd8016` |
| `redislabs/client-libs-test:rs-7.4.0-v8`  | Redis/Stack service                          | `sha256:b44db722c9a9f280685e97547ec95e4fdf984505e2e24b9e9de19202a462048e` |
| `redislabs/client-libs-test:rs-7.2.0-v20` | Redis/Stack service                          | `sha256:e38ffd865fb1262cf1bacab7e455e7850c19b50d765db63e5016a7f9d40153b6` |
| `redislabs/client-resp-proxy:latest`      | RESP proxy; upstream tag was implicit latest | `sha256:dd4d42aa066a613c8951c9dc56110d13112068cdf10c137b30e24ba0f1bd52d6` |

Redis and Python development dependencies include floating ranges. The execution
owner must resolve and retain per-interpreter/parser constraints, pip/build
tool versions, package hashes and a wheelhouse or equivalent reproducible image
artifact. Constrain nested package-build/venv installs too, including pip upgrade
and Hatchling; `pip freeze` alone is not a complete build lock. Preserve upstream
requirements and fail conflicting resolution. Rust uses its retained Cargo.lock.
Archive/pin the final images and required dependency artifacts through an
authorized artifact route; no package/image publication is implicitly required.

## Bootstrap, rollout and repetition

Implementation should add the missing Compose support to the existing host
installer and package only the small workload recipes/adapters needed here.
Keep executable command arrays and accepted CI modes; reference installed
tooling through `SYMPHONY_TOOLING_ROOT`. Add meaningful checks for Compose
checksum/architecture/rerun behavior, effective mode precedence, isolation and
failure/cleanup propagation. Do not install a separate planning framework.

Jeremy is the shared-host operator. The rollout owner first prepares a reviewable
runbook containing accepted bootstrap SHA, unchanged or explicitly selected
runtime SHA, bundle/workflow hashes, commands, expected readbacks and rollback
refs. Coordinate shared-host changes through the existing drain/install/reload
procedure. Use the existing `scripts/symphony/host/install-runtime.sh` entrypoint:
full installation on a replacement/rehearsal host; selected installer steps for
an existing host; `--runtime-bundle-refresh` for source/bundle/config/provenance.
That refresh **does not install Compose or restart/reload Symphony by itself**.
Name and execute the additional installed step and required reload explicitly.

Record the actual installer exit/log, then read nonsecret provenance and
`runtime-bundle-manifest.json`, rendered workflow hash, service health and a
new worker's mode/Compose/toolchain probes. Preserve the Docker data-root/socket
configuration and workspace mount ordering; never relocate another worker's
containers as part of this change. Re-running bootstrap must be safe, and
recreating the environment from accepted pins must not depend on a hand-edited
installed skill, shell PATH or warm compiled cache.

Only then execute the complete Redis and Rust acceptance workloads from hosted
Symphony tickets. Repeat them in fresh workspace-owned environments after the
bootstrap/reconciliation rehearsal, with the same target and dependency pins.
If full host replacement is unavailable, run the existing bootstrap's idempotent
reconciliation plus a cold workload-environment recreation and record the
limitation explicitly; do not claim a replacement host was tested. A plan must
retain the deployment/rehearsal and final evidence ownership, not stop at merged
source or an upstream GitHub badge.

If an operator operation is unavailable, prepare the exact action first and
record repository/App or host, denied operation/error, required grant, Jeremy's
action and expected readback. That gates only the rollout or publication needing
the grant; independent code and public-source workload preparation continue.

## Evidence and handoff contract

For every acceptance attempt record:

- Issue/run/cell identity and timestamps; target repository/full SHA, workflow
  source SHA, implementation adapter SHA, source-copy patch/hash and effective mode.
- Selected versus actually installed bootstrap/runtime refs, bundle/workflow
  hashes; worker/instance identity, UID/GID, architecture, Docker/Compose versions,
  resource limits and workspace/cache paths. Do not put secrets in artifacts.
- Image repository digest and actual local image ID for every service/toolchain,
  resolved compiler/interpreter/package versions and locks/constraints/hashes.
- Exact commands/arguments/environment allowlist; individual exits and elapsed
  times; full logs, JUnit/coverage or cargo output; expected/executed/missing cell
  inventory, test counts, skips and reasons. Retain failures before retrying.
- Cleanup commands/exits and remaining-resource readback, result
  (`pass`, `fail`, `blocked`, `unrun` or justified `skipped`), limitation and next owner.

Publish a concise acceptance index in symphony-example and attach or link full
logs/results through existing authorized GitHub/Linear artifact facilities.
Include artifact hashes; a private workspace path alone is not reviewable proof.
No upstream write permission is needed for local execution: use the implementation
PR/workpad evidence route. A pre-existing GitHub success proves only its own run,
not a hosted Symphony run. If the target SHA changes, reacquire coverage and
produce matching evidence; do not mix source revisions in one green claim.

Implementation PRs separately require current-head `CI Required` from
`.github/workflows/ci.yml` (build/lint/test/changed-Markdown children) and
`Client template tests` from `.github/workflows/client-template-test.yml`, both
GitHub Actions App `15368` at the selected baseline, plus any applicable branch
rules. Capture actual run/attempt, event/ref, tested SHA, emitting App, child
results and links. Recheck configuration when implementation starts. Required CI
and a fresh configured Cadence review with closed mandatory feedback precede
ready/mature/human handoff. Human acceptance owns Done.

For **this document's** publication, run locked Prettier and a structural/source
coverage check locally, then mandatory implementation-repository CI. Docker is
skipped for document validation if those local checks pass. That skip has no
effect on R01 or the required future Docker acceptance runs.

## Inputs for the planning seed

100-71 must produce the reviewed DAG/manifest using the existing shared planning
tooling; this requirements document is not a second plan or ticket schema. Copy
R01–R08 and D01–D07 into the owning tasks' acceptance obligations. Allocate
responsibility for bootstrap/runtime support, Redis environment/coverage,
Rust environment/coverage, installed rollout/repetition and final evidence.
Redis and Rust preparation can proceed independently; installed acceptance
depends only on the support and operator actions it actually uses. All task
branches and PRs target symphony-example `main`; upstream acceptance SHAs never
become task branch bases. Do not copy unmerged predecessor work.

| Execution input                                                                                                          | Owner                                                      | Work gated                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Image pulls, derived-image UID compatibility, Python constraints/build locks, Rust lock and clippy/rustfmt compatibility | Respective workload implementation owner                   | Only the affected environment and its acceptance cells; preserve failures and verified pins   |
| Actual resource availability, batching duration, platform support, network/TLS/cluster health and cleanup checks         | Respective execution owner                                 | Hosted execution on that worker, not independent implementation                               |
| Installed bootstrap/runtime provenance currently unreadable; shared-host deployment/reload access                        | Jeremy/operator with rollout owner                         | Rollout readback and R07 evidence                                                             |
| Actual GitHub checks, App/workflow provenance and writable artifact route                                                | Publishing/execution owner using current bound credentials | Publication/evidence operation requiring that access; no speculative upstream grant expansion |
| Complete repeat run and remaining failures/skips                                                                         | Final acceptance owner, Jeremy accepts                     | Final R02/R03/R07/R08 acceptance                                                              |

Unknown IDs, SHAs selected at rollout, check names after source changes and
externally supplied credentials must be discovered and recorded at execution.
They do not become global blockers or new product questions. Any newly
unavailable primary requirement source is recorded with its exact access failure
and gates only dependent conclusions/actions; continue independent work.
