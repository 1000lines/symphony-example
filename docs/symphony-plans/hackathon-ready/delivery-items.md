# Hackathon readiness: delivery items

These are the required item fields for the identically named nodes in the
[100-7 plan](../fan-out-plan-100-7-hackathon-ready.md). Copy fields verbatim into
tickets, together with their manifest branch/PR/state policy and the
[common execution contract](execution-contract.md). Paths are relative to the
item's repository unless qualified. No new shared schema is defined here.

## INSTALL

```yaml
id: INSTALL
title: Prepare and verify both App installations and secret destinations
repository: 1000lines/symphony-example
summary:
  Inventory and reuse both existing public Apps on controller and personal target owners.
  Prepare exact Jeremy operator steps, then verify installations, grants and secret presence without
  switching the working host/reviewer.
creates:
  - docs/symphony-plans/hackathon-ready/installation-evidence.md
edits: []
owned_files:
  - docs/symphony-plans/hackathon-ready/installation-evidence.md
owned_external_resources:
  - 1000lines App registrations 4866508/4866513 and their controller/target installation grants;
    Jeremy executes unavailable administrative changes.
  - Controller cadence-controller Environment/variables/new secret copies; AWS us-west-2
    symphony/github-apps/symphony and exact host read grant. No symphony/keys value changes or host
    restart.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R03/R04/D02/O01: read back IDs, owners, visibility, per-owner installations and selected
    repositories; approve Actions write/Commit statuses read delta and accepted matrix only."
  - Controller cadence-controller Environment restricted to protected main; signing/provider/Linear
    secrets scoped there; Symphony key stored at AWS symphony/github-apps/symphony.
  - No duplicate Apps, bot invitations, PAT borrowing or secret values in evidence. Missing
    admin/key access leaves a concrete PR-visible operator instruction and Inactive wait; code tasks
    continue.
validation_commands:
  - node scripts/symphony/github-app-auth.mjs --preflight --repository 1000lines/symphony-example
  - node scripts/symphony/github-app-auth.mjs --preflight --repository jeremycarroll/venn-search-rs
  - npx prettier --check docs/symphony-plans/hackathon-ready/installation-evidence.md
delivery_notes:
  Estimate 150–300 evidence lines; operational-prerequisite. APP defines preflight
  interface; this node prepares operator actions before requesting them. Mapping edits and
  branch-rule enablement belong to DEPLOY, avoiding overlap with GATE. Resource custody passes to
  DEPLOY after verified setup.
dependencies:
  - item: APP
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Run accepted installation preflight and credential-shape contract.
difficulty: hard
```

## DEPLOY

