# Symphony client template package

This initial Copier template renders 21 client files: secret-free review ingress,
repository config, worker/reviewer guidance, a direct-path App manifest,
attributes, answers metadata and fourteen client skill/resource files. It is
not ready for publication or onboarding. CT-L must complete the five caller
roles and integration checks listed in [PROVENANCE.md](PROVENANCE.md).

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
`d5e9692b84c3f338014b964fd9713143fb723b55`, with its own locked dependencies,
and set `SYMPHONY_TOOLING_ROOT` to it. Copied references to the workflow profile,
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
CT-T's real-tree fixtures cover both reviewer choices, different repositories,
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
mandatory. CT-L registers the completed render check before release. Structural
rendering does not prove live workflow, provider, host or skill execution.

See [PROVENANCE.md](PROVENANCE.md) and [LICENSE](LICENSE) for sources and licenses.
