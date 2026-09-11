# CT-R early review evidence

Status: prerequisite checkpoint, September 11, 2026. The reusable provider
implementation and real Codex review are pending. This document records the
starting evidence for [100-49](https://linear.app/1000lines/issue/100-49), under
the [accepted CT-R item](https://github.com/1000lines/symphony-example/blob/873f511aea3e1d858e216d1a890ed1cd9a709d61/docs/symphony-plans/client-template/implementation-items.md#ct-r--make-native-review-reusable-with-explicit-secrets-and-codex).
It does not satisfy CT-A's later proof through the published workflow repository.

## Prerequisites

The selected branch and PR base is `main`, inspected at
`b655daffd562e303053e82df6cbc08de9e741169`.

- **Merged export:** 100-47's [PR #41](https://github.com/1000lines/symphony-example/pull/41)
  is open at `0dbffa95a6cf584f4559324add389930203c0788`.
  `review-export.txt` is absent from this base. CT-R's written prerequisite
  requires its human-reviewed merge before the workflow/export edits.
- **Sequencing decision:** Linear relation
  `da0f0116-acd4-4359-a77e-691e78f16e41` was updated at 15:26:41 UTC to read
  `100-49 blocks 100-47`, opposite the accepted plan's `I → R`. The newer
  relation is preserved. Jeremy must resolve that conflict with the written
  prerequisite and final export ownership before dependent implementation.
- **Advisory implementation:** Jeremy approved and merged 100-43's
  [PR #31](https://github.com/1000lines/symphony-example/pull/31) at
  `ca5c37344df600468ee69e73c04c54197a5b062c`. The subsequent readiness fix in
  [PR #40](https://github.com/1000lines/symphony-example/pull/40) is also merged
  at the selected base. Its separate repository-token readiness client is part
  of the behavior CT-R must retain. Successful initial readiness proof remains
  outstanding in the inspected evidence; 100-43's Done state is not that proof.

## Observed live evidence

[Run 34615010077, attempt 1](https://github.com/1000lines/symphony-example/actions/runs/34615010077/attempts/1)
used `cadence-ai-review-events.yml`, event `workflow_run`, workflow source
`7725d77b039a2003733970909fe93487a74bd01a` on `main`. It reviewed PR #42 at
`a0823c691cb1d3ab6596069544f65c3d6f95eabf`.

The legacy Claude path published [approval 5180334730](https://github.com/1000lines/symphony-example/pull/42#pullrequestreview-5180334730).
Cadence App `4866513` owned actual-head check `103314820612`, whose final
result was **failure**: `markPullRequestReadyForReview` was not confirmed.
The workflow run itself reports success, which must not be substituted for the
advisory check's result. This run began before PR #40 merged; it is not proof
that a run using PR #40's workflow definition succeeds or fails.

Names-only API readback found `CADENCE_APP_PRIVATE_KEY` and
`CADENCE_OPENAI_API_KEY` in the seed's `cadence-controller` environment, and
`CADENCE_LINEAR_API_TOKEN`, `CADENCE_AI_REVIEW_ANTHROPIC_API_KEY` and the legacy
`CADENCE_BOT_GITHUB_TOKEN` at repository scope. The environment's only allowed
branch is `main`. Presence does not establish key validity, explicit reusable
delivery, App-authored review publication, or Codex execution. No secret values
were read or recorded.

## Resumption and proof handoff

Jeremy resolves the export dependency decision and supplies or identifies a
successful initial advisory/readiness run from trusted merged code. The existing
100-45 readiness work owns its remedy; CT-R consumes the merged result and proof.
No predecessor branch is copied into CT-R.

After CT-R's implementation passes local checks and required current-head CI,
Jeremy reviews and merges it before privileged execution. Preserve the main-only
environment policy. Provision the four accepted secret names explicitly at each
review call boundary; handoff receives only App/Linear and cleanup only App.
Remove the adopter's legacy PAT requirement in that implementation. Do not infer
delivery from the current internal inheritance workaround.

Use the existing `cadence-ai-review-trigger.yml` dispatch on `main`, with
`pr_number` set to the single task-linked open seed proof PR. This is a future
operator action, not an executed command. The proof must record:

- Actual workflow-source and trusted-helper commits, caller repository/ref,
  proof PR/head, run URL/attempt, provider and App identity.
- Explicit secret-name delivery without values; exactly one selected provider.
- Codex's App-authored review and matching Cadence workpad, including retained
  mandatory human feedback and requirement coverage.
- Actual-head queued/running check and linked final result, appropriate draft
  readiness, unchanged required CI, and applicable freshness/recovery evidence.

Keep 100-49 open until this proof exists. Local fixtures, secret inventories,
source availability and legacy Claude reviews cannot close the Codex criterion.
