# 100-8 fan-out result

Created September 10, 2026 from the
[accepted plan](https://github.com/1000lines/symphony-example/blob/8f4eafe3999040f67cd68e696e29bcb27eb44149/docs/symphony-plans/fan-out-plan-100-7-hackathon-ready.md).
Jeremy accepted the scope in PR #3; the pinned revision incorporates his later
state correction. This record proves ticket creation, not implementation or
hackathon readiness.

At creation, all fifteen issues were **Backlog**, assigned to Jeremy Carroll,
with **pink** only. The thirteen delivery tasks and two monitors were parked
for human activation. Fan-out applied no mature/wake labels and started no
downstream branches, deployments or implementation work. Human review owns completion of
[100-8](https://linear.app/1000lines/issue/100-8/trigger-fan-out).

Jeremy subsequently authorized activation and two DEPLOY-to-monitor blockers,
recorded in [PR #5](https://github.com/1000lines/symphony-example/pull/5).
The current plan and both graph copies retain that eighteen-edge amendment.
The tables, JSON and sample body here preserve the original creation evidence
at the pinned accepted revision; they do not describe current ticket states.

## Issue mapping

| Node           | Payload key       | Linear issue                                                                                                          | Type   |
| -------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| CI             | HR-CI             | [100-10](https://linear.app/1000lines/issue/100-10/bootstrap-ci-for-every-controller-change)                          | task   |
| APP            | HR-APP            | [100-11](https://linear.app/1000lines/issue/100-11/add-renewable-app-credentials-and-explicit-actor-identities)       | task   |
| GATE           | HR-GATE           | [100-12](https://linear.app/1000lines/issue/100-12/define-trusted-repository-mapping-and-fresh-acceptance-predicates) | task   |
| RUST           | HR-RUST           | [100-13](https://linear.app/1000lines/issue/100-13/make-selected-rust-ci-prove-the-explicit-pr-head)                  | task   |
| CODEX          | HR-CODEX          | [100-14](https://linear.app/1000lines/issue/100-14/build-isolated-codex-assessment-and-trusted-check-publication)     | task   |
| WAIT           | HR-WAIT           | [100-15](https://linear.app/1000lines/issue/100-15/reconcile-ci-and-review-through-events-and-bounded-monitors)       | task   |
| INSTALL        | HR-INSTALL        | [100-16](https://linear.app/1000lines/issue/100-16/prepare-and-verify-both-app-installations-and-secret-destinations) | task   |
| ROUTE          | HR-ROUTE          | [100-17](https://linear.app/1000lines/issue/100-17/wire-app-owned-codex-dispatch-and-human-only-review-handoff)       | task   |
| GUIDE          | HR-GUIDE          | [100-18](https://linear.app/1000lines/issue/100-18/installable-host-profiles-and-current-acceptance-guidance)         | task   |
| DEPLOY         | HR-DEPLOY         | [100-19](https://linear.app/1000lines/issue/100-19/deploy-and-rehearse-apps-codex-ci-and-15-minute-recovery)          | task   |
| RETIRE         | HR-RETIRE         | [100-20](https://linear.app/1000lines/issue/100-20/retire-verified-legacy-reviewer-and-pat-dependencies)              | task   |
| ROTATE         | HR-ROTATE         | [100-21](https://linear.app/1000lines/issue/100-21/rotate-to-the-event-openai-key-and-verify-reload)                  | task   |
| FINAL          | HR-FINAL          | [100-22](https://linear.app/1000lines/issue/100-22/audit-composed-readiness-cleanup-and-human-acceptance)             | task   |
| MON_CONTROLLER | HR-MON-CONTROLLER | [100-23](https://linear.app/1000lines/issue/100-23/monitor-ci-and-review-for-1000linessymphony-example)               | daemon |
| MON_RUST       | HR-MON-RUST       | [100-24](https://linear.app/1000lines/issue/100-24/monitor-ci-and-review-for-jeremycarrollvenn-search-rs)             | daemon |

Existing planning seeds 100-6, 100-7 and 100-8 were retained. The complete project
inventory before fan-out contained those three issues only; the complete team
inventory contained no existing monitor or delivery issues. The accepted manifest
names no `existing_issue`; no replacement issue was created.

The [machine-readable result](fan-out-result-100-8.json) records all returned
UUIDs/URLs, common mutation input fields, source fields and SHA, branch/PR
policies, submitted/readback body digests, and all relation inputs/results.
The [complete APP ticket example](fan-out-example-100-11.md) shows a generated
body with accepted node content first, explicit empty-list behavior where
applicable, direct Linear links, pinned sources and the full common contract.

## Branch manifest

Selected base and PR base: **main** in each repository. Controller main observed
at `3f40b544aee82d6e68c1bb81352d4cb3309f3d2b`; Rust main at
`99528c2e4da241ec2c9961d0a155357611f16a76`. Branches below are declarations
for later authorized dispatch; fan-out created none of them. All task PRs are
draft, assigned to `jeremycarroll`, and require `pink,symphony`.

| Issue                                                                                                                 | Repository                     | Resolved branch                                       | Branch birth / PR creation    |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------- | ----------------------------- |
| [100-10](https://linear.app/1000lines/issue/100-10/bootstrap-ci-for-every-controller-change)                          | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-10/ci-caller`           | on_dispatch / on_branch_birth |
| [100-11](https://linear.app/1000lines/issue/100-11/add-renewable-app-credentials-and-explicit-actor-identities)       | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-11/app-credentials`     | on_dispatch / on_branch_birth |
| [100-12](https://linear.app/1000lines/issue/100-12/define-trusted-repository-mapping-and-fresh-acceptance-predicates) | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-12/acceptance-contract` | on_dispatch / on_branch_birth |
| [100-13](https://linear.app/1000lines/issue/100-13/make-selected-rust-ci-prove-the-explicit-pr-head)                  | `jeremycarroll/venn-search-rs` | `symphony/hackathon-ready/100-13/rust-head-ci`        | on_dispatch / on_branch_birth |
| [100-14](https://linear.app/1000lines/issue/100-14/build-isolated-codex-assessment-and-trusted-check-publication)     | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-14/codex-review`        | on_dispatch / on_branch_birth |
| [100-15](https://linear.app/1000lines/issue/100-15/reconcile-ci-and-review-through-events-and-bounded-monitors)       | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-15/ci-reconciliation`   | on_dispatch / on_branch_birth |
| [100-16](https://linear.app/1000lines/issue/100-16/prepare-and-verify-both-app-installations-and-secret-destinations) | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-16/app-installation`    | on_dispatch / on_branch_birth |
| [100-17](https://linear.app/1000lines/issue/100-17/wire-app-owned-codex-dispatch-and-human-only-review-handoff)       | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-17/review-routing`      | on_dispatch / on_branch_birth |
| [100-18](https://linear.app/1000lines/issue/100-18/installable-host-profiles-and-current-acceptance-guidance)         | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-18/runtime-guidance`    | on_dispatch / on_branch_birth |
| [100-19](https://linear.app/1000lines/issue/100-19/deploy-and-rehearse-apps-codex-ci-and-15-minute-recovery)          | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-19/readiness-rehearsal` | on_dispatch / on_branch_birth |
| [100-20](https://linear.app/1000lines/issue/100-20/retire-verified-legacy-reviewer-and-pat-dependencies)              | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-20/retire-legacy`       | on_dispatch / on_branch_birth |
| [100-21](https://linear.app/1000lines/issue/100-21/rotate-to-the-event-openai-key-and-verify-reload)                  | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-21/event-key`           | on_dispatch / on_branch_birth |
| [100-22](https://linear.app/1000lines/issue/100-22/audit-composed-readiness-cleanup-and-human-acceptance)             | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-22/final-readiness`     | on_dispatch / on_branch_birth |
| [100-23](https://linear.app/1000lines/issue/100-23/monitor-ci-and-review-for-1000linessymphony-example)               | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-23/mon-controller`      | never / never                 |
| [100-24](https://linear.app/1000lines/issue/100-24/monitor-ci-and-review-for-jeremycarrollvenn-search-rs)             | `1000lines/symphony-example`   | `symphony/hackathon-ready/100-24/mon-rust`            | never / never                 |

DEPLOY / 100-19 also declares
`symphony/hackathon-ready/100-19/readiness-rehearsal` in
`jeremycarroll/venn-search-rs`, born on dispatch from that repository's main,
with a separate draft PR against main and the same assignment/labels. This
additional policy is copied into its ticket and the JSON result. Monitor names
are reserved only: `birth: never`, `create: never`.

The artifact PR for 100-8 uses
`symphony/hackathon-ready/100-8/fan-out`, branched from the observed controller
main and targeting main. It contains only the fan-out records and graph annotations.

## Direct blocker relations

Each row was written through `issueRelationCreate` and read back from both
endpoints. `issueId` is the blocker, `relatedIssueId` is the blocked issue,
and `type` is `blocks`. Fan-out created exactly sixteen accepted hard edges;
it added no transitive or monitor blocker. The two later monitor blockers are
part of the subsequent activation amendment, outside this creation record.

| Blocker (issueId)                                                                                                     | Blocked (relatedIssueId)                                                                                              | Returned relation UUID                 |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [100-10](https://linear.app/1000lines/issue/100-10/bootstrap-ci-for-every-controller-change)                          | [100-11](https://linear.app/1000lines/issue/100-11/add-renewable-app-credentials-and-explicit-actor-identities)       | `fc189662-0c08-4d91-99eb-fceb5212ef35` |
| [100-10](https://linear.app/1000lines/issue/100-10/bootstrap-ci-for-every-controller-change)                          | [100-12](https://linear.app/1000lines/issue/100-12/define-trusted-repository-mapping-and-fresh-acceptance-predicates) | `d608480c-5ae1-4483-b54f-a6342e1dc0f8` |
| [100-11](https://linear.app/1000lines/issue/100-11/add-renewable-app-credentials-and-explicit-actor-identities)       | [100-14](https://linear.app/1000lines/issue/100-14/build-isolated-codex-assessment-and-trusted-check-publication)     | `b461f068-3b0e-417a-962c-a3ed28ad0218` |
| [100-12](https://linear.app/1000lines/issue/100-12/define-trusted-repository-mapping-and-fresh-acceptance-predicates) | [100-14](https://linear.app/1000lines/issue/100-14/build-isolated-codex-assessment-and-trusted-check-publication)     | `03e721fb-db59-4d92-a3e8-055c0194513e` |
| [100-11](https://linear.app/1000lines/issue/100-11/add-renewable-app-credentials-and-explicit-actor-identities)       | [100-15](https://linear.app/1000lines/issue/100-15/reconcile-ci-and-review-through-events-and-bounded-monitors)       | `aba8b79c-cccb-418f-9c5b-6a5eeb3c306d` |
| [100-12](https://linear.app/1000lines/issue/100-12/define-trusted-repository-mapping-and-fresh-acceptance-predicates) | [100-15](https://linear.app/1000lines/issue/100-15/reconcile-ci-and-review-through-events-and-bounded-monitors)       | `fd8aa040-44a6-445c-9a5f-fd7df4af775b` |
| [100-11](https://linear.app/1000lines/issue/100-11/add-renewable-app-credentials-and-explicit-actor-identities)       | [100-16](https://linear.app/1000lines/issue/100-16/prepare-and-verify-both-app-installations-and-secret-destinations) | `c4f3cbb9-dd4d-48bf-9339-ef75b1e1eb42` |
| [100-14](https://linear.app/1000lines/issue/100-14/build-isolated-codex-assessment-and-trusted-check-publication)     | [100-17](https://linear.app/1000lines/issue/100-17/wire-app-owned-codex-dispatch-and-human-only-review-handoff)       | `504ba69d-0dda-43d8-8a7c-7318fdfdddb0` |
| [100-15](https://linear.app/1000lines/issue/100-15/reconcile-ci-and-review-through-events-and-bounded-monitors)       | [100-17](https://linear.app/1000lines/issue/100-17/wire-app-owned-codex-dispatch-and-human-only-review-handoff)       | `73b5921d-6c5a-4c5f-8227-46c2c0c63c4f` |
| [100-17](https://linear.app/1000lines/issue/100-17/wire-app-owned-codex-dispatch-and-human-only-review-handoff)       | [100-18](https://linear.app/1000lines/issue/100-18/installable-host-profiles-and-current-acceptance-guidance)         | `2f6b067d-25a5-49fe-8872-cba13d582cc0` |
| [100-18](https://linear.app/1000lines/issue/100-18/installable-host-profiles-and-current-acceptance-guidance)         | [100-19](https://linear.app/1000lines/issue/100-19/deploy-and-rehearse-apps-codex-ci-and-15-minute-recovery)          | `9d9fda21-6364-4b76-bb0a-4eae19178289` |
| [100-16](https://linear.app/1000lines/issue/100-16/prepare-and-verify-both-app-installations-and-secret-destinations) | [100-19](https://linear.app/1000lines/issue/100-19/deploy-and-rehearse-apps-codex-ci-and-15-minute-recovery)          | `11d642e8-6052-4127-8171-7fb6b4cc942b` |
| [100-13](https://linear.app/1000lines/issue/100-13/make-selected-rust-ci-prove-the-explicit-pr-head)                  | [100-19](https://linear.app/1000lines/issue/100-19/deploy-and-rehearse-apps-codex-ci-and-15-minute-recovery)          | `1318060e-22d9-4ca8-9f7b-61031ba16c47` |
| [100-19](https://linear.app/1000lines/issue/100-19/deploy-and-rehearse-apps-codex-ci-and-15-minute-recovery)          | [100-20](https://linear.app/1000lines/issue/100-20/retire-verified-legacy-reviewer-and-pat-dependencies)              | `c9f2b3fc-4c15-4335-8853-54dcde8402e7` |
| [100-21](https://linear.app/1000lines/issue/100-21/rotate-to-the-event-openai-key-and-verify-reload)                  | [100-22](https://linear.app/1000lines/issue/100-22/audit-composed-readiness-cleanup-and-human-acceptance)             | `f24f89e3-147c-424e-b536-2634e9d05ef0` |
| [100-20](https://linear.app/1000lines/issue/100-20/retire-verified-legacy-reviewer-and-pat-dependencies)              | [100-21](https://linear.app/1000lines/issue/100-21/rotate-to-the-event-openai-key-and-verify-reload)                  | `448f75ce-f9f2-41f5-b72b-731eda4cc674` |

Linear also exposes nonblocking `related` records for issue hyperlinks in the
descriptions. These are not DAG edges or activation prerequisites; the only
explicit relation mutations submitted were the sixteen `blocks` inputs above.
The original 100-7 → 100-8 planning blocker is unchanged.

## Body and graph fidelity

The shared `tools/symphony-dag` parser/renderer produced the structural payloads.
Accepted per-node YAML fields were copied into those payloads using the existing
100-8 generation contract. No shared schema/tooling or new planning infrastructure
was committed. Summaries, file/resource ownership, exclusions, checks, commands,
dependencies, delivery notes and temporary-seam/finalization fields were retained.
Source notes and all named plan links point to their pinned repository revisions.

After all issue IDs existed, bodies were regenerated in stable order and replaced
in place. Every direct relation now uses the returned identifier and Linear URL.
WAIT and DEPLOY also name the two returned monitor IDs for later reuse.
Readback comparison covered all fifteen complete bodies, normalizing only Linear's
Markdown layout/link serialization; direct-link labels and URLs were checked
separately. Single summary/generated-content/common-contract sections were verified.

Both the [plan graph](../fan-out-plan-100-7-hackathon-ready.md#dag) and
[standalone graph](../fan-out-plan-100-7-hackathon-ready.mmd) have all fifteen
identifier prefixes. Regeneration replaces an existing prefix; a second pass is
unchanged. Annotation preserves node IDs, payload keys, manifest text, branch
templates, edge endpoints and the relation table. After rebasing PR #4, both
graphs preserve main's amended monitor labels and eighteen edges; the JSON's
manifest digest and sixteen relation records still refer to the original
accepted revision.

Mermaid click directives are omitted because the required shared graph parser
rejects them with `Malformed Mermaid DAG line`. This was reproduced using a
mapped CI click directive. Changing the parser is outside this ticket. The
clickable issue mapping above supplies navigation while both graph copies remain
identical and pass the shared parser.

## Creation validation evidence

Target: accepted source `8f4eafe3999040f67cd68e696e29bcb27eb44149`, the live
100-10–100-24 issue set and the artifact PR's published head (recorded in the
100-8 Codex workpad).

| Environment / command                                                                                             | Acceptance criterion                                                  | Artifact                           | Result / limitation                                                           | Next handoff                                          |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| `npm run symphony-dag:build`                                                                                      | Shared parsing/rendering is usable                                    | 100-8 workpad command output       | Passed                                                                        | none                                                  |
| `npm test -w @example/symphony-dag -- --runInBand`                                                                | Existing parser/renderer behavior                                     | 100-8 workpad: 5 suites, 36 tests  | Passed                                                                        | none                                                  |
| Shared `parseProjectPlan`, `parseRelationPayloadTable`, `buildDagLinearPayload`; mapped-body and graph comparison | Fifteen accepted nodes, sixteen exact edges, full bodies, idempotency | JSON result and APP example        | Passed; shared renderer requires copying rich item fields                     | none                                                  |
| Injected Linear GraphQL create/update/relation mutations and bounded, complete project/edge readback              | R11: correct state, assignment, labels and graph                      | Returned IDs and inputs above/JSON | All mutations succeeded; Markdown serialization normalized                    | Jeremy reviews fan-out                                |
| Docker                                                                                                            | Local-first validation order                                          | 100-8 workpad                      | Skipped — passed locally                                                      | none                                                  |
| Repository CI on original head `5989122b8d923cad761d3c99a810364412d03fa8`                                         | Shared current-commit validation                                      | PR/check links in 100-8 workpad    | Build/lint/test caller was absent at initial publication; no passing CI claim | CI / 100-10 subsequently supplied the caller in PR #5 |

Markdown/JSON formatting and whitespace were checked before initial publication.
GitHub review/event workflows were inspected on that commit; they did not
substitute for build/test CI. The
[accepted bootstrap boundary](https://github.com/1000lines/symphony-example/blob/8f4eafe3999040f67cd68e696e29bcb27eb44149/docs/symphony-plans/hackathon-ready/plan-validation.md#ci-and-review-boundary)
covered the initial planning artifacts with the working reviewer and explicit
missing-CI evidence. The rebased PR includes the caller from PR #5 and requires
fresh build/lint/test, Changed Markdown and CI Required results. Rework commands,
tested commit and CI links are recorded in PR #4 and the 100-8 Codex workpad.

Preflight reverified Linear pink/mature, Backlog/Active/Inactive, Jeremy's active
team identity, both repositories' main refs, both GitHub labels and assignability.
Controller push/triage is available; the current Rust credential is read-only,
as recorded by the accepted design. Future target writes/installation proof
belong to RUST/INSTALL/DEPLOY, and were not performed here. The event key remains
Jeremy's later ROTATE input.

The initial unbounded readback query returned HTTP 400; a bounded query succeeded
with complete pagination. An initial audit counted Linear's nonblocking related
records alongside blocks; the final audit selects the accepted relation type and
verifies its exact endpoints. Neither caused a failed live mutation or duplicate.
