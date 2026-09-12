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
`SYMPHONY_BOT_USER` and `CADENCE_REVIEWER` as repository Actions variables or
organization variables granted to this repository.

The shared workflow and helper revision must match. After the reviewed workflow
release, propagate caller updates through Copier, inspect the generated diff,
and verify a real App-authored PR review/check and Linear handoff. Generated
files and fixture tests do not establish live readiness. Use the
[onboarding skill](../../.agents/skills/cadence-onboarding/SKILL.md) for secure
provisioning and readiness verification.

Keep reviewer implementation in the shared workflows. App/Linear credentials
and optional provider keys must be explicitly mapped at each review boundary.
The author and reviewer remain distinct; human acceptance owns merge and Done.

## Current Cadence status

The pinned shared revision edits one App-owned PR comment as reviews queue,
run, complete or fail. It is the only human-facing review message: status,
verdict, concise findings and measured footer, with head/run/workpad links.
Both providers return the existing incremental Linear workpad payload; native
completion persists it, verifies the current head, and publishes the assessment.
Clean approval keeps only a bodyless APPROVE record for approval tracking.
Non-approval publishes no formal review. Historical reviews remain unchanged.

The existing check retains the verified assessment and measurements for comment
retry/recovery; the existing Linear workpad retains detailed findings/history.
Completion and cleanup invoke the existing Linear/human handoff directly, without
review prose or a COMMENT event. Actionable findings wake Active; approval or
human-needed findings request eligible PR assignees. Keep current-head/App/run,
stable-comment and terminal-state guards intact.

The footer uses observed model/token usage when exposed and measured duration.
Requested models are labeled separately; unavailable measurements are omitted.
Codex's pinned Action exposes no structured observed model or token counts.
Elapsed provider-step time can include setup.

Cleanup now needs the existing `CADENCE_LINEAR_API_TOKEN` explicitly forwarded
alongside `CADENCE_APP_PRIVATE_KEY`; no new secret or App grant is needed.
Keep generated workflow/helper refs matched and apply caller changes through
Copier after shared-code acceptance. On one live PR, verify approval,
non-approval, a subsequent review and failure/recovery: retain the same comment
ID, App author, absent duplicate review text, check/run links and confirmed
Linear handoff. Fixtures and generated files do not establish live deployment;
the caller must run from the trusted default branch.
