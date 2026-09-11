# Symphony client template package

This Copier template checkpoint renders 23 client files: secret-free review ingress,
repository config, worker/reviewer guidance, a direct-path App manifest,
attributes, answers metadata and fourteen client skill/resource files. It is
not ready for publication or onboarding. CI and wakeup callers use the accepted
CT-C interface; CT-L still needs CT-R's reusable review, handoff and cleanup
interfaces and proof listed in [PROVENANCE.md](PROVENANCE.md).

Only `template/` is participant output. Root documentation, tests, workflows,
configuration and any future root client are development assets and never render
into participants' repositories.

| Answer              | Type   | Default / purpose                                |
| ------------------- | ------ | ------------------------------------------------ |
| `repo_slug`         | string | Required GitHub `owner/repository`               |
| `default_branch`    | string | `main`; supply the target's actual branch        |
| `linear_team_key`   | string | Required team key; no repository project binding |
| `symphony_app_slug` | string | Required author App slug, without `[bot]`        |
| `cadence_app_slug`  | string | Required reviewer App slug, without `[bot]`      |
| `cadence_reviewer`  | string | Required choice: `claude` or `codex`; no default |
| `build_command`     | string | Required build command, including multiline      |
| `test_command`      | string | Required test command, including multiline       |

Supply valid target identities and commands without credentials. Commands are
serialized as `bash -lc` argument arrays in config; rendering does not execute
them. Native mode is selected by omission. The initial `ci.requiredChecks: []`
means **unconfigured**, not passing CI. Onboarding must preserve/discover actual
application checks, workflow paths and emitting App IDs before activation.
There is no mode, model, project, credential, App ID or ref question.

`cadence_reviewer` is saved in answers and generated review context. CT-L must
pass it as an explicit input to the reviewed review caller/callee. `codex`
requires `CADENCE_OPENAI_API_KEY`; `claude` requires
`CADENCE_AI_REVIEW_ANTHROPIC_API_KEY`. Both keys present still runs the selected
reviewer. Missing/invalid selection or its matching key fails before provider
execution; no fallback. The initial tree does not execute either provider.
Provision named Actions secrets outside Copier answers and command strings.

## CI callers and validation modes

The generated `symphony-client-ci.yml` calls the reviewed command runner at
`1000lines/symphony-example@fd383f5760a2ba62ea6f6295bd6dd21cc0cb9e9e`.
It runs the supplied build/test commands on the exact PR head or default-branch
push, with read-only repository access and no named secrets. Omit this optional
caller when existing application CI covers the commands. Otherwise, provide
any application setup in those commands or a reviewed caller adjustment; the
runner supplies Ubuntu 24.04, not an application toolchain or Dockerfile.
After changing config commands, reconcile this caller's command arrays too.

`symphony-client-wakeups.yml` calls the accepted wakeup workflow and checks out
its helpers at that same fixed source commit. It passes only
`CADENCE_LINEAR_API_TOKEN`, plus the target repository/default branch and native
event name/payload. Config comes from the target's trusted default branch;
helpers never come from the target PR. Native event filters retain same-repository
PR/run admission, external-check handling and the existing current-head/terminal
guards. The shared bridge handles CI state changes; no new state controller is
generated. Onboarding records the actual required job names, caller workflow
paths and App IDs after a run; seed check names are not participant defaults.

The existing `ci.mode` field controls checks on the Symphony host. Set it in
the target config during onboarding; it is not another Copier answer:

| Mode                          | Target setup and validation                                                                                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `native` (omitted by default) | Use installed tools and the configured command arrays. Passing local checks skip Docker; environment gaps may use the client's documented container.                                                                                                      |
| `docker`                      | Supply the application's Dockerfile and concrete setup/build/test command arrays that build and run it. Mount only the issue workspace, run as its UID/GID, remove task containers and record the image digest/results. No generic Dockerfile is emitted. |
| `remote`                      | Run useful checks with available tools, record missing tools, fix known failures and publish the prepared head for GitHub CI. Installing a toolchain or creating a Docker environment is not required. Unrun checks are not passes.                       |

For Docker mode, a `commands.setup` array can invoke the client's `docker build`;
build/test arrays invoke its documented `docker run --rm` commands. Include the
actual image, workspace mount, working directory and UID/GID arguments. The
mode field does not wrap commands or construct a container automatically.
GitHub CI still needs its own working commands and toolchain in every mode.
All modes require current-head CI: pending/missing checks wait in Unhappy with
`wake:15m`, failures return nonterminal tickets to Active, and passing required
checks return them to Inactive for review. Keep Cadence advisory results outside
required checks. Live host/bridge proof remains CT-A-owned.

## Render and preserve existing files

