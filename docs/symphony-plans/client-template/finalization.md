# Client-template finalization checkpoint

Status: **retirement remains open**, September 12, 2026. This is CT-Z's audit of
`1000lines/symphony-example@70a8a2415085598ea86e63a71f11faff85cb54c1`, with
branch and PR base `main`. It records the accepted adoption and remaining proof;
it does not declare AC1–AC13 complete. Jeremy owns final acceptance.

## Accepted changes and current targets

[Jeremy's PR #51](https://github.com/1000lines/symphony-example/pull/51), merged
as `9547c3504f94c84aebee27d2b20a16a781adea31`, adopted template **main**
`e7a9be382c062f141727c9a9129aef384aea8efb`. It replaced the embedded review,
handoff and cleanup bodies with generated callers, preserved existing CI and
manual entry names, and made the old wakeup body reusable-only. This accepted
artifact supersedes the proposed adoption in unmerged, closed PR #50. Linear
100-58 is Canceled; its cancellation does not supply the missing live evidence.

The [adoption record](adoption-evidence.md) identifies actual refs and runs. The
[consumer census](consumer-census.md) explains every retained entry and the
absence of any helper deletion authorization. No executable path, published ref,
setting or credential changes in this checkpoint.

Jeremy accepted the initial publication subset in 100-55/100-56 with deferred
provider/caller work. Later template PR #6 and example PR #51 adopted 100-64's
key-driven provider contract. Preserve those accepted changes: the older
explicit-selection AC4 wording below is a reconciliation item, not authority
to reverse them. The original plan and historical inventories remain records.

## AC1–AC13 evidence matrix

Criteria refer to the [accepted design](../client-template-design.md#acceptance-criteria-and-evidence)
and its subsequent human decisions. “Source” is an inspected artifact, not
installed or executed proof. Unverified evidence stays open even when its
implementation issue is terminal.

| Criterion                                | Evidence available at this checkpoint                                                                                                                                                                                                                                                                                | Remaining acceptance / owner                                                                                                                                                                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1: minimal client and eight answers    | PR #51 records eight nonsecret answers and preserves application CI. Published template `e7a9be3` selects only `template/`; twelve skill/resource files remain after 100-63's accepted removal. Seed-owned Karpathy files are retained by PR #51.                                                                    | CT-Z must reconcile final rendered inventory with the eventual accepted release; no root-development leakage is claimed from source alone.                                                                                                                                          |
| AC2: varied targets and preservation     | CT-Q/T render fixtures remain under `templates/symphony-client/tests/`; [PR #51](https://github.com/1000lines/symphony-example/pull/51) records eight upstream render tests and reviewed existing-file reconciliation.                                                                                               | Repeat or reuse exact-ref final published render evidence when the release combination is settled.                                                                                                                                                                                  |
| AC3: trusted helpers and named secrets   | Both current consumers explicitly forward review App/Linear/provider secrets to workflow/helper `ac15fc1`; wakeups use workflow/helper `alpha`. Ingress and application CI receive no reviewer secrets.                                                                                                              | Workflow PR #2 is open/unmerged; its pinned source is not proof of accepted alpha publication or successful privileged execution.                                                                                                                                                   |
| AC4: provider/verdict contract           | Current [review context](../../../.github/symphony/REVIEW.md) implements the later 100-64 key-driven rule. [Workflow PR #2](https://github.com/1000lines/symphony-client-workflows/pull/2) contains the provider implementation.                                                                                     | Jeremy reconciles the original explicit-choice criterion with the accepted newer contract and identifies accepted provider matrix/verdict proof. Preserve terminal 100-49/100-64 states.                                                                                            |
| AC5: real final Codex review             | Example event run [34662935136](https://github.com/1000lines/symphony-example/actions/runs/34662935136) reaches shared `ac15fc1` but skips the provider after acquisition fails. Template run [34658729574](https://github.com/1000lines/symphony-client-template/actions/runs/34658729574) also skips its provider. | Jeremy supplies successful final runs for both consumers with target head, provider/App identity, review, workpad and consumed commits. These failed runs do not satisfy AC5.                                                                                                       |
| AC6: public template/provenance          | Template alpha `58021a7`, main `e7a9be3`; [PROVENANCE](https://github.com/1000lines/symphony-client-template/blob/e7a9be382c062f141727c9a9129aef384aea8efb/PROVENANCE.md) records extraction, Apache-2.0 and upstream attribution. CT-U records a public-alpha render.                                               | Publication owner settles final alpha and records a render of that actual commit. Current alpha predates the adopted template.                                                                                                                                                      |
| AC7: adoption and staging retirement     | Human-merged PR #51 preserves Copier metadata, application commands and required checks; it already removes the old review bodies.                                                                                                                                                                                   | `templates/symphony-client/` and its required render workflow remain. CT-Z retains them until accepted replacement evidence and check migration justify retirement.                                                                                                                 |
| AC8: multi-project/config-reader support | Selected-base config has team 100 and no project key. CT-C source implements optional modes; installed reader inspection accepts this omitted-mode config.                                                                                                                                                           | CT-A's [workpad](https://linear.app/1000lines/issue/100-58#comment-3875cc13) records an older installed reader rejecting explicit modes. Jeremy supplies current installed/loaded version and two-project/mode readbacks; that historical finding is not a fresh deployment result. |
| AC9: onboarding                          | CT-O's [merged PR #49](https://github.com/1000lines/symphony-example/pull/49) records a dependency note. Generated [review context](../../../.github/symphony/REVIEW.md) assigns guided provisioning/readiness to 100-62.                                                                                            | Jeremy identifies delivered onboarding/installed skill refs and fork/direct/repeat/additional-project walkthroughs. A copied skill or dependency note is not a walkthrough.                                                                                                         |
| AC10: CI, review and human acceptance    | Linked adoption/publication PRs and workpads distinguish local tests, CI and live proof. This checkpoint uses main/main and the seed's configured CI checks.                                                                                                                                                         | Current cleanup-head CI and Cadence belong in the CT-Z PR/workpad. Jeremy's final acceptance remains required; CI cannot close this project.                                                                                                                                        |
| AC11: separate workflow publication      | Public workflow main/alpha `77cfb2d` has [export provenance](https://github.com/1000lines/symphony-client-workflows/blob/77cfb2d1f4e0e488af207096b1785b63ffc0398b/PROVENANCE.md). No alpha tag collision was found.                                                                                                  | Five review/handoff/cleanup callers in each consumer still pin `ac15fc1`; final literal-alpha migration and actual helper checkout evidence remain open.                                                                                                                            |
| AC12: native/Docker/remote execution     | CT-C source and PR #51's local native results exist; the separate [Docker/Rust requirements](../docker-rust-ci/requirements-and-design.md) were accepted in PR #52.                                                                                                                                                  | Jeremy/parent delivery owners supply client-Dockerfile digest/results and real remote failure→Active→passing→Inactive readbacks at named heads. Requirements and fixtures are not those runs.                                                                                       |
| AC13: advisory lifecycle and readiness   | Cleanup [34663032908](https://github.com/1000lines/symphony-example/actions/runs/34663032908) succeeds through `ac15fc1`. Committed seed requirements contain only CI Required and Client template tests (App 15368).                                                                                                | Both consumers still need actual-head queued/running→linked verdict, draft→ready and cancellation/recovery proof, plus effective required-check readback. A successful cleanup job alone does not establish these transitions.                                                      |

## Search audit and lifecycle

The scope includes merged project work, not only this documentation diff: the
two export manifests (69 exact rows, 66 existing paths), staging, client-plan
documents and owned workflow entry points. The three absent planned rows are
`scripts/cadence-provider-result.mjs`, `scripts/cadence-provider-result.test.mjs`
and `.github/symphony/cadence-provider-review.md`; they are historical proposed
implementations, not files to create or delete. Later provider delivery belongs
to its reviewed workflow source.

| Finding                                              | Disposition                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging and its old `fd383f5` seed workflow pins     | Retain; the required `Client template tests` workflow still reads staging. CT-A/Z lifecycle remains unresolved after cancellation; Jeremy must identify the accepted replacement evidence and owner before deletion.                                    |
| Five old review/handoff/cleanup filenames            | PR #51 already converted them to generated callers. Retain their real ingress, manual and completion consumers; the cleanup listener matches all three current review workflow names.                                                                   |
| Remaining command/wakeup bodies and exported helpers | Retain. No accepted census marks a helper unreferenced; frozen published refs, local tests and tooling imports remain consumers. Exact scope and examples are in the census.                                                                            |
| TODO/FIXME/HACK/TEMPORARY/XXX/STUB hits              | Project/staging scan finds only the finalizer's own audit instructions. Export scan additionally finds `HACKATHON_LEGACY_REVIEW`, fixture identities and a lockfile hash substring; none is an unexplained project TODO.                                |
| Temporary fixture directories                        | `test_answers.py` and `test_render.py` register `TemporaryDirectory.cleanup`; these are test resources, not deployed seams.                                                                                                                             |
| Adapter, disabled and legacy hits                    | Checks API adapter, Linear legacy-state fallback, legacy workpad parsing and author-rejection fixtures are retained shared behavior. Broad human-review fallback is intentionally disabled. Standing-doc fixtures deliberately contain temporary prose. |
| Historical controller and unrelated host work        | Excluded. CT-Z does not delete dormant controller code, alter the host, or take ownership of PR #52's separate Docker/Rust delivery.                                                                                                                    |

Reproduce marker/reference searches with ordinary `rg --hidden` over these
paths and the literal paths in `ci-export.txt` / `review-export.txt`. Search
`TODO`, `FIXME`, `HACK`, `TEMPORARY`, `XXX`, `STUB`, `adapter`, `disabled`,
`legacy`, `shim`, `staging`, and both repository workflow prefixes. Inspect
each hit; a word match is not deletion authorization. The
[CT-Z workpad](https://linear.app/1000lines/issue/100-59#comment-d2232f81)
records commands, tested head, results and handoff.

## Owner handoff

No additional body/helper deletion is justified at this checkpoint. The
documentation change can be reviewed independently while retirement stays open.
Jeremy must identify accepted publication/live-consumer evidence for the gaps
above, or explicitly revise final acceptance and assign the remaining delivery.
CT-Z cannot infer that decision from Done/Canceled states. Preserve historical
refs and terminal issues; do not reopen CT-A or merge/promote refs automatically.

After the accepted evidence is available, refresh both consumers and all exact
refs, update the census, then perform only justified deletions. Run affected
local workflow/manual tests, locked formatting and `git diff --check`; use
Docker only for environment gaps, then mandatory cleanup-head CI and fresh
Cadence. Any changed executable forwarding/manual entry also needs a real smoke.
