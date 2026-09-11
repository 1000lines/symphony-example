# Deployment rehearsal: 100-19

Status: **accepted bundle refreshed; Cadence repairs and delivery rehearsal pending**.
Observed September 11, 2026, starting from
`main@a3b7428a9e0298592e119a57923854b75a9b61a0` in
`1000lines/symphony-example`. Task branch:
`symphony/hackathon-ready/100-19/readiness-rehearsal`, base `main`.
Jeremy Carroll owns the operator handoff. The
[Codex workpad](https://linear.app/1000lines/issue/100-19/deploy-and-rehearse-apps-codex-ci-and-15-minute-recovery#comment-5eba8e8e)
records subsequent task-head CI and feedback.

## Accepted implementation

- [Jeremy's PR #25 decision](https://github.com/1000lines/symphony-example/pull/25#issuecomment-5634002190)
  at September 11, 11:51:28 UTC drops the separate timer/dropped-event recovery
  rehearsal and its evidence requirements. Retain the installed timer
  configuration; do not build a timer harness or require anchor/due/jitter/
  forced-drop measurements for acceptance. Jeremy accepts manual recovery for
  the next couple of days. This supersedes conflicting timer-proof checklist
  items in the pinned plan and execution contract. Other accepted rollout work
  remains, including viable Cadence and an actual ticket delivery run.
- [100-35 / PR #26](https://github.com/1000lines/symphony-example/pull/26) owns
  the installed repository-helper symlink and reusable reviewer key-delivery
  repairs. Jeremy explicitly authorized both source fixes despite the earlier
  ownership gap. They must land on main and the helper must be deployed through
  the operator path; their unmerged code is not included in this task branch.
- [PR #10](https://github.com/1000lines/symphony-example/pull/10) selects task
  repositories through the installed skill and target-owned `.symphony.cfg.json`.
  The removed central mapping is superseded.
- [Jeremy's PR #12 review](https://github.com/1000lines/symphony-example/pull/12#pullrequestreview-5173381374)
  selects a timer on each waiting ticket: `Unhappy` plus `wake:15m`, then
  `Evaluating`; success becomes `Inactive`, failure becomes `Active`.
  No scanning monitor or GitHub conflict cron is part of this implementation.
- [PR #18](https://github.com/1000lines/symphony-example/pull/18) supplies native
  hooks around Claude review and checks the original feedback author's access.
  The [100-34 amendment](https://linear.app/1000lines/issue/100-34) removes the
  dormant alternative controller. Provider migration and App-owned acceptance
  checks remain unimplemented project outcomes. Preserve the working reviewer.
- [PR #23](https://github.com/1000lines/symphony-example/pull/23) landed current
  guidance at the selected base above. Its installed CLI regression remains
  reproducible; human merge did not change that test result.

These accepted changes replace the corresponding historical interfaces in the
[pinned execution contract](https://github.com/1000lines/symphony-example/blob/8f4eafe3999040f67cd68e696e29bcb27eb44149/docs/symphony-plans/hackathon-ready/execution-contract.md).
Do not restore `setup-ci-monitor.mjs` or `.github/symphony/repositories.yml` to
make the old validation commands run. Existing canceled issues remain canceled.
Rust CI (100-13) and the Rust monitor (100-24) are canceled; whether to retain
the second-repository rehearsal is an explicit pending scope question in the
workpad. R07's Rust fallback and R12 remain unverified.

## Current readback — September 11, 11:55 UTC

The following observations supersede the older host baseline below. They do
not claim that the pending App rollout or ticket rehearsal has passed.

- **R10, installed bundle:** the installed manifest now reports
  `a3b7428a9e0298592e119a57923854b75a9b61a0`, installed at
  `2026-09-11T11:40:46Z`, bundle digest
  `f9da3201fffc6bcdb62ef728213b95d5de2c9e39939d1a8b2fba428b1a7e60b3`.
  Runtime symlink remains `e4d3f6a05b0a00201c9d04d3ceca02b206e22de5`.
  `systemctl show symphony` reports active/running, PID 303853, active since
  `2026-09-11T11:40:53Z`. This is readback of an operator refresh; the worker
  did not run the installer. Deployment of the pending 100-35 repair is next.
- **Retained timer configuration:** `/etc/symphony/WORKFLOW.md` has active
  states `[Active, Evaluating]`, daemon `[Unhappy]`, dispatch `[Evaluating]`,
  default wake `15m`, one evaluation slot and 30-second polling. Configuration
  inspection passed; timer execution measurements are outside the amended scope.
- **Read-only preflight:** at `2026-09-11T11:55:21Z`,
  `node scripts/symphony/hackathon-readiness-smoke.mjs --base main --pr 25`
  collected all six observations successfully. Source base is `a3b7428`;
  task head is `83bdc892d1006741e0a83ffac03b553677a52ed3`. Local supporting
  artifact: `.git/100-19/resumed-preflight.json`. `readiness: not assessed`
  remains intentional. Main-only Environment/key metadata and active workflow
  observations pass, without proving reviewer key delivery.
- **R06, task CI:** [run 34565607494](https://github.com/1000lines/symphony-example/actions/runs/34565607494),
  attempt 1, `pull_request`, `.github/workflows/ci.yml`, tested
  `83bdc892d1006741e0a83ffac03b553677a52ed3`, GitHub Actions App `15368`.
  All required jobs succeeded: Changed Markdown `103156989530`, lint
  `103156989734`, test `103156989793`, build `103156989854`, and CI Required
  `103157087155`. This proves that checkpoint only; subsequent commits need
  their own CI, recorded in the PR and pinned workpad.
- **R08, task completion bridge:** [run 34565619852](https://github.com/1000lines/symphony-example/actions/runs/34565619852)
  records at `05:21:44.835Z`: `100-19: Inactive -> Inactive`, with the successful
  CI run above. The repeated [run 34565620281](https://github.com/1000lines/symphony-example/actions/runs/34565620281)
  preserves Inactive at `05:21:55.098Z`. These are actual completion readbacks;
  they do not demonstrate failure/correction or the full human handoff.
- **R05, task review:** [run 34565616135 / job 103157045119](https://github.com/1000lines/symphony-example/actions/runs/34565616135/job/103157045119)
  routed PR #25 but failed at token mint with `privateKey option is required`.
  No successful provider execution, current-head approval or human handoff is
  claimed. Resume normal ticket review after the 100-35 repair lands.
- **Operator boundary:** `sudo -n true` still fails because of
  `no new privileges`. Jeremy's authorized operator session must deploy the
  accepted repair and approved App configuration. The earlier App grant denial
  below remains unresolved; refreshing source does not expand installation grants.

## Historical baseline — September 11, approximately 05:18 UTC

All local source checks below use the selected base above. Host observations
use the separately recorded installed revision. Public run links are durable
evidence; `.git/100-19/` logs are local supporting artifacts only.

| Criterion / environment                                        | Actual result                                                                                                                                                                                                                                                                                                                                              | Limitation and next handoff                                                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R10: installed bundle manifest                                 | `/var/lib/symphony/cache/codex-home/runtime-bundle-manifest.json` records `f670040be4e524fbaf7c360dcf0e62945ca8e50b`, installed `2026-09-09T18:18:35Z`. Bundle digest `584af7ec3c23b92a6ef321740e263bc3b0dbac68aeeb2ba953bf7124b14e1fde`.                                                                                                                  | Accepted September 11 guidance is not installed. Authorized operator must refresh after source and credential gaps close.                                        |
| R09: `/etc/symphony/WORKFLOW.md` and `systemctl show symphony` | Active states `[Active]`, no daemon states or dispatch states. Service active/running, PID `53789`, active since September 9 14:26:18 UTC; polling configured at 30 seconds.                                                                                                                                                                               | File/service inspection provides no timer wake, anchor, due, dispatch, verdict or slot-release proof.                                                            |
| R10: host install authority, `sudo -n true`                    | Denied: the runtime's `no new privileges` flag prevents sudo running as root.                                                                                                                                                                                                                                                                              | Existing authorized root/operator session must perform installation/reload. No privilege workaround used.                                                        |
| R10: installed profile integration                             | `node --test scripts/symphony/runtime-bundle/runtime-bundle.integration.test.mjs scripts/symphony/host/hosted-runtime-integration.test.mjs`: **11 pass, 1 fail**. Installed repository CLI produces empty stdout; JSON parsing fails at hosted integration line 275.                                                                                       | Source defect already recorded by GUIDE. Correct the CLI entry-point check before deployment; Docker cannot repair this assertion.                               |
| R03/R04: Symphony App discovery                                | AWS STS confirms account `350353785278`, host role `symphony-instance`, instance `i-00e9329be67c4bc0c`. Existing secret version `f309e6b7-e4c5-4e7b-bb68-f720a0b96557` authenticates App `4866508`, slug `1000lines-symphony`; binding resolves installation `160626742`, repository `1362180215`. Metadata discovery token revoked.                       | This is controller discovery, not App-authored push/review or both-owner proof. Key values were held privately and never reported.                               |
| R04: accepted operation grants                                 | Broker preflight requesting the approved matrix fails: `GitHub App: installation denied actions:write; owner approval required`. Stored ceiling still has Actions read and no statuses grant.                                                                                                                                                              | Jeremy must approve installation grants and update the existing secret's permission ceiling using the INSTALL recipe. No token renewal can add missing grants.   |
| R04: Environment and main                                      | `cadence-controller` uses custom branch policies; its sole policy is branch `main`, ID `59668485`. Main returns `protected:true`.                                                                                                                                                                                                                          | Metadata passes. A rejected branch-secret execution and detailed required-check rules remain unverified; protection details return HTTP 404 to this caller.      |
| R04: Cadence secret metadata                                   | Environment lists `CADENCE_APP_PRIVATE_KEY` (updated `2026-09-11T02:26:41Z`) and `CADENCE_OPENAI_API_KEY`. Variables report App `4866513`, controller installation `160764288`.                                                                                                                                                                            | Metadata does not prove key delivery or successful reviewer authentication. Preserve current secrets while diagnosing the call below.                            |
| R08: workflow enablement                                       | CI, review ingress, events, trigger, handoff and Symphony Linear Wakeups all read back `active`. AMI updater remains `disabled_fork`.                                                                                                                                                                                                                      | No enablement write was needed. Disabled AMI automation is not a recovery path.                                                                                  |
| R08: real CI completion bridge                                 | [Run 34564667145](https://github.com/1000lines/symphony-example/actions/runs/34564667145), based on `a5d10c7878c5d43dd3051794f4c1c0db40cdd65c`, logs at `05:06:22.894Z`: `100-18: Unhappy -> Inactive`, linked to [CI 34564618895](https://github.com/1000lines/symphony-example/actions/runs/34564618895) for `5544d13c57c2dbbd26ce45ae2a880f9887069743`. | Real sibling completion evidence; it does not prove a dropped-event timer, a failure/correction cycle, or this task's CI.                                        |
| R01/R05: native review                                         | [Run 34564627012](https://github.com/1000lines/symphony-example/actions/runs/34564627012), base `a5d10c7`, routes PR #23 successfully. Job `103154136788` fails at `Mint existing Cadence App token`: `privateKey option is required`.                                                                                                                     | The called reviewer receives no key despite Environment metadata. No provider execution or current-head review acceptance. Diagnose key delivery before cutover. |
| R05: closed-PR routing                                         | [Run 34565032125](https://github.com/1000lines/symphony-example/actions/runs/34565032125) at `a3b7428` rejects PR #23 after merge at the open-PR assertion; review is skipped.                                                                                                                                                                             | This failure is distinct from the missing-key failure. It is not successful review evidence.                                                                     |
| R03: publication identity                                      | `gh api user`: `1000-symphony-bot`, type User; repository permissions push/triage true, admin/maintain false. App mode and App config are absent from the current worker environment.                                                                                                                                                                      | Checkpoint publication uses the existing bootstrap identity and cannot demonstrate App-only implementation. No human PAT or bot invitation is introduced.        |

## Read-only smoke command

From the target checkout, after fetching its selected base:

```bash
git fetch origin main
node scripts/symphony/hackathon-readiness-smoke.mjs --base main
```

Add `--pr NUMBER` for a real open task PR. The script records configuration,
workflow state, Environment restriction/key metadata, installed timer profile,
and optional exact-head check/run/review metadata. It rejects a changed PR head
or base during collection and reports API denials without echoing raw output.
Run from the matching repository; `--repo` is checked against checkout origin.
`--host-workflow FILE` permits a rendered fixture or a separately inspected host
file; record which was used. A fixture is not installed-host evidence.

Exit 1 identifies a blocked observation. Exit 0 means these observations were
collected successfully; `readiness` remains `not assessed`. This small recorder
does not make acceptance decisions or perform mutations. Review all current PR
feedback, run jobs/checkout summaries and the Linear workpad before handoff.
Copy relevant results into this document/workpad; local JSON alone is not a
durable reviewer artifact.

## Remaining operator and source actions

1. Correct the installed CLI entry-point check in
   `scripts/symphony/runtime-bundle/skills/symphony-repository/scripts/config.mjs`.
   The 100-35 correction compares the real paths of `process.argv[1]`
   and `fileURLToPath(import.meta.url)` so invocation through the personal skill
   symlink executes. The source repair is explicitly owned by 100-35 / PR #26.
   Rerun the two integration suites above and merge the correction to main
   before deploying it; do not patch the installed bundle directly.
2. Jeremy approves Symphony Actions write and Commit statuses read on the
   registration/installation and updates the existing signing secret's
   permission ceiling. Follow the existing
   [INSTALL operator recipe](installation-evidence.md#jeremy-operator-actions);
   preserve signing material and other fields. Re-run exact-target preflight.
   Cadence remains the Claude review path under the current amendment.
3. Complete 100-35's repair of `CADENCE_APP_PRIVATE_KEY` delivery to the native
   reusable reviewer. Its Environment metadata is present and the router uses the key
   successfully, so another blind secret write is not evidence of a fix.
   Reproduce on this task's PR through the accepted direct workflow entry point:

   ```bash
   gh workflow run cadence-ai-review-trigger.yml --repo 1000lines/symphony-example --ref main -f pr_number="$REHEARSAL_PR"
   ```

   Set `REHEARSAL_PR` to the actual open task PR first. Record the new run,
   exact reviewed head, author-permission outcome and Cadence workpad. Workflow
   source corrections are authorized in 100-35; deployment evidence must not
   replace the reviewer with the removed controller. Use an actual ticket PR
   (100-35's PR where practical) to prove normal ingress, current-head review,
   matching Cadence workpad and the expected handoff.

4. After these prerequisites close, use the existing authorized root session
   on `i-00e9329be67c4bc0c`. Preserve its nonsecret installation settings and
   record the accepted bootstrap/runtime refs. The documented installer
   sequence for App rollout is:

   ```bash
   scripts/symphony/host/install-runtime.sh --only 05-source --only 40-credentials --only 45-runtime-bundle --only 80-config --only 90-provenance
   systemctl restart symphony
   systemctl show symphony --property=ActiveState,SubState,MainPID,ActiveEnterTimestamp
   ```

   This is a pending operator sequence, not a performed deployment. Supply the
   explicit accepted `SYMPHONY_BOOTSTRAP_REF`, existing runtime ref/repositories,
   App mode and verified identity inputs required by
   [the bundle installer](../../../scripts/symphony/runtime-bundle/README.md#repository-discovery-and-onboarding).
   Drain workers before restart and retain prior provenance/configuration for
   rollback. Re-read the installed manifest/profile and service/polling after
   restart. No new runtime build is needed merely to enable supported states.

## Rehearsal still required

Run controlled fixtures only after the relevant prerequisites close. Retain
the failing and corrected commit/run links; never merge intentional failure.
Remove dedicated smoke files after recording their evidence.

- R03/R04: App-authored docs/code push, PR, labels and assignment; installation
  expiry renewal and denied/revoked/suspended/unselected cases; exact scope and
  no-bot-collaborator proof. Current discovery is insufficient.
- R05/R06/R08: current-head CI and Claude review, authorized original feedback
  author, stale-head/feedback rejection, failure → correction → fresh success
  → ready/human handoff, and actual released worker slot.
- R08/R09: retain applicable CI/event conflict recovery and duplicate/terminal
  safeguards. The separate timer/dropped-event rehearsal, its harness and
  anchor/due/jitter/forced-drop measurements are removed from acceptance by
  Jeremy's decision above. Manual recovery is accepted for the next couple of
  days; no timer execution proof is claimed.
- R10: installed accepted refs, successful reload and fresh worker execution.
  Retain legacy review credentials until replacement proof authorizes retirement.
  There is no verified cron rollback; use a verified operator recovery path.
- R07/R12: Rust rehearsal remains unresolved pending the canceled predecessor
  scope decision. No Rust fixture, installation or CI acceptance is claimed.

Local smoke/format/CLI validation and mandatory CI for this checkpoint are
recorded in the task PR and pinned workpad. The known upstream installation
failure remains a deployment blocker even if this checkpoint's CI is green.