Use Python 3.12.14, Git and the pinned dependencies below. For local development,
render this package directory to a separate scratch directory:

```sh
python -m copier copy --defaults --data-file /path/to/nonsecret-answers.yml \
  templates/symphony-client /path/to/scratch-client
```

The seed package is nested; it is not a standalone template Git URL. Development
renders from that directory do not establish publication metadata. Tests place
the actual package in a temporary Git repository and resolve Copier's ordinary
`_src_path` and `_commit` to its fixture commit. After CT-L/U publication, use
`copier copy --vcs-ref=alpha <template-git-url> <target>`. The operator chooses
`alpha`; it is not a ninth answer or a `copier.yml` setting. No hooks or
`copier update` are supplied.

Inspect the scratch diff before applying it to an existing repository. A direct
copy can use `--skip '*'` to preserve every existing file, including config,
answers, skills and `.gitattributes`; this leaves those collisions for a reviewed
merge and does not complete installation. Never use blanket `--overwrite` for
adoption. Preserve application README, LICENSE, NOTICE, AGENTS/CLAUDE files,
package files, setup/lint commands and existing application CI.

Merge the config's target team, build/test arrays and `SYMPHONY.md` instruction
with existing settings and observed required checks. Reconcile answers/source
metadata against the reviewed render. For `.gitattributes`, retain target rules
and add the two generated planning globs once, with the Mermaid exception after
the broader bookkeeping rule. The globs cover `docs/symphony-plans/`; another
planning location needs a reviewed adjustment. Reconcile all existing skill
paths before replacing them. CT-O/A own actual onboarding/adoption decisions.

## Client skills and external tooling

The generated `SYMPHONY.md` links all client skills and their retained resources.
Load project-factory and Linear GraphQL from `.agents/skills/`; explicitly load
replan from `scripts/symphony/runtime-bundle/skills/symphony-replan/SKILL.md`.
Its guide and factory templates resolve within the client. Karpathy's skill and
examples retain their MIT declaration and attribution.

The client is not a standalone tooling install. Keep a separate reviewed
`1000lines/symphony-example` checkout at
`fd383f5760a2ba62ea6f6295bd6dd21cc0cb9e9e`, with its own locked dependencies,
and set `SYMPHONY_TOOLING_ROOT` to it. This CT-C revision includes the mode-aware
config reader; the original copied-tooling revision predates that interface.
An installed hosted reader must also support `ci.mode` before enabling an
explicit mode there; source validation does not prove a host update. Copied references to the workflow profile,
color helper, DAG tools and shared proof/review guides resolve there; actual
client plans and skill-relative resources stay in the client. Record both
checkout refs/locations and loaded paths. CT-O supplies the complete session
setup procedure; CT-A proves live loading. Project-factory is human-invoked and
must not be installed into the unattended hosted profile.

The App manifest is inert direct/private registration input, with repository
reads and PR/issue/check writes. No webhook receiver or subscribed events are
configured; native Actions deliver events. Public MVP forks use the accepted
existing Cadence App and still need explicit secret provisioning. CT-O verifies
actual grants, discovers App/installation IDs and completes registration.

## Rendering and development checks

Use `[[ value ]]` substitutions and `[% ... %]` blocks. Native GitHub `${{ ... }}`
expressions retain their syntax; ingress changes only the two App-login defaults.
Non-Jinja skill resources keep their own ticket-template placeholders literally.
The answers template follows [Copier's answer-file contract](https://copier.readthedocs.io/en/latest/configuring/#the-copier-answersyml-file).

From the package root:

```sh
python -m pip install -r tests/requirements.txt
python -m unittest discover -s tests
```

The seed runs `python -m unittest discover -s templates/symphony-client/tests`.
Both CI workflows run on every PR update. CT-Q's isolated question fixtures and
the real-tree fixtures cover both reviewer choices, different repositories,
branches/teams, quotes/newlines, source metadata, root-only exclusion and
collisions. The real-tree tests also parse generated YAML/JSON, check skill
resources/links and exercise Git's actual Linguist attributes.

Validate a generated config with the existing config reader in the reviewed
seed tooling checkout:

```sh
node "$SYMPHONY_TOOLING_ROOT/scripts/symphony/runtime-bundle/skills/symphony-repository/scripts/config.mjs" \
  validate /path/to/scratch-client/.symphony.cfg.json
```

Ordinary formatting excludes raw `template/`; dedicated render tests remain
mandatory. The seed config requires the observed `Client template tests` check from
`.github/workflows/client-template-test.yml`, GitHub Actions App `15368`. Structural
rendering does not prove live workflow, provider, host or skill execution.

See [PROVENANCE.md](PROVENANCE.md) and [LICENSE](LICENSE) for sources and licenses.
