# Symphony Bot Identity

Symphony local and hosted runtime work must use bot-owned credentials for
GitHub, Linear, Google, Git, Codex, and external API-key services. The preflight
below records identity and credential source classes only; it must not print
token or key values.

## Expected Identities

Set `SYMPHONY_BOT_USER`, `SYMPHONY_EXPECTED_LINEAR_EMAIL`,
`SYMPHONY_EXPECTED_GOOGLE_CLIENT_EMAIL`, and `SYMPHONY_GIT_AUTHOR_EMAIL` in the
local or installer environment to the bot accounts you provision. These settings
are required for live use; the examples below are synthetic.
`SYMPHONY_EXPECTED_GITHUB_LOGIN` and `SYMPHONY_GIT_AUTHOR_NAME` are derived from
`SYMPHONY_BOT_USER` on every preflight; overriding those derived fields cannot
change the comparison. Credentials must belong to the configured identities.

The same `SYMPHONY_BOT_USER` repository variable supplies workflow identity;
export it before standalone helper processes start.

| Surface                     | Expected identity                                                         | Credential source class                                                                 |
| --------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| GitHub API and PR envelopes | `example-symphony-bot`                                                        | `GITHUB_TOKEN`; token prefix class is reported when detectable.                         |
| Linear writes and workpads  | `linear-bot@example.invalid`                                              | `LINEAR_API_TOKEN`.                                                                     |
| Google Docs reads           | `example-doc-reader@example-project.iam.gserviceaccount.com` | `GOOGLE_APPLICATION_CREDENTIALS` service-account JSON.                                  |
| Git commits and pushes      | `example-symphony-bot <symphony@example.invalid>`                       | `GIT_AUTHOR_*`, `GIT_COMMITTER_*`, and executable `GIT_ASKPASS`; `SSH_AUTH_SOCK` unset. |
| Codex runtime               | Symphony API-key runtime                                                  | `OPENAI_API_KEY` in isolated `CODEX_HOME`.                                              |

## Local Preflight

After sourcing the Symphony environment, run:

```bash
bash scripts/symphony/setup-local-env.sh --identity-preflight
```

With the synthetic example identities, the report format is:

```text
github.actor=example-symphony-bot
github.credential_source=env:GITHUB_TOKEN
github.credential_class=classic-pat
linear.viewer_email=linear-bot@example.invalid
google.service_account_email=example-doc-reader@example-project.iam.gserviceaccount.com
git.author=example-symphony-bot <symphony@example.invalid>
git.askpass=executable
git.ssh_auth_sock=unset
codex.credential_source=env:OPENAI_API_KEY plus CODEX_HOME
```

The GitHub token class is derived from the token prefix without printing the
token: `github_pat_*` is a fine-grained PAT, `ghp_*` is a classic PAT, `ghs_*`
is a GitHub App installation token, `ghu_*` is a GitHub App user token, `ghr_*`
is a GitHub App refresh token, and `gho_*` is an OAuth token. Unknown prefixes
are reported as `unknown-token-prefix`.

## Failure Handling

Identity mismatches fail before credential-dependent mutations. The failure
message names the wrong identity, missing variable, missing executable, or
enabled SSH agent socket, and redacts known token/key environment values.

Workpad proof for identity tickets should include the preflight command, target
branch or commit SHA, GitHub actor, Linear viewer email, Google service-account
email, Git author email, GitHub token class, auxiliary API-key credential
classes, and whether bot commit association was proved or the exact association
failure was recorded.