```yaml
id: DEPLOY
title: Deploy and rehearse Apps, Codex, CI and 15-minute recovery
repository: 1000lines/symphony-example
summary:
  Deploy accepted integration to the existing host, enable trusted workflows and configured
  targets, then prove the complete controller and Rust paths. Keep the working reviewer available
  until isolated replacement proof permits one-mode cutover.
creates:
  - docs/symphony-plans/hackathon-ready/deployment-evidence.md
  - scripts/symphony/hackathon-readiness-smoke.mjs
  - 1000lines/symphony-example:docs/readiness-smoke.md
  - jeremycarroll/venn-search-rs:docs/readiness-smoke.md
  - jeremycarroll/venn-search-rs:tests/hackathon_readiness_smoke.rs
edits:
  - .github/symphony/repositories.yml
  - MIGRATION.md
owned_files:
  - docs/symphony-plans/hackathon-ready/deployment-evidence.md
  - scripts/symphony/hackathon-readiness-smoke.mjs
  - 1000lines/symphony-example:docs/readiness-smoke.md
  - jeremycarroll/venn-search-rs:docs/readiness-smoke.md
  - jeremycarroll/venn-search-rs:tests/hackathon_readiness_smoke.rs
  - .github/symphony/repositories.yml
  - MIGRATION.md
owned_external_resources:
  - "Exclusive rollout custody: EC2 i-00e9329be67c4bc0c, /etc/symphony, Codex auth cache, symphony
    service, controller/target mapping, workflow enablement, branch rules and legacy review
    dismissals."
  - Linear team 100 daemon states/wake:15m label and the two existing fan-out monitor issues;
    controlled rehearsal PRs/associated opted-in issues in both repositories.
  - Both App installations/token-lifecycle tests after INSTALL; drain/park monitors before
    destructive rehearsal cases.
  - Controller and Rust rehearsal PR branches symphony/hackathon-ready/${issue}/readiness-rehearsal;
    exclusive dedicated smoke-file writes, no product file edits.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R01/R03/R04/R05/R06/R07/R08/R09/R10/R12: execute every live scenario in the contract;
    App-authored docs and failure/corrected code, all checks at exact target heads, Codex result,
    correct Linear/ready/mature/human handoff and no bot collaborator."
  - Verify installation expiry renewal, rejected grants/targets, Environment branch-secret denial,
    stale/head/feedback rejection and dropped-event/conflict recovery without loops.
  - Read back workflow enabled state including disabled_fork wakeups; prove actual completion run
    before relying on it. Provision exact daemon states and wake label; bind existing parked monitor
    IDs, then activate only under Jeremy authority.
  - Record real engine anchor/due/dispatch/verdict and released worker slot; correct cron ownership
    and rollback feasibility; no claimed 5m wake or exactly-once semantics.
  - Dismiss exact legacy bot approvals/requests with readback, preserving humans; configure observed
    check/branch rules; update host and controller mapping together.
validation_commands:
  - node scripts/symphony/setup-ci-monitor.mjs --dry-run --mapping .github/symphony/repositories.yml
  - node scripts/symphony/hackathon-readiness-smoke.mjs --mapping .github/symphony/repositories.yml
  - npx prettier --check MIGRATION.md docs/symphony-plans/hackathon-ready/deployment-evidence.md
delivery_notes:
  Estimate 400–750 lines including smoke harness and evidence. Hard fan-in needs
  GUIDE, INSTALL and RUST accepted. Small reversible rehearsal changes are limited to dedicated
  readiness-smoke files described in the contract. Own MIGRATION after setup; RETIRE then ROTATE
  receive ordered resource custody afterward. Missing operator rights become exact commands, not
  fictitious deployment. Two repositories use the same declared main-based branch template with
  separate labeled draft PRs; Rust fixture PR is a rehearsal artifact. Remove the three dedicated
  smoke files before node acceptance; preserve evidence.
dependencies:
  - item: GUIDE
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Deploy accepted installable bundle and profiles.
  - item: INSTALL
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Require verified installation grants and protected credential destinations.
  - item: RUST
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: App rehearsal needs accepted head-checkout CI on target main.
difficulty: hard
```

## RETIRE

```yaml
id: RETIRE
title: Retire verified legacy reviewer and PAT dependencies
repository: 1000lines/symphony-example
summary:
  After successful replacement proof, remove temporary PAT/review-mode paths and obsolete
  active provider dependencies. Classify historical and disabled consumers so retirement never
  silently breaks an assumed recovery path.
creates: []
edits:
  - scripts/symphony/setup-local-env.sh
  - scripts/symphony/host/install.d/40-credentials.sh
  - .github/symphony/repositories.yml
  - .github/workflows/cadence-ai-review-trigger.yml
  - .github/workflows/cadence-ai-review-events.yml
  - .github/workflows/cadence-ai-review.yml
  - docs/symphony-plans/hackathon-ready/deployment-evidence.md
  - scripts/symphony/setup-local-env.test.mjs
  - scripts/symphony/github-app-auth.test.mjs
  - .github/workflows/scripts/cadence-ai-review-events.test.mjs
owned_files:
  - scripts/symphony/setup-local-env.sh
  - scripts/symphony/host/install.d/40-credentials.sh
  - .github/symphony/repositories.yml
  - .github/workflows/cadence-ai-review-trigger.yml
  - .github/workflows/cadence-ai-review-events.yml
  - .github/workflows/cadence-ai-review.yml
  - docs/symphony-plans/hackathon-ready/deployment-evidence.md
  - scripts/symphony/setup-local-env.test.mjs
  - scripts/symphony/github-app-auth.test.mjs
  - .github/workflows/scripts/cadence-ai-review-events.test.mjs
owned_external_resources:
  - "Legacy secret retirement only: symphony/keys:GITHUB_TOKEN and old controller
    PAT/Anthropic/duplicate secret grants; no OPENAI_API_KEY update or host restart. Hand off the
    entire symphony/keys JSON write lease to ROTATE after this update."
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R10/D09: remove HACKATHON_LEGACY_AUTH and HACKATHON_LEGACY_REVIEW markers; no active
    PAT/Anthropic execution or automated approval remains."
  - Retire AWS symphony/keys:GITHUB_TOKEN and controller
    CADENCE_BOT_GITHUB_TOKEN/CADENCE_AI_REVIEW_ANTHROPIC_API_KEY only after presence/use audit and
    Jeremy action; preserve provider OPENAI_API_KEY and Linear fields.
  - Keep optional update-symphony-host-ami.yml disabled and explicitly deferred with its legacy PAT
    requirement documented; do not claim it remains operable or migrate it.
  - Refresh required tests/CI/review at cleanup head and verify App-only run; retain recovery
    instructions and bot accounts.
validation_commands:
  - node --test scripts/symphony/setup-local-env.test.mjs scripts/symphony/github-app-auth.test.mjs
    .github/workflows/scripts/cadence-ai-review-events.test.mjs
  - rg -n
    "HACKATHON_LEGACY_AUTH|HACKATHON_LEGACY_REVIEW|CADENCE_BOT_GITHUB_TOKEN|CADENCE_AI_REVIEW_ANTHROPIC_API_KEY"
    scripts .github
  - npm run lint
delivery_notes:
  "Estimate 200–450 lines; temporary-artifact-lifecycle. Runs after DEPLOY. ROTATE
  follows RETIRE: hand off AWS JSON write custody after legacy-field removal; it alone changes
  provider fields and reloads. FINAL owns integrated MIGRATION closure."
dependencies:
  - item: DEPLOY
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Replacement proof before removing legacy recovery dependencies.
finalization_responsibility:
  Remove the two exact legacy markers in the listed files; retain enabled
  as durable repository opt-in control. Record disabled AMI limitation for FINAL.
difficulty: hard
```

