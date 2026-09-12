# Accepted adoption and execution evidence

Readback: September 12, 2026. Seed target:
`70a8a2415085598ea86e63a71f11faff85cb54c1` on `main`.

## Accepted source

Jeremy authored and merged [PR #51](https://github.com/1000lines/symphony-example/pull/51)
at 2026-09-11 23:55:13 UTC, merge
`9547c3504f94c84aebee27d2b20a16a781adea31`. It adopts public template **main**
`e7a9be382c062f141727c9a9129aef384aea8efb`; `.copier-answers.yml` records
`_commit: e7a9be3`, the canonical Git URL and eight nonsecret answers.
This is the accepted replacement for the proposed, closed/unmerged
[PR #50](https://github.com/1000lines/symphony-example/pull/50). Its collision
proposal is historical, not an accepted deletion census. 100-58 remains Canceled.

The accepted diff replaces five embedded bodies with generated callers, updates
client instructions/resources, preserves native application setup/build/test/lint
and both required checks, and retains the seed's Karpathy skill/examples. The
template's later 100-63 removal applies to participant output; PR #51 explicitly
preserves the seed-owned copies. Staging is still present.

| Repository                            | Main at readback                           | Alpha at readback                          |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| `1000lines/symphony-client-template`  | `e7a9be382c062f141727c9a9129aef384aea8efb` | `58021a73ac3a6c2141a1217fc88c27e590df8143` |
| `1000lines/symphony-client-workflows` | `77cfb2d1f4e0e488af207096b1785b63ffc0398b` | `77cfb2d1f4e0e488af207096b1785b63ffc0398b` |

Both repositories report public visibility and Apache-2.0 licenses. Anonymous
LICENSE reads at the full main commits above returned HTTP 200 with identical
bytes. Neither has an `alpha` tag. Template root and example review/handoff/cleanup callers and
helper inputs select `ac15fc1567865eb738cd53409c6fddf297e78a09`; that is the head
of open, unmerged [workflow PR #2](https://github.com/1000lines/symphony-client-workflows/pull/2),
not workflow alpha. Wakeups select workflow/helper `alpha`. Do not repoint the
review callers to the current alpha: it predates their provider interface.

## Installed and executed evidence

These layers remain separate:

- **Source/adoption:** PR #51 and the committed answers/diff above. Its test
  claims apply to adoption head `22afe86727d7002accaec83c40b58b048ba71d4b`;
  they do not validate a later CT-Z head.
- **Installed/loaded host:** CT-A's old workpad records reader bundle
  `a3b7428a9e0298592e119a57923854b75a9b61a0` rejecting explicit modes.
  That is historical evidence. CT-Z has not changed or verified a host reload;
  a source checkout or successful omitted-mode config inspection is insufficient.
- **Template root:** current [SELF-ADOPTION](https://github.com/1000lines/symphony-client-template/blob/e7a9be382c062f141727c9a9129aef384aea8efb/SELF-ADOPTION.md)
  records Copier regeneration and package CI, explicitly leaving final live
  review/advisory/self-use proof open.
- **Example live execution:** the following API-read observations establish
  actual shared-workflow invocation, with the stated limits.

| Run / attempt 1                                                                               | Workflow/event and source                                                                                                            | Observed result and limit                                                                                                                                         |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [34662935136](https://github.com/1000lines/symphony-example/actions/runs/34662935136)         | `cadence-ai-review-events.yml`, `workflow_run`, seed `70a8a24`; referenced event and nested trigger workflows both resolve `ac15fc1` | Route job `103469035668` fails the current/open-PR assertion in “Read current event from GitHub”; provider job `103469061887` is skipped. No Codex verdict proof. |
| [34662934661](https://github.com/1000lines/symphony-example/actions/runs/34662934661)         | `cadence-linear-rework.yml`, `workflow_run`, seed `70a8a24`; referenced shared workflow `ac15fc1`                                    | Handoff job `103469034765` fails the same acquisition assertion. No successful Linear handoff claim.                                                              |
| [34663032908](https://github.com/1000lines/symphony-example/actions/runs/34663032908)         | `cadence-review-check-cleanup.yml`, `workflow_run`, seed `70a8a24`; referenced shared workflow `ac15fc1`                             | Cleanup job `103469319727` succeeds. No canceled-review/check transition was audited, so cancellation/recovery acceptance remains open.                           |
| [34658729574](https://github.com/1000lines/symphony-client-template/actions/runs/34658729574) | Template root `cadence-ai-review-events.yml`, root `e7a9be3`                                                                         | Route job `103456592430` fails acquisition; provider job `103456630282` is skipped. This does not complete template-root proof.                                   |

These are a bounded census of observed runs, not an assertion that no other
successful run exists. Exact runtime helper checkout commits, provider reviews,
App-owned advisory lifecycle, ready transitions and mode/onboarding walkthroughs
must be linked before claiming their criteria. A run's API `head_sha` is not
automatically the reviewed PR head or the trusted helper checkout SHA.

PR #51 records that live App/provider configuration was still needed. Guided
provisioning belongs to Jeremy/100-62; no secret values were inspected here.
The task's Symphony App `4866508` receives HTTP 403, `Resource not accessible by
integration`, from `GET repos/1000lines/symphony-example/branches/main/protection/required_status_checks`.
The branch-rules endpoint returns an empty array; this does not resolve the
unreadable classic protection. Jeremy must read back effective required checks
with an identity having repository Administration read permission. No grant
expansion or settings change is needed for this documentation checkpoint.
The [finalization matrix](finalization.md) names remaining acceptance and the
[census](consumer-census.md) preserves the operational paths until it is resolved.
