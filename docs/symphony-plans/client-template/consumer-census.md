# Client consumer census

Snapshot for [100-58](https://linear.app/1000lines/issue/100-58), September 11, 2026. No entry has been replaced or retired by this checkpoint. Paths below are
relative to `.github/workflows/` unless stated otherwise. The seed and published
commit identities are recorded in [adoption evidence](adoption-evidence.md).

## Example consumer

Repository: `1000lines/symphony-example`; existing definitions are on `main` at
`e362e5ad76fa8070ef27bf54fec9d6750195466c`. CT-A / 100-58 owns replacement;
CT-Z / 100-59 owns later body retirement. Each replacement below remains
unexecuted, so there is no replacement run to cite yet.

| Existing entry                     | Observed admission / purpose                                                                                                | Reviewed replacement or retention requirement                                                                                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cadence-review-ingress.yml`       | `Cadence Review Ingress`; PR opened/ready/synchronize, issue comments, submitted/edited reviews and inline comments.        | Reconcile generated same-path ingress; retain its name and secret-free selectors.                                                                                                                                           |
| `cadence-ai-review-events.yml`     | `Cadence AI Review Events`; completion of `Cadence Review Ingress`.                                                         | Generated `symphony-client-review.yml`; disable the old automatic listener atomically with its replacement.                                                                                                                 |
| `cadence-linear-rework.yml`        | `Cadence Review Handoff`; completion of `Cadence Review Ingress`.                                                           | Generated `symphony-client-handoff.yml`; one automatic feedback admission.                                                                                                                                                  |
| `symphony-linear-wakeups.yml`      | `Symphony Linear Wakeups`; PR events, all workflow completions, check completions, statuses and `workflow_call`.            | Generated `symphony-client-wakeups.yml`; disable duplicate native events and retain callable compatibility while consumers need it.                                                                                         |
| `cadence-ai-review-trigger.yml`    | `Cadence AI Review Trigger`; `review_requested`/`closed`, single-PR dispatch and `workflow_call`.                           | Account separately for review requests, close/cancel handling and direct dispatch when replacing automatic admission. Keep useful manual/callable paths.                                                                    |
| `cadence-ai-review.yml`            | `Cadence AI Review`; manual PR-number/label selection forwards to the local trigger.                                        | Preserve useful selection/forwarding behavior; verify its actual provider and helper ref after migration.                                                                                                                   |
| `cadence-review-check-cleanup.yml` | `Cadence Review Check Cleanup`; completion of `Cadence AI Review Events`, `Cadence AI Review Trigger`, `Cadence AI Review`. | Generated `symphony-client-review-cleanup.yml` must watch actual generated caller names, including `Symphony Client Review`, while covering retained manual paths. Cancellation/failure recovery needs a real migrated run. |
| `ci.yml`                           | Existing tooling CI; push to main and PR opened/synchronize/reopened.                                                       | Preserve build/lint/test/Changed Markdown and `CI Required`; optional generated command CI must not duplicate it.                                                                                                           |
| `client-template-test.yml`         | Staging package render CI; required `Client template tests`.                                                                | Remove or repoint only with successful isolated adoption/staging deletion and a reviewed required-check update.                                                                                                             |

The review, ingress, wakeup and retained manual routes must retain
trusted helper resolution. Final cross-repository callers use literal
`1000lines/symphony-client-workflows/.github/workflows/<file>@alpha`, with named
secrets limited to each hop. An intended destination is not evidence that it
currently exposes the needed callable interface.

## Published template root consumer

Repository: `1000lines/symphony-client-template`; main/alpha inspected at
`58021a73ac3a6c2141a1217fc88c27e590df8143`. Replacement owner: CT-F / 100-57,
currently [PR #10](https://github.com/1000lines/symphony-client-template/pull/10).
CT-A reads this repository's evidence; it does not operate its proof PRs.

| Entry                                                                                             | Observed ref and replacement                                                                                                                                      | Run evidence / limit                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `symphony-client-wakeups.yml`                                                                | Calls seed `symphony-linear-wakeups.yml@fd383f5760a2ba62ea6f6295bd6dd21cc0cb9e9e`; helper repository/ref are the same seed pair. CT-F proposes workflow `@alpha`. | [Run 34642166486](https://github.com/1000lines/symphony-client-template/actions/runs/34642166486), attempt 1, `pull_request_target`, head `544d4395f2a27d9096e1780f6d42a81d762ddfd0`, concluded failure. API `referenced_workflows` confirms the seed commit. This is old-consumer execution, not migrated proof. |
| Root `cadence-review-ingress.yml`                                                                 | Generated local ingress on main. No root review/handoff/cleanup caller exists at this revision.                                                                   | [SELF-ADOPTION.md](https://github.com/1000lines/symphony-client-template/blob/58021a73ac3a6c2141a1217fc88c27e590df8143/SELF-ADOPTION.md) explicitly limits evidence to rendering/package CI. No completed live review is recorded there.                                                                          |
| Root `ci.yml`                                                                                     | Package `Client template CI` / `Client template tests`; optional generated command caller omitted.                                                                | Retain package CI. CT-F's live migration proof must come from a separate template-development PR after trusted callers land.                                                                                                                                                                                      |
| `template/.github/workflows/symphony-client-ci.yml.jinja` and `symphony-client-wakeups.yml.jinja` | Generation sources still reference the seed command/wakeup reusables at `fd383f5760a2ba62ea6f6295bd6dd21cc0cb9e9e`.                                               | Sources are not additional live consumers. CT-F updates both sources and the concrete root delta; root-only development files stay outside rendered output.                                                                                                                                                       |

The root answers record `_commit: 01ccd00`, canonical template Git URL and
`cadence_reviewer: claude`. These are existing Copier metadata, distinct from
the inspected template alpha commit and actual workflow/helper commits.
Preserve that distinction when consuming CT-F's eventual run evidence.

## Retirement evidence to append

For every migrated entry, record repository, caller path/ref, replacement owner,
proof PR/head, run/attempt, actual template/workflow/helper SHAs and result.
Review rows also need provider/App, advisory check/review IDs, cleanup recovery
and readiness evidence. Include both real consumers before CT-Z removes bodies;
retain historical published refs and any remaining manual/forwarding users.

CT-F supplies its own migrated root run here or in its linked SELF-ADOPTION
evidence. CT-A supplies the example's task-linked follow-up after owner merge.
Until those records exist, this inventory authorizes no body retirement.