## ROTATE

```yaml
id: ROTATE
title: Rotate to the event OpenAI key and verify reload
repository: 1000lines/symphony-example
summary:
  When Jeremy supplies the organizers key, drain workers/reviews and replace the borrowed
  provider value in the two accepted destinations. Rematerialize host credentials and prove fresh
  host and Cadence execution.
creates:
  - docs/symphony-plans/hackathon-ready/key-rotation-evidence.md
edits: []
owned_files:
  - docs/symphony-plans/hackathon-ready/key-rotation-evidence.md
owned_external_resources:
  - "Exclusive provider rotation/reload custody after DEPLOY: symphony/keys:OPENAI_API_KEY,
    cadence-controller:CADENCE_OPENAI_API_KEY, host materialized copies and symphony restart."
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R02/R10/D09/O02: record version IDs/timestamps, preserve unrelated JSON fields, never record
    key values; exact reload and fresh successful jobs prove the new credential."
  - Update symphony/keys:OPENAI_API_KEY and cadence-controller:CADENCE_OPENAI_API_KEY; run accepted
    materializer then restart, verify service/polling, host Codex task and newly dispatched review.
  - Absent key or failed verification keeps this issue Inactive and final readiness blocked; Jeremy
    owns acquisition/email, no agent sends it.
validation_commands:
  - scripts/symphony/host/install-runtime.sh --only 40-credentials
  - systemctl restart symphony
  - systemctl is-active symphony
  - npx prettier --check docs/symphony-plans/hackathon-ready/key-rotation-evidence.md
delivery_notes:
  Estimate 80–160 evidence lines; external-system-boundary. The hard RETIRE
  prerequisite serializes the shared AWS JSON container; re-read and preserve every other field
  before rotation. No dependency on organizer response for earlier work.
dependencies:
  - item: RETIRE
    type: hard
    requires: Legacy field removal complete and AWS secret write custody handed off.
    reason:
      Serialize symphony/keys JSON updates and legacy removal before provider reload; preserve
      unrelated fields.
difficulty: hard
```

## FINAL

```yaml
id: FINAL
title: Audit composed readiness, cleanup and human acceptance
repository: 1000lines/symphony-example
summary:
  Audit the accepted project target refs and all requirement evidence after retirement and
  event-key rotation. Publish the final readiness record and remaining operational ownership for
  Jeremy acceptance.
creates: []
edits:
  - MIGRATION.md
owned_files:
  - MIGRATION.md
owned_external_resources:
  - Final host reload/combined smoke and issue/project acceptance evidence after RETIRE/ROTATE;
    Jeremy owns final acceptance and monitor ongoing operation.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - R01–R12 and D01–D11/O01–O06 have actual evidence or explicit human descope; no missing
    key/installation/timer/deploy proof is called complete.
  - Verify zero unowned project TODOs/stubs/adapters/disabled paths; HACKATHON_LEGACY_AUTH and
    HACKATHON_LEGACY_REVIEW removed; enabled remains durable opt-in; disabled AMI explicitly outside
    readiness.
  - Record controller/Rust/runtime/deployed refs, accepted PRs, current CI and review, pins, grants,
    no-bot proof, rotation and cleanup; reconcile later cleanup/rotation with deployed bundle and
    perform final combined smoke.
  - Close the bootstrap CI exception with actual caller/main evidence. Human accepts completion;
    monitors may remain operating in Happy/Unhappy rather than being canceled merely to empty the
    project.
validation_commands:
  - node scripts/symphony/hackathon-readiness-smoke.mjs --mapping .github/symphony/repositories.yml
  - rg -n "HACKATHON_LEGACY_AUTH|HACKATHON_LEGACY_REVIEW" scripts .github
  - npx prettier --check MIGRATION.md
delivery_notes:
  Estimate 150–300 lines; fan-out-finalization-boundary. Audit accepted ownership
  only. Unexpected cleanup beyond listed obligations requires reviewed amendment; never invent extra
  tickets or delete bot accounts. FINAL has sole final MIGRATION ownership.
dependencies:
  - item: ROTATE
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Final readiness requires successful event-key verification.
difficulty: hard
```

