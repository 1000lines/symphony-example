# Repository review context

Review "1000lines/symphony-example" against the issue's selected base (default
"main"). Read `SYMPHONY.md`, existing application
instructions, the Linear issue/project and current human PR feedback. Use the
target's `.symphony.cfg.json` and actual current-head CI evidence.

The onboarding preference is "codex"; runtime selection
uses the credentials actually forwarded to the review job:

| Actions secret availability                | Reviewer                  |
| ------------------------------------------ | ------------------------- |
| `CADENCE_OPENAI_API_KEY` only              | Codex                     |
| `CADENCE_AI_REVIEW_ANTHROPIC_API_KEY` only | Claude                    |
| Both                                       | Codex                     |
| Neither                                    | Early configuration error |

`CADENCE_OPENAI_API_KEY` maps to `openai/codex-action` input `openai-api-key`
(the Codex provider's OpenAI API key, commonly named `OPENAI_API_KEY` outside
Actions). The Anthropic secret maps to `anthropic_api_key` on Claude's Action.
Both reusable-workflow provider declarations are optional; at least one must
reach the job. No dummy key is needed and authentication failure never switches
providers. `CADENCE_CODEX_MODEL` is optional (Codex's default when unset);
Claude requires the shared workflow's approved `CADENCE_CLAUDE_MODEL`.

The generated event, direct/manual and group review callers explicitly forward
both provider secrets and `CADENCE_APP_PRIVATE_KEY` / `CADENCE_LINEAR_API_TOKEN`.
Handoff and cleanup receive only their own named secrets; ingress receives none.
Store secrets at repository scope or in organization secrets selected for this
repository. Keep `cadence-controller` restricted to the repository's default
branch and free of shadowing environment secrets. Configure `CADENCE_APP_ID`,
`SYMPHONY_BOT_USER` and `CADENCE_REVIEWER` as repository Actions variables.

The shared workflow and helper revision must match. After the reviewed workflow
release, propagate caller updates through Copier, inspect the generated diff,
and verify a real App-authored PR review/check and Linear handoff. Generated
files and fixture tests do not establish live readiness. Guided provisioning
and readiness verification belong to [100-62](https://linear.app/1000lines/issue/100-62).

Keep reviewer implementation in the shared workflows. App/Linear credentials
and optional provider keys must be explicitly mapped at each review boundary.
The author and reviewer remain distinct; human acceptance owns merge and Done.
