# Native review hooks and controller removal

Jeremy selected the small native workflow hooks in
[PR #18](https://github.com/1000lines/symphony-example/pull/18), merged September
11, 2026. [100-34](https://linear.app/1000lines/issue/100-34) explicitly requests
removal of the dormant alternative now. This decision supersedes the older
controller acquisition/assessment/publication instructions in the
[hackathon design](../../symphony-plans/hackathon-ready-design.md) and its generated
tickets. A future provider change must not recreate that controller as a
prerequisite.

## Current review path

The event bridge verifies the original feedback author's current write permission
before calling `cadence-ai-review-trigger.yml` through `workflow_call`. Manual
selection calls the same reviewer. The reviewer runs the existing Claude skill,
reads the PR timeline, applies the review cap, writes the Cadence workpad and
publishes a current-head `APPROVE` or `COMMENT` review. The existing handoff and CI
wakeup workflows retain their responsibilities. See the
[review automation guide](cadence-ai-review.md) for routing and credential details.

Claude and its publishing credential remain required by this path. Shared App
authentication, the protected `cadence-controller` environment and repository
configuration remain in use; their names do not make them part of the removed
assessment controller. The App-owned `Cadence Review` acceptance check is not the
current review signal.

## Live-use audit

The audit starts from `main` at `a5d10c7878c5d43dd3051794f4c1c0db40cdd65c`,
which includes PR #18. Production imports, CLI entry points and workflow callers
determine deletion scope; tests alone do not establish a live consumer.

| Removed surface                                                                            | Call-site evidence                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/cadence-codex-review.mjs`, its tests, `.github/codex/review.md` and output schema | No workflow or CLI invokes the controller. Only that module reads the prompt/schema.                                                                                                                              |
| `scripts/symphony/review-contract.mjs` and its tests                                       | Imports are confined to the dormant controller, the unused check-mode review-state branch, and the controller-only workpad contract branch. Its target resolver and CI predicate have no other production caller. |
| Check-mode acquisition/classification in `fetch-pr-review-state.mjs`                       | Only the deleted controller calls `fetchReviewFeedback` and `classifyCheckReviewState`; the live CLI uses timeline classification. The obsolete mode selector is removed.                                         |
| `reviewContract` generation/history persistence in `cadence-linear-workpad.mjs`            | Only the deleted publisher supplies a contract or live generation. Its exclusive transition, compaction and readback tests are removed.                                                                           |

The timeline's `markFeedbackAuthority` and shared author checks remain. The
workpad's ordinary review history, findings, incremental updates, pagination,
canonical JSON parsing, and `coordination.nonReviewWakeups` /
`coordination.lastNonReviewWakeup` preservation remain. Shared App authentication,
including PR #11's compare-URL fix, remains unchanged. This audit does not prove a
host deployment or a new provider integration.

## Downstream assumptions

- **100-18 / GUIDE:** document and bundle the implemented native review path.
  Preserve current-head CI, Claude review and human handoff. Do not add adapters,
  install the deleted controller or replace active guidance with a requirement
  for its generation ledger or App-owned acceptance check.
- **100-19 / DEPLOY:** deploy accepted code and prove native routing, author
  authorization, current-head CI/review, wakeups and human handoff. A Codex
  migration or check-only cutover is separate work; this ticket does not require
  rebuilding the removed producer to perform its deploy/rehearsal work.
- **100-20 through 100-22:** preserve credentials and review signals still used
  by the working reviewer. Do not retire Claude or its publishing token based
  on the dormant controller's old plan. Record provider/key proof only for
  integrations actually implemented and exercised; keep unmet project outcomes
  explicit for Jeremy.

The original [PR #11](https://github.com/1000lines/symphony-example/pull/11),
[100-14](https://linear.app/1000lines/issue/100-14), and
[accepted fan-out revision](https://github.com/1000lines/symphony-example/blob/8f4eafe3999040f67cd68e696e29bcb27eb44149/docs/symphony-plans/fan-out-plan-100-7-hackathon-ready.md)
retain the historical rationale and implementation evidence. This amendment
changes the controller assumptions, not DAG edges, branch ancestry, activation,
or unrelated deployment requirements.
