# Isolated Redis CI environments

The host CLI in `scripts/symphony/ci/redis-environment/cli.mjs` prepares the
environment consumed by [100-90](https://linear.app/1000lines/issue/100-90).
It implements the environment portion of the
[accepted design](../../symphony-plans/docker-rust-ci/requirements-and-design.md)
for redis-py `41585545ee8284d3a51797fdfa1ff995866ab558`, Linux amd64.
Full matrix execution and package-script adaptation belong to 100-90.

## Inputs and preparation

Use Node 20.20.0, npm 11.13.0 and `npm ci` in the tooling checkout. Docker must
be reachable as the workspace owner. Compose must be v2.39.4. If the installed
plugin is unavailable, download its Linux x86_64 release binary into the issue
workspace, verify SHA-256
`7af95166a730b87e172d4fc9aefea8725d3c6c7327d59149267b452114ddb7d4`,
and pass its path using `--compose`. This does not install or replace a plugin.

Acquire the upstream checkout on the host, read its AGENTS/CLAUDE instructions,
and detach at the exact source commit. The CLI verifies the source commit,
tracked cleanliness, and hashes of the input files. It uses `git archive` to
create a separate source copy for each attempt. Workload containers receive
only task files; GitHub and Linear credentials remain on the host.

From the issue workspace containing the tooling checkout and `redis-py/`:

```bash
env_cli="$PWD/scripts/symphony/ci/redis-environment/cli.mjs"
env_output="$PWD/redis-attempt-1"
env_args=(--workspace "$PWD" --source "$PWD/redis-py"
  --issue 100-88 --run attempt-1 --cell py310 --output "$env_output")

node "$env_cli" prepare "${env_args[@]}" \
  --lock "$PWD/scripts/symphony/ci/redis-environment/inputs.json" \
  --redis 8.8.0 --python 3.10 --parser plain
```

`inputs.json` contains all eighteen design-pinned image manifests and upstream
input hashes. Initial preparation resolves the selected manifests to local
image IDs, downloads/builds wheels, then checks their hashes and proves
installation from that wheelhouse. It retains the original dev requirements,
JWT extra, selected hiredis and interpreter-specific uvloop constraints.
Supported interpreters are `3.10` through `3.14`, `pypy-3.10`, and `pypy-3.11`.
Parser choices are `plain`, `hiredis-old` (`<3.0.0`) and `hiredis-new`
(`>=3.2.0`); hiredis axes use CPython 3.10/3.14 as upstream specifies.
The retained old axis installs hiredis 2.4.0 and tests its reader. At this Redis
source revision the default connection falls back to `_RESP3Parser` with that
version; hiredis 3.4.1 selects `_HiredisParser`. The catalog records both the
installed version and actual parser without dropping the old-installed case.

The bootstrap constrains pip 25.3, setuptools 80.9.0, wheel 0.45.1,
Hatchling 1.27.0 and editables 0.5. Resolution produces exact transitive
constraints and hash-locked wheel requirements. A fresh nested venv exercises
the pip upgrade and isolated sdist/wheel build used by the upstream package
script. Dependency resolution, import, parser or nested-build failures fail
preparation; they never drop old hiredis or another interpreter from coverage.
PyPy also resolves `pycparser`: the pinned 3.10 image bundles CFFI but omits
that declared dependency. The image digest pins bundled CFFI; the wheel lock
pins the added dependency.

## Start, check, stop

```bash
env_lock="$env_output/environment-lock.json"
node "$env_cli" up "${env_args[@]}" --lock "$env_lock"
node "$env_cli" check "${env_args[@]}" --lock "$env_lock"
node "$env_cli" down "${env_args[@]}" --lock "$env_lock"
```

Pass the same `--compose` path to every operation when using a workspace binary.
Every process returns nonzero on failure. Use a shell trap around downstream
commands so `down` also runs after command failure, timeout or cancellation;
capture the command's exit separately from cleanup's exit. Failed lifecycle
operations attempt cleanup themselves and preserve the original failure.
After abrupt process termination, repeat `down` with the recorded output and
identity before starting another attempt. `down` can operate after the original
upstream checkout has disappeared. It never requires the lock to validate
successfully before cleaning up its recorded resources.

The generated Compose file retains all eight upstream services, their profiles,
dependencies, TLS inputs, mounts and healthchecks. It removes fixed names,
published ports and service networks. All services join a namespace anchor
named `drc-ISSUE-RUN-CELL-anchor`; `up` records its actual container ID and
renders `network_mode: container:ID`. Replica, sentinel and proxy upstream
addresses become loopback, and Stack listens on 6479. Both clusters are
provisioned for the environment compatibility check. The original Compose
and sentinel fixtures are unmodified copies of the pinned MIT-licensed Redis
sources, verified by their input hashes.

Services use the workspace UID/GID, dropped capabilities, no new privileges,
CPU/memory/PID limits and task-owned writable directories. The proxied server
also receives a writable `/redis/work` directory. Each cluster has a 768 MiB,
one CPU limit; other services have 256 MiB and half a CPU. The Python runner
has 2 GiB and two CPUs; the namespace anchor has 32 MiB and one tenth of a CPU.
These are per-container ceilings, not reserved aggregate host capacity.
Queue Redis/Rust workloads unless the operator confirms aggregate headroom.
One Redis cell runs at a time; only the bounded isolation probe uses a pair.
Redis 8.4.3 and older pinned server images declare `/data` as an image volume.
The renderer binds that path to each service's workspace data directory,
preventing Docker from allocating storage outside the workspace. Preparation
checks the declared image-volume inventory before starting workloads.

`check` verifies the exact service inventory, UID/GID, network namespace,
mount containment and absence of published ports. It then checks standalone,
all proxy listeners, replica synchronization, three sentinel monitors, both
six-node clusters and their announced loopback endpoints, all TLS endpoints,
real Search/JSON/TimeSeries/Bloom modules and the proxy API. It records actual
server versions and fails when any required topology is missing.

## Replay and downstream contract

The committed
[environment catalog](../../../scripts/symphony/ci/redis-environment/environment-catalog.json)
lists the resolved image IDs and each interpreter/parser replay bundle. On the
host, download the selected authorized Linear attachment, verify its catalog
SHA-256, and extract it into a new directory inside the issue workspace. Each
bundle contains `environment-lock.json` and its dependency artifacts. Pass that
lock to `prepare`; the catalog itself is an index, not a CLI lock. Attachment
readback requires authorized Linear access, which stays outside containers.

Keep `environment-lock.json`, `constraints.txt`, `requirements.lock`,
`wheels.json` and `wheels/` together. To replay, use a new identity and output
directory and pass the previous immutable `environment-lock.json` to `prepare`.
The source and interpreter/parser must match. Redis may select another pinned
version from the inventory; its resolved image IDs enter the new lock.
The replay container has no network, and every wheel must match its SHA-256.
Keep the old attempt intact. Changing pins requires new evidence rather than
combining results into a previous passing attempt.

For a verified CPython 3.10/plain bundle extracted into `verified-replay/`:

```bash
node "$env_cli" prepare --workspace "$PWD" --source "$PWD/redis-py" \
  --lock "$PWD/verified-replay/environment-lock.json" \
  --issue 100-88 --run repeat-1 --cell py310 --output "$PWD/redis-repeat-1" \
  --redis 8.8.0 --python 3.10 --parser plain
```

`state.json` supplies the namespace anchor ID, Compose project/file hash,
resource IDs, selected interpreter image and runner contract. Downstream
containers mount the output directory at `/work`, work in `/work/source`,
join `container:<anchor ID>`, use the same UID/GID and bounded resources, and
carry the exact `drc.owner` label from `state.project`. Use the explicit
`state.runner.environment` allowlist, including workspace-local PATH/HOME,
`PIP_NO_INDEX`, `PIP_FIND_LINKS`, `PIP_CONSTRAINT` and `PIP_BUILD_CONSTRAINT`.
Those variables reach nested venv/pip/build subprocesses too. Do not inherit
the host environment into the container. The matrix runner preserves the
upstream workload commands and gives the two package pytest invocations
different result paths.

Artifacts under each output directory:

| Artifact                                                         | Meaning                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `environment-lock.json`                                          | Source/image pins, selected axis, dependency artifact hashes and interpreter inventory |
| `compose.json`, `compose.yaml`                                   | Effective topology; the JSON file records actual anchor ID after startup               |
| `source/`                                                        | Exact source archive with task-local sentinel address change and writable Redis data   |
| `requirements.lock`, `constraints.txt`, `wheels.json`, `wheels/` | Immutable dependency replay inputs                                                     |
| `python.json`, `package-probe/`                                  | Actual interpreter/packages and nested package-build results                           |
| `state.json`, `command-*.log`                                    | Exact commands, timing/exits, config diffs, inspect/service logs and cleanup readback  |

Preserve logs before scoped Compose down and ID-based removal. Cleanup records
its Compose exit separately, attempts every owned container even if one removal
fails, and reads back remaining labelled containers, networks and volumes.
An incomplete cleanup is a failure. Unrelated IDs are never removed.
Upload replay inputs and evidence through the issue's authorized Linear/GitHub
artifact route; retain URLs and SHA-256 hashes in the committed evidence index.
A local path or an available image alone is not compatibility evidence.

## Validation

```bash
node --test scripts/symphony/redis-ci-environment.test.mjs
node_modules/.bin/eslint scripts/symphony/ci/redis-environment/*.mjs \
  scripts/symphony/redis-ci-environment.test.mjs
node_modules/.bin/prettier --check docs/engineering/symphony/redis-ci-environment.md
git diff --check
```

These local fixtures cover translation, pin enforcement and lifecycle failure
behavior. Required live probes additionally prepare every interpreter/parser,
exercise the pinned server/Stack/proxy topology under the workspace UID, test
isolation and failure/cleanup, and compare the host port-4000 listener and
unrelated container IDs before/after. Fixture success does not replace these
probes or current-head implementation CI.
