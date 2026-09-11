# CT-R early review evidence

Status: App-identity correction checkpoint, September 11, 2026. The reusable provider
implementation and real Codex review are pending. This document records the
starting evidence for [100-49](https://linear.app/1000lines/issue/100-49), under
the [accepted CT-R item](https://github.com/1000lines/symphony-example/blob/873f511aea3e1d858e216d1a890ed1cd9a709d61/docs/symphony-plans/client-template/implementation-items.md#ct-r--make-native-review-reusable-with-explicit-secrets-and-codex).
It does not satisfy CT-A's later proof through the published workflow repository.

## Immediate App-identity correction

[Jeremy's PR #43 comment at 15:51 UTC](https://github.com/1000lines/symphony-example/pull/43#issuecomment-5637041350)
requires fixing native review publication in this ticket now. GitHub readback
confirmed Jeremy has repository admin access. This authorizes the independent
identity correction ahead of the broader prerequisites below; it does not close
the reusable-workflow or Codex criteria. The correction consumes selected `main`
at `4511d079a621fefe297aa56f250e894711140f32`, including merged PRs #40 and #38.

The observed wrong-identity review is [5180509923 on PR #43](https://github.com/1000lines/symphony-example/pull/43#pullrequestreview-5180509923),
authored by user `1000-cadence-bot` at head
`c95018bb266b0467edb582b29328c8ce96d7ae7f`. The corrected native source passes the
existing repository-scoped App token to Claude and derives the expected reviewer
login from the token Action's App slug. Verification, advisory results and Linear
handoff consume that identity. Native review no longer needs the legacy user PAT.
The main-only environment policy and existing same-repository secret delivery
remain; explicit cross-repository delivery and Codex selection are separate
outstanding CT-R work.

After human review and merge, Jeremy can verify the identity correction using the
existing trusted manual workflow on one task-linked open proof PR:

```sh
gh workflow run cadence-ai-review-trigger.yml \
  --repo 1000lines/symphony-example --ref main \
  -f pr_number=43 -f trigger_source=workflow_dispatch
```

Use PR #43 only while it remains open; if it has been merged, use the next open
100-49 proof PR and record its actual number. No dispatch from this unreviewed
branch is authorized by the main-only environment policy. Existing
`CADENCE_APP_PRIVATE_KEY` and `CADENCE_APP_ID` must reach the `cadence-controller`
job, with repository `CADENCE_AI_REVIEW_ANTHROPIC_API_KEY`,
`CADENCE_LINEAR_API_TOKEN` and `CADENCE_CLAUDE_MODEL` for the current Claude path.
No new secret name or App grant is required. This is a prepared operator action,
not an executed proof. Read back review author `1000lines-cadence[bot]`, current
head, workflow/helper commits, run/attempt, workpad and App `4866513` advisory
check. A pre-merge run still uses trusted main's old publishing code.

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