## MON_CONTROLLER

```yaml
id: MON_CONTROLLER
title: Monitor CI and review for 1000lines/symphony-example
repository: 1000lines/symphony-example
summary:
  Persistent repository monitor for 1000lines/symphony-example, team 100 and the explicitly
  mapped project IDs. Reconcile only opted-in Active/Inactive PRs with the accepted bounded scan
  after human activation.
creates: []
edits: []
owned_files: []
owned_external_resources:
  - Only 1000lines/symphony-example opted-in PR/issue reconciliation, action markers and this
    monitor cursor/workpad; no cross-repository writes. DEPLOY owns activation; pause scan before
    its fault-injection/rotation window.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R09/D07: Active with DEPLOY as a hard blocker; do not block ordinary delivery tickets,
    make code fixes, create an extra scheduler or open a task PR."
  - At activation require deployed WAIT/GUIDE, verified mapping and CI allowlist, exact
    Happy/Unhappy/Evaluating IDs and wake:15m; missing prerequisites stop activation.
  - Bound scans to five minutes; use shared actions/cursor and exact verdict rules; write only own
    Codex workpad, never engine anchor; never mark this long-running service Done merely because one
    scan passes.
validation_commands:
  - node scripts/symphony/ci-monitor.mjs --repository 1000lines/symphony-example --mapping
    .github/symphony/repositories.yml
delivery_notes:
  No PR / 0 changed lines; persistent operations issue. Copy the full monitor and
  common rules from execution-contract.md. Initial labels only pink; DEPLOY provisions/applies
  wake:15m after discovery. Jeremy owns continued monitoring after FINAL.
dependencies:
  - item: DEPLOY
    type: hard
    requires: Completed deployed setup, mapping and wake state verification.
    reason: Jeremy activated all tickets; this incoming blocker prevents premature monitor scans.
difficulty: hard
```

## MON_RUST

```yaml
id: MON_RUST
title: Monitor CI and review for jeremycarroll/venn-search-rs
repository: 1000lines/symphony-example
summary:
  Persistent repository monitor for jeremycarroll/venn-search-rs, team 100 and the explicitly
  mapped project IDs. Reconcile only opted-in Active/Inactive PRs with the accepted bounded scan
  after human activation.
creates: []
edits: []
owned_files: []
owned_external_resources:
  - Only jeremycarroll/venn-search-rs opted-in PR/issue reconciliation, action markers and this
    monitor cursor/workpad; no cross-repository writes. DEPLOY owns activation; pause scan before
    its fault-injection/rotation window.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R09/D07: Active with DEPLOY as a hard blocker; do not block ordinary delivery tickets,
    make code fixes, create an extra scheduler or open a task PR."
  - At activation require deployed WAIT/GUIDE, verified mapping and CI allowlist, exact
    Happy/Unhappy/Evaluating IDs and wake:15m; missing prerequisites stop activation.
  - Bound scans to five minutes; use shared actions/cursor and exact verdict rules; write only own
    Codex workpad, never engine anchor; never mark this long-running service Done merely because one
    scan passes.
validation_commands:
  - node scripts/symphony/ci-monitor.mjs --repository jeremycarroll/venn-search-rs --mapping
    .github/symphony/repositories.yml
delivery_notes:
  No PR / 0 changed lines; persistent operations issue. Copy the full monitor and
  common rules from execution-contract.md. Initial labels only pink; DEPLOY provisions/applies
  wake:15m after discovery. Jeremy owns continued monitoring after FINAL.
dependencies:
  - item: DEPLOY
    type: hard
    requires: Completed deployed setup, mapping and wake state verification.
    reason: Jeremy activated all tickets; this incoming blocker prevents premature monitor scans.
difficulty: hard
```
