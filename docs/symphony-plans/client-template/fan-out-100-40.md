# Client template fan-out — 100-40

The [human-approved plan](https://github.com/1000lines/symphony-example/blob/873f511aea3e1d858e216d1a890ed1cd9a709d61/docs/symphony-plans/fan-out-plan-100-39-client-template.md) was merged in [PR #34](https://github.com/1000lines/symphony-example/pull/34).
On September 11, 2026, 100-40 created thirteen tickets through the injected Linear
GraphQL API, staged them in Backlog, verified all seventeen direct blocker
relations and complete ticket bodies, then activated the set. No implementation
work is part of this fan-out. Human acceptance still owns Done.

## Issue and branch manifest

Every new issue is assigned to Jeremy Carroll in the client-template project,
with Linear label pink. Every task branch and PR uses main in its named target;
branches are created on dispatch and PRs start draft, labeled pink and symphony.
The table records activation state, not a claim of implementation completion.

| Key  | Linear issue                                                                                                          | Target repository                     | Task branch                                          | Initial state |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------- | ------------- |
| CT-I | [100-47](https://linear.app/1000lines/issue/100-47/inventory-client-files-and-justify-export-lists)                   | `1000lines/symphony-example`          | `symphony/client-template/100-47/inventory`          | Active        |
| CT-C | [100-48](https://linear.app/1000lines/issue/100-48/support-portable-config-and-native-docker-remote-ci)               | `1000lines/symphony-example`          | `symphony/client-template/100-48/compatibility`      | Active        |
| CT-R | [100-49](https://linear.app/1000lines/issue/100-49/make-native-review-reusable-with-explicit-secrets-and-codex)       | `1000lines/symphony-example`          | `symphony/client-template/100-49/review`             | Active        |
| CT-Q | [100-50](https://linear.app/1000lines/issue/100-50/define-seven-copier-answers-and-safe-delimiters)                   | `1000lines/symphony-example`          | `symphony/client-template/100-50/answers`            | Active        |
| CT-M | [100-51](https://linear.app/1000lines/issue/100-51/copy-every-listed-client-file-without-changes)                     | `1000lines/symphony-example`          | `symphony/client-template/100-51/copy`               | Active        |
| CT-T | [100-52](https://linear.app/1000lines/issue/100-52/convert-the-copied-files-into-the-initial-template)                | `1000lines/symphony-example`          | `symphony/client-template/100-52/template`           | Active        |
| CT-L | [100-53](https://linear.app/1000lines/issue/100-53/integrate-late-ci-and-codex-additions-before-release)              | `1000lines/symphony-example`          | `symphony/client-template/100-53/integrate-template` | Active        |
| CT-O | [100-54](https://linear.app/1000lines/issue/100-54/deliver-fork-direct-and-repeat-onboarding-skill)                   | `1000lines/symphony-example`          | `symphony/client-template/100-54/onboarding`         | Active        |
| CT-U | [100-55](https://linear.app/1000lines/issue/100-55/publish-and-instantiate-the-template-repository)                   | `1000lines/symphony-client-template`  | `symphony/client-template/100-55/publish-template`   | Active        |
| CT-V | [100-56](https://linear.app/1000lines/issue/100-56/publish-reusable-workflows-and-required-helpers)                   | `1000lines/symphony-client-workflows` | `symphony/client-template/100-56/publish-workflows`  | Active        |
| CT-F | [100-57](https://linear.app/1000lines/issue/100-57/connect-template-and-root-clients-to-workflow-alpha-and-prove-use) | `1000lines/symphony-client-template`  | `symphony/client-template/100-57/release`            | Active        |
| CT-A | [100-58](https://linear.app/1000lines/issue/100-58/adopt-published-template-and-prove-live-consumer-paths)            | `1000lines/symphony-example`          | `symphony/client-template/100-58/adopt`              | Active        |
| CT-Z | [100-59](https://linear.app/1000lines/issue/100-59/retire-migrated-bodies-and-finalize-evidence)                      | `1000lines/symphony-example`          | `symphony/client-template/100-59/finalize`           | Active        |

Existing [100-43](https://linear.app/1000lines/issue/100-43) is reused unchanged:
Misc, blue + Improvement, Jeremy, Done; branch
`symphony/misc/100-43/cadence-advisory-check` and merged [PR #31](https://github.com/1000lines/symphony-example/pull/31).
Its initial live proof must still be verified by CT-R from the actual workpad and
runs; terminal status alone is not execution evidence. No duplicate issue or
new incoming blocker was created for it.

## Direct blocker relations

Each row was created and read back as `type: blocks`, with the left
issue as `issueId` and right issue as `relatedIssueId`.
No transitive, join or inferred planning blocker was added.

| Blocker                                                                                                               | Blocked issue                                                                                                         | Relation ID                            |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [100-47](https://linear.app/1000lines/issue/100-47/inventory-client-files-and-justify-export-lists)                   | [100-51](https://linear.app/1000lines/issue/100-51/copy-every-listed-client-file-without-changes)                     | `231b9753-bf84-41d4-ba07-238033601fd3` |
| [100-47](https://linear.app/1000lines/issue/100-47/inventory-client-files-and-justify-export-lists)                   | [100-48](https://linear.app/1000lines/issue/100-48/support-portable-config-and-native-docker-remote-ci)               | `d1b546c5-655d-42b2-883a-12b89445fbb5` |
| [100-47](https://linear.app/1000lines/issue/100-47/inventory-client-files-and-justify-export-lists)                   | [100-49](https://linear.app/1000lines/issue/100-49/make-native-review-reusable-with-explicit-secrets-and-codex)       | `da0f0116-acd4-4359-a77e-691e78f16e41` |
| [100-43](https://linear.app/1000lines/issue/100-43/add-an-advisory-cadence-check-run-on-the-pr-head)                  | [100-49](https://linear.app/1000lines/issue/100-49/make-native-review-reusable-with-explicit-secrets-and-codex)       | `42870d8a-7942-40f8-bd68-55346f59ec28` |
| [100-51](https://linear.app/1000lines/issue/100-51/copy-every-listed-client-file-without-changes)                     | [100-52](https://linear.app/1000lines/issue/100-52/convert-the-copied-files-into-the-initial-template)                | `f2df0272-3aa0-4f98-8282-bb12af6eb4d8` |
| [100-50](https://linear.app/1000lines/issue/100-50/define-seven-copier-answers-and-safe-delimiters)                   | [100-52](https://linear.app/1000lines/issue/100-52/convert-the-copied-files-into-the-initial-template)                | `963fb0d3-7115-4e43-84a9-2d00ef6472b4` |
| [100-52](https://linear.app/1000lines/issue/100-52/convert-the-copied-files-into-the-initial-template)                | [100-53](https://linear.app/1000lines/issue/100-53/integrate-late-ci-and-codex-additions-before-release)              | `4d7503be-f181-4a6c-8433-b25b42feed34` |
| [100-48](https://linear.app/1000lines/issue/100-48/support-portable-config-and-native-docker-remote-ci)               | [100-53](https://linear.app/1000lines/issue/100-53/integrate-late-ci-and-codex-additions-before-release)              | `74767c28-1084-43ab-b90d-c08ee285d04c` |
| [100-49](https://linear.app/1000lines/issue/100-49/make-native-review-reusable-with-explicit-secrets-and-codex)       | [100-53](https://linear.app/1000lines/issue/100-53/integrate-late-ci-and-codex-additions-before-release)              | `2338c7f7-d549-4e14-ba02-09dc1ba10893` |
| [100-53](https://linear.app/1000lines/issue/100-53/integrate-late-ci-and-codex-additions-before-release)              | [100-54](https://linear.app/1000lines/issue/100-54/deliver-fork-direct-and-repeat-onboarding-skill)                   | `89b40790-0d0c-496a-bbcd-85a05e0abde1` |
| [100-53](https://linear.app/1000lines/issue/100-53/integrate-late-ci-and-codex-additions-before-release)              | [100-55](https://linear.app/1000lines/issue/100-55/publish-and-instantiate-the-template-repository)                   | `e3ca1b2f-8d0c-4e97-afea-baf264ac83f8` |
| [100-53](https://linear.app/1000lines/issue/100-53/integrate-late-ci-and-codex-additions-before-release)              | [100-56](https://linear.app/1000lines/issue/100-56/publish-reusable-workflows-and-required-helpers)                   | `1cd7a0d1-3e03-4848-8ea1-b231d7e12ea2` |
| [100-55](https://linear.app/1000lines/issue/100-55/publish-and-instantiate-the-template-repository)                   | [100-57](https://linear.app/1000lines/issue/100-57/connect-template-and-root-clients-to-workflow-alpha-and-prove-use) | `70d644c4-c42f-47e4-955d-49acce1d493e` |
| [100-56](https://linear.app/1000lines/issue/100-56/publish-reusable-workflows-and-required-helpers)                   | [100-57](https://linear.app/1000lines/issue/100-57/connect-template-and-root-clients-to-workflow-alpha-and-prove-use) | `ff283166-6fdc-4f5d-b91c-b6a379f7dc06` |
| [100-54](https://linear.app/1000lines/issue/100-54/deliver-fork-direct-and-repeat-onboarding-skill)                   | [100-58](https://linear.app/1000lines/issue/100-58/adopt-published-template-and-prove-live-consumer-paths)            | `77c5df63-49e6-4974-84c3-5d05253724c5` |
| [100-57](https://linear.app/1000lines/issue/100-57/connect-template-and-root-clients-to-workflow-alpha-and-prove-use) | [100-58](https://linear.app/1000lines/issue/100-58/adopt-published-template-and-prove-live-consumer-paths)            | `34d8252f-d16e-4fd5-90a1-5584e9164329` |
| [100-58](https://linear.app/1000lines/issue/100-58/adopt-published-template-and-prove-live-consumer-paths)            | [100-59](https://linear.app/1000lines/issue/100-59/retire-migrated-bodies-and-finalize-evidence)                      | `d09d6011-5e15-4847-a008-a8b24f246297` |

## Validation and handoff

- The shared DAG APIs validate fourteen nodes and seventeen matching graph,
  manifest and relation-table edges; thirteen create payloads reuse 100-43.
- Complete accepted item sections, layout/self-use, alpha and execution contracts
  are inline in each ticket. Summaries use accepted scope/actions/delivery fields.
  Plan/source links pin the merged SHA above; direct links and task branches use
  actual issue mappings. Set-list expressions remain with their owned-file lists.
- All saved bodies match the submitted source after Linear’s Markdown-only
  normalization of bullet markers, URL brackets and inline-code newlines.
  Regeneration replaces the same sections; it does not append copies.
- API readback verifies all labels, assignments, project IDs and seventeen
  relations before activation. Both graph copies contain each mapped identifier
  with node IDs, payload keys, branch templates and edges unchanged.
  Click directives were tried and rejected as malformed by the existing shared
  DAG parser, so both committed graphs omit them; the tables above provide
  clickable issue links. No parser or process tooling was changed.
- Future publication repositories returned HTTP 404 during preflight. As the
  accepted plan specifies, CT-U/V own their creation, main refs, label and access
  checks; no destination was created or published by this ticket.
- Local shared-tool and whitespace checks pass; changed Markdown uses locked
  Prettier. Docker: skipped — passed locally. Mandatory CI on the graph PR’s
  published head and fresh Cadence review are recorded in the
  [Codex workpad](https://linear.app/1000lines/issue/100-40/trigger-fan-out#comment-448ce956).

The same workpad records exact issue UUIDs, state/label/assignee IDs, mutation
inputs, source reads and full sample payload. It also records CI and review
limitations without treating a plan, fixture or source file as live provider proof.
