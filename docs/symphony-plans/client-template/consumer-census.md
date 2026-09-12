# Consumer census before retirement

September 12, 2026; seed base
`70a8a2415085598ea86e63a71f11faff85cb54c1`. **No path in this census is approved
for deletion.** Both consumers belong to Jeremy; CT-Z owns this retirement
record. [Accepted adoption and exact run evidence](adoption-evidence.md) separate
source from real execution.

## Active clients and retained entries

Example `main@70a8a24` and template root `main@e7a9be3` have the same five
generated review/handoff/cleanup entry filenames below. Each calls the matching
file in `1000lines/symphony-client-workflows@ac15fc1567865eb738cd53409c6fddf297e78a09`
and passes the same helper ref. This commit is still on open workflow PR #2.
The filenames already contain the replacements; deleting them would remove
client listeners/manual entry points. The template root's development assets
remain outside participant output under `_subdirectory: template`.

All workflow paths below are under `.github/workflows/` in the seed unless
explicitly stated otherwise.

| Path                               | Actual consumer / retained purpose                                                                                                                                                                     | Run evidence / retirement decision                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cadence-ai-review-events.yml`     | Both clients listen for completed `Cadence Review Ingress`; generated shared-review caller.                                                                                                            | Seed [34662935136](https://github.com/1000lines/symphony-example/actions/runs/34662935136) and template [34658729574](https://github.com/1000lines/symphony-client-template/actions/runs/34658729574) fail before provider execution. Retain. |
| `cadence-ai-review-trigger.yml`    | Both clients retain single-PR manual dispatch and `pull_request_target` review-request/close events.                                                                                                   | Seed close-event [34663023717](https://github.com/1000lines/symphony-example/actions/runs/34663023717) reports success; this is not manual Codex proof. Retain.                                                                               |
| `cadence-ai-review.yml`            | Both clients retain manual `pr_numbers` / `review_label` selection.                                                                                                                                    | No current-ref manual review smoke established in this audit. Retain; no executable change here.                                                                                                                                              |
| `cadence-linear-rework.yml`        | Both clients listen to ingress for review/feedback handoff, receiving App and Linear secrets only.                                                                                                     | Seed [34662934661](https://github.com/1000lines/symphony-example/actions/runs/34662934661) fails acquisition. Retain.                                                                                                                         |
| `cadence-review-check-cleanup.yml` | Both clients' generated completion listener names `Cadence AI Review Events`, `Cadence AI Review Trigger`, and `Cadence AI Review`. App secret only.                                                   | Seed [34663032908](https://github.com/1000lines/symphony-example/actions/runs/34663032908) succeeds; cancellation/recovery remains unproven. Retain the generated listener.                                                                   |
| `symphony-linear-wakeups.yml`      | Seed body is `workflow_call` only after PR #51. Retained compatibility source and test target; frozen seed refs still serve staging/published old clients.                                             | Replacement client path is `symphony-client-wakeups.yml`, using shared workflow/helper `alpha@77cfb2d`. Current-source tests/imports and incomplete external census prevent deletion.                                                         |
| `symphony-client-commands.yml`     | Seed reusable command body and native source smoke entry. Staging's optional generated command caller uses frozen seed `fd383f5`. Both current root clients preserve their own application/package CI. | No accepted all-consumers-migrated record. Retain.                                                                                                                                                                                            |

Template **alpha** still points to `58021a7`, whose optional command and wakeup
callers use seed `fd383f5760a2ba62ea6f6295bd6dd21cc0cb9e9e`. The staged package
also uses those pins. These old publications remain valid records; no tag/ref
rewrite or removal is authorized. Current template main and example wakeups use
shared `alpha@77cfb2d`; a successful job alone is not a verified state transition.

## Exported helpers and development consumers

Exact export scope is the union of [ci-export.txt](ci-export.txt) and
[review-export.txt](review-export.txt) at the seed base above: 69 rows,
66 existing paths, three historical planned provider paths absent. Membership
is a publication inventory, not proof of being unreferenced. **Approved
unreferenced helper set: empty.** No helper path is edited or deleted here.

Examples of retained consumers from the current source:

- `scripts/linear-issue-wakeup.mjs`, `scripts/github-actor-classification.mjs`
  and `scripts/symphony/runtime-bundle/skills/symphony-repository/scripts/config.mjs`
  serve seed tooling and retained wakeup imports, as well as their tests.
- `scripts/cadence-linear-workpad.mjs`, `scripts/symphony/review-contract.mjs`
  and `.github/workflows/scripts/cadence-review-check.mjs` retain local import
  and regression-test consumers; exported copies do not prove these unused.
- `.github/workflows/scripts/verify-cadence-ai-review.cjs` and
  `scripts/fetch-pr-review-state.mjs` retain shared/legacy acquisition consumers.
  Historical controller cleanup is outside CT-Z's scope.
- `templates/symphony-client/tests/`, source `template/`, and pinned requirements
  remain inputs to `.github/workflows/client-template-test.yml`, registered as
  required in `.symphony.cfg.json`. Removing staging alone would break that CI.

Before a later deletion, expand the exact proposed helper paths, inspect all
imports/manual consumers and both public clients at their recorded refs, obtain
accepted replacement runs, then update this census. Retain compatibility when
the census is incomplete. Local tests and historical refs do not themselves
prove every external consumer migrated.
