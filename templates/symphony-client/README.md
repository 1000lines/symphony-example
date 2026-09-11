# Symphony client template package

This interim package defines the eight nonsecret Copier answers and their render
syntax. It is not yet an installable Symphony client. CT-M supplies the reviewed
file copy, CT-T converts it into `template/`, and CT-L integrates the CI/reviewer
interfaces and registers the completed render check before release.

Only `template/` is participant output. Root documentation, tests, workflows,
configuration and any future root client are development assets and never render
into participants' repositories.

| Answer              | Type   | Default / purpose                                |
| ------------------- | ------ | ------------------------------------------------ |
| `repo_slug`         | string | Required GitHub `owner/repository`               |
| `default_branch`    | string | `main`; supply the target's actual branch        |
| `linear_team_key`   | string | Required team key; no repository project binding |
| `symphony_app_slug` | string | Required author App slug                         |
| `cadence_app_slug`  | string | Required reviewer App slug                       |
| `cadence_reviewer`  | string | Required choice: `claude` or `codex`; no default |
| `build_command`     | string | Required build command, including multiline      |
| `test_command`      | string | Required test command, including multiline       |

`cadence_reviewer` records the selected reviewer explicitly. `codex` requires
`CADENCE_OPENAI_API_KEY`; `claude` requires `CADENCE_AI_REVIEW_ANTHROPIC_API_KEY`.
CT-T/L must carry this choice into the generated review caller. The selected
reviewer must run even when both keys are present; a missing matching key must
fail clearly instead of selecting another reviewer. These tests verify answer
selection and rendering; provider execution remains a later integration gate.

There is no mode, model, project, credential, App ID or ref question.
Supply repository-specific values explicitly; a build command need not use
Docker. Configure execution modes and discovered IDs during onboarding, outside
these answers. Provision credentials separately as named Actions secrets; never
put them in answers or command strings. Rendering does not execute the commands.

## Rendering contract

Use `[[ value ]]` for every Copier substitution, including filenames and answer
metadata, and `[% ... %]` for blocks. Native GitHub `${{ ... }}` expressions pass
through unchanged. Trailing newlines are retained. Do not wrap workflow files in
raw blocks or change the delimiters during CT-T/L.

Following [ordinary Copier answer-file guidance](https://copier.readthedocs.io/en/latest/configuring/#the-copier-answersyml-file),
CT-T must include `template/[[ _copier_conf.answers_file ]].jinja` containing:

```jinja
# Changes here will be overwritten by Copier; NEVER EDIT MANUALLY
[[ _copier_answers | to_nice_yaml ]]
```

This preserves the eight answers and ordinary `_src_path` / `_commit` metadata.
Use Copier's serializers such as `to_json` for config values and shell-command
arguments; do not hand-quote user strings. The tests exercise this contract in
temporary Git repositories without creating or modifying committed `template/`
files. They inspect generated YAML workflows and JSON config, including quoted
and multiline commands, and verify root-only files stay out of the output.

After CT-L and publication, the operator selects the moving publication branch
with `copier copy --vcs-ref=alpha <template-git-url> <target>`. Pass answers via
Copier's `--data-file` or `--data` options; `--defaults` permits noninteractive use
once required values are supplied. This is a future usage contract, not evidence
of an available published template. No hooks or `copier update` are supplied.

## Development checks

Use Python 3.12.14 and Git, then from this package root:

```sh
python -m pip install -r tests/requirements.txt
python -m unittest discover -s tests
```

The seed runs the same discovery from its root with
`python -m unittest discover -s templates/symphony-client/tests`. Both workflows
run on every PR update, including template-only changes. Discovery stays in
`tests/` so raw template tests are never imported. `.prettierignore` excludes
`template/` from ordinary formatting; the seed has the equivalent staging-path
exclusion. This does not waive dedicated rendering and generated-file checks.
CT-T/L add their real-client render suites to this discovery command.

See [PROVENANCE.md](PROVENANCE.md) and [LICENSE](LICENSE) for source and license.
