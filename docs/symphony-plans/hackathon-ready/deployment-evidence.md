# Deployment rehearsal: 100-19

Status: **preflight incomplete; host deployment and recovery rehearsal pending**.
Observed September 11, 2026, starting from
`main@a3b7428a9e0298592e119a57923854b75a9b61a0` in
`1000lines/symphony-example`. Task branch:
`symphony/hackathon-ready/100-19/readiness-rehearsal`, base `main`.
Jeremy Carroll owns the operator handoff. The
[Codex workpad](https://linear.app/1000lines/issue/100-19/deploy-and-rehearse-apps-codex-ci-and-15-minute-recovery#comment-5eba8e8e)
records subsequent task-head CI and feedback.

## Accepted implementation

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

## Observed evidence

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
   GUIDE's prepared correction compares the real paths of `process.argv[1]`
   and `fileURLToPath(import.meta.url)` so invocation through the personal skill
   symlink executes. This file is outside DEPLOY's owned files. Rerun the two
   integration suites above and merge the correction to main before rollout.
2. Jeremy approves Symphony Actions write and Commit statuses read on the
   registration/installation and updates the existing signing secret's
   permission ceiling. Follow the existing
   [INSTALL operator recipe](installation-evidence.md#jeremy-operator-actions);
   preserve signing material and other fields. Re-run exact-target preflight.
   Cadence remains the Claude review path under the current amendment.
3. Diagnose delivery of `CADENCE_APP_PRIVATE_KEY` to the native reusable
   reviewer. Its Environment metadata is present and the router uses the key
   successfully, so another blind secret write is not evidence of a fix.
   Reproduce on this task's PR through the accepted direct workflow entry point:

   ```bash
   gh workflow run cadence-ai-review-trigger.yml --repo 1000lines/symphony-example --ref main -f pr_number="$REHEARSAL_PR"
   ```

   Set `REHEARSAL_PR` to the actual open task PR first. Record the new run,
   exact reviewed head, author-permission outcome and Cadence workpad. Workflow
   source corrections require their owning scope; deployment evidence must not
   replace the reviewer with the removed controller.

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
- R09: the waiting ticket's real engine anchor, due time, dispatch and verdict
  after a deliberately dropped event; conflict recovery and duplicate/terminal
  interleavings. Record jitter and polling/capacity delay. No strict 15-minute
  SLA or exactly-once claim follows from the configured interval.
- R10: installed accepted refs, successful reload and fresh worker execution.
  Retain legacy review credentials until replacement proof authorizes retirement.
  There is no verified cron rollback; use a verified operator recovery path.
- R07/R12: Rust rehearsal remains unresolved pending the canceled predecessor
  scope decision. No Rust fixture, installation or CI acceptance is claimed.

Local smoke/format/CLI validation and mandatory CI for this checkpoint are
recorded in the task PR and pinned workpad. The known upstream installation
failure remains a deployment blocker even if this checkpoint's CI is green.
