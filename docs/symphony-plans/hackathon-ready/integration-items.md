# Hackathon readiness: integration items

These are the required item fields for the identically named nodes in the
[100-7 plan](../fan-out-plan-100-7-hackathon-ready.md). Copy fields verbatim into
tickets, together with their manifest branch/PR/state policy and the
[common execution contract](execution-contract.md). Paths are relative to the
item's repository unless qualified. No new shared schema is defined here.

## CODEX

```yaml
id: CODEX
title: Build isolated Codex assessment and trusted check publication
repository: 1000lines/symphony-example
summary:
  Adapt the existing Cadence review axes and classifications to structured Codex assessment.
  Add trusted evidence acquisition and result publication using the landed mapping, App helper and
  persisted generation contract.
creates:
  - .github/codex/review.md
  - .github/codex/review-output.schema.json
  - scripts/cadence-codex-review.mjs
  - scripts/cadence-codex-review.test.mjs
edits: []
owned_files:
  - .github/codex/review.md
  - .github/codex/review-output.schema.json
  - scripts/cadence-codex-review.mjs
  - scripts/cadence-codex-review.test.mjs
owned_external_resources:
  - Isolated evidence/output fixtures; no live review dispatch or provider-key changes.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R01/R05/D01/D03/O06: preserve stable findings, coverage, all human feedback, incremental/full
    review and blocker/human-needed/should-fix/suggestion semantics."
  - Separate bounded read-only evidence, assessment and publication; never execute PR scripts with
    credentials or pass App private keys/Linear write tokens to assessment.
  - Validate schema, current target head/generation, mandatory findings and workpad write before
    publishing; recheck freshness and fail visibly on provider/output/persistence errors.
validation_commands:
  - node --test scripts/cadence-codex-review.test.mjs
  - npm run lint
delivery_notes:
  Estimate 650–900 lines; evaluation-first-ai-change/untrusted-content-boundary.
  Existing .claude review sources are read-only here; GUIDE retires their active wording. ROUTE
  wires durable acquisition/publication modules; DEPLOY owns real provider proof.
dependencies:
  - item: APP
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Import renewable target/controller token APIs from main.
  - item: GATE
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Import trusted mapping, predicates and persisted generations from main.
difficulty: hard
```

## WAIT

```yaml
id: WAIT
title: Reconcile CI and review through events and bounded monitors
repository: 1000lines/symphony-example
summary:
  Use shared predicates for success, failure and handoff-only reconciliation. Add a
  five-minute paginated monitor scan and state-discovery/setup helper; both event and monitor paths
  reuse the same action logic.
creates:
  - scripts/symphony/ci-monitor.mjs
  - scripts/symphony/ci-monitor.test.mjs
  - scripts/symphony/setup-ci-monitor.mjs
  - scripts/symphony/setup-ci-monitor.test.mjs
edits:
  - .github/workflows/scripts/symphony-linear-wakeups.mjs
  - .github/workflows/scripts/symphony-linear-wakeups.test.mjs
  - scripts/cadence-linear-rework.mjs
  - scripts/cadence-linear-rework.test.mjs
  - scripts/linear-issue-wakeup.mjs
  - scripts/linear-issue-wakeup.test.mjs
owned_files:
  - scripts/symphony/ci-monitor.mjs
  - scripts/symphony/ci-monitor.test.mjs
  - scripts/symphony/setup-ci-monitor.mjs
  - scripts/symphony/setup-ci-monitor.test.mjs
  - .github/workflows/scripts/symphony-linear-wakeups.mjs
  - .github/workflows/scripts/symphony-linear-wakeups.test.mjs
  - scripts/cadence-linear-rework.mjs
  - scripts/cadence-linear-rework.test.mjs
  - scripts/linear-issue-wakeup.mjs
  - scripts/linear-issue-wakeup.test.mjs
owned_external_resources:
  - Fixture-only Linear/GitHub/clock endpoints and scan cursors; no live workflow/state/monitor
    mutations.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R08/R09/D05/D07/D08/O05: implement every ordinary-ticket and daemon verdict row in the
    execution contract; no implementation/test execution in monitor scans."
  - Persist head/generation/action and retry keys; re-read before mutation and read back afterward;
    duplicate/interleaved/terminal/backlog/blocked/changed-head cases cannot trigger unsafe or
    repeated work.
  - Deadlines distinguish runnable queue, child waits, running jobs and run budget; at most one safe
    retry, no concurrent stuck-run retry; partial scan/cursor, missing anchors and crash-history
    limits remain visible.
  - Setup discovers/reuses exact states and existing monitor issue IDs supplied by 100-8; dry-run
    first; no replacement monitor issues or upstream runtime/timer changes.
validation_commands:
  - node --test scripts/symphony/ci-monitor.test.mjs scripts/symphony/setup-ci-monitor.test.mjs
    scripts/cadence-linear-rework.test.mjs scripts/linear-issue-wakeup.test.mjs
    .github/workflows/scripts/symphony-linear-wakeups.test.mjs
  - npm run lint
delivery_notes:
  Estimate 750–1000 lines; async-pipeline-boundary. ROUTE owns workflow YAML; GUIDE
  owns host profiles; DEPLOY owns state setup and real timer proof. Helpers expose one reconcile
  action path to router/publisher and monitor.
dependencies:
  - item: APP
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Use landed App token APIs for monitor and bridge operations.
  - item: GATE
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Use landed predicates and durable generation evidence.
difficulty: hard
```

## ROUTE

```yaml
id: ROUTE
title: Wire App-owned Codex dispatch and human-only review handoff
repository: 1000lines/symphony-example
summary:
  Connect landed acquisition/assessment/publication and shared reconciliation to trusted
  controller workflows. Replace bot-review invitations with serialized queued checks and explicit
  dispatch, preserving one selected authority per PR generation.
creates: []
edits:
  - .github/workflows/cadence-ai-review-trigger.yml
  - .github/workflows/cadence-ai-review-events.yml
  - .github/workflows/cadence-ai-review.yml
  - .github/workflows/cadence-linear-rework.yml
  - .github/workflows/symphony-linear-wakeups.yml
  - .github/workflows/scripts/cadence-ai-review-route-event.mjs
  - .github/workflows/scripts/cadence-ai-review-route-event.test.mjs
  - .github/workflows/scripts/cadence-ai-review-events.test.mjs
  - .github/workflows/scripts/verify-cadence-ai-review.cjs
  - .github/workflows/scripts/request-pr-reviewer.mjs
  - .github/workflows/scripts/request-pr-reviewer.test.mjs
owned_files:
  - .github/workflows/cadence-ai-review-trigger.yml
  - .github/workflows/cadence-ai-review-events.yml
  - .github/workflows/cadence-ai-review.yml
  - .github/workflows/cadence-linear-rework.yml
  - .github/workflows/symphony-linear-wakeups.yml
  - .github/workflows/scripts/cadence-ai-review-route-event.mjs
  - .github/workflows/scripts/cadence-ai-review-route-event.test.mjs
  - .github/workflows/scripts/cadence-ai-review-events.test.mjs
  - .github/workflows/scripts/verify-cadence-ai-review.cjs
  - .github/workflows/scripts/request-pr-reviewer.mjs
  - .github/workflows/scripts/request-pr-reviewer.test.mjs
owned_external_resources:
  - Branch CI with mocked controller dispatch and publication; no live workflow mode, review or
    state mutation.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R01/R05/R08/R12/D01/D03/D04/D08: pinned Action/CLI/model with protected Environment; trusted
    main acquisition/publication, target-head checks, no signing/provider/Linear secrets in branch
    CI."
  - Complete human-feedback routing, force-push/full review, three-pass cap and human-grounded
    reset; same context coalesces; missing dispatch and abandoned checks remain recoverable.
  - Successful ordinary CI reaches shared reconciliation; orchestration/Cadence jobs never
    masquerade as required build CI; human requests only after gates or explicit human-needed/cap
    escalation.
  - Wire all consumers before enabling check mode; inventory/dismiss legacy bot approvals only at
    DEPLOY. Workflow enablement is an operator action there, not an assumption.
validation_commands:
  - node --test .github/workflows/scripts/cadence-ai-review-route-event.test.mjs
    .github/workflows/scripts/cadence-ai-review-events.test.mjs
    .github/workflows/scripts/request-pr-reviewer.test.mjs scripts/cadence-codex-review.test.mjs
    scripts/symphony/ci-monitor.test.mjs
  - npm run lint
delivery_notes:
  Estimate 800–1200 lines; shared-orchestrator-file. One coherent replacement owns all
  privileged workflow YAML; splitting their job credentials/events would obscure the security
  boundary. May exceed 1000 lines with reviewer-visible sections; no mechanical-copy exemption.
  RETIRE removes temporary legacy route after DEPLOY.
dependencies:
  - item: CODEX
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Wire landed acquisition/assessment/publication entry points.
  - item: WAIT
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Wire landed shared state/handoff reconciliation entry points.
integration_pattern:
  pattern: disabled_or_flagged_path
  seam_owner: "ROUTE: .github/workflows/cadence-ai-review-trigger.yml"
  seam_files:
    - .github/workflows/cadence-ai-review-trigger.yml
    - .github/workflows/cadence-ai-review-events.yml
    - .github/workflows/cadence-ai-review.yml
  marker: HACKATHON_LEGACY_REVIEW
  isolated_validation:
    node --test .github/workflows/scripts/cadence-ai-review-route-event.test.mjs
    .github/workflows/scripts/cadence-ai-review-events.test.mjs
    .github/workflows/scripts/request-pr-reviewer.test.mjs scripts/cadence-codex-review.test.mjs
    scripts/symphony/ci-monitor.test.mjs
  composed_validation: DEPLOY App/Codex/check/CI rehearsal on accepted main refs.
  finalize_item: RETIRE
  finalize_action: Remove legacy selector/path after replacement proof; preserve durable enabled opt-in.
finalization_responsibility: RETIRE removes HACKATHON_LEGACY_REVIEW from the listed seam_files; FINAL verifies absence.
difficulty: hard
```

## GUIDE

```yaml
id: GUIDE
title: Installable host profiles and current acceptance guidance
repository: 1000lines/symphony-example
summary:
  Wire App-aware clone/CLI hooks and target selection into the two host profiles, bundle the
  existing helpers, and configure the accepted daemon states. Update every standing acceptance
  consumer to describe the implemented CI/check contract and deployment prerequisites.
creates: []
edits:
  - WORKFLOW.md
  - scripts/symphony/runtime-bundle/workflow/WORKFLOW.md
  - scripts/symphony/runtime-bundle/codex/AGENTS.md
  - scripts/symphony/runtime-bundle/manifest.json
  - scripts/symphony/runtime-bundle/README.md
  - scripts/symphony/runtime-bundle/runtime-bundle.integration.test.mjs
  - scripts/symphony/host/hosted-runtime-integration.test.mjs
  - scripts/symphony/host/install.d/80-config.sh
  - README.md
  - docs/engineering/symphony/project-workflow.md
  - docs/engineering/symphony/tooling-setup.md
  - docs/engineering/symphony/proof-of-work.md
  - docs/engineering/review/README.md
  - docs/engineering/review/cadence-ai-review.md
  - docs/engineering/review/cadence-linear-workpad.md
  - docs/engineering/review/github-actor-classification.md
  - docs/engineering/review/review-agent-methodology.md
  - .agents/skills/symphony-project-factory/templates/tickets/plan-project.md
  - .agents/skills/symphony-project-factory/templates/tickets/trigger-fan-out.md
  - .agents/skills/symphony-project-factory/templates/tickets/standup.md
  - docs/symphony-plans/fan-out-plan-schema.md
  - .claude/skills/cadence-ai-review/SKILL.md
  - .claude/skills/cadence-ai-review/review-CLAUDE.md
  - .claude/skills/cadence-ai-review/references/acquisition.md
  - .claude/skills/cadence-ai-review/references/cross-pr-gap-review.md
  - .claude/skills/cadence-ai-review/references/linear.md
  - scripts/symphony/runtime-bundle/skills/symphony-finalize-project/SKILL.md
  - scripts/symphony/runtime-bundle/skills/symphony-proof-of-work/SKILL.md
owned_files:
  - WORKFLOW.md
  - scripts/symphony/runtime-bundle/workflow/WORKFLOW.md
  - scripts/symphony/runtime-bundle/codex/AGENTS.md
  - scripts/symphony/runtime-bundle/manifest.json
  - scripts/symphony/runtime-bundle/README.md
  - scripts/symphony/runtime-bundle/runtime-bundle.integration.test.mjs
  - scripts/symphony/host/hosted-runtime-integration.test.mjs
  - scripts/symphony/host/install.d/80-config.sh
  - README.md
  - docs/engineering/symphony/project-workflow.md
  - docs/engineering/symphony/tooling-setup.md
  - docs/engineering/symphony/proof-of-work.md
  - docs/engineering/review/README.md
  - docs/engineering/review/cadence-ai-review.md
  - docs/engineering/review/cadence-linear-workpad.md
  - docs/engineering/review/github-actor-classification.md
  - docs/engineering/review/review-agent-methodology.md
  - .agents/skills/symphony-project-factory/templates/tickets/plan-project.md
  - .agents/skills/symphony-project-factory/templates/tickets/trigger-fan-out.md
  - .agents/skills/symphony-project-factory/templates/tickets/standup.md
  - docs/symphony-plans/fan-out-plan-schema.md
  - .claude/skills/cadence-ai-review/SKILL.md
  - .claude/skills/cadence-ai-review/review-CLAUDE.md
  - .claude/skills/cadence-ai-review/references/acquisition.md
  - .claude/skills/cadence-ai-review/references/cross-pr-gap-review.md
  - .claude/skills/cadence-ai-review/references/linear.md
  - scripts/symphony/runtime-bundle/skills/symphony-finalize-project/SKILL.md
  - scripts/symphony/runtime-bundle/skills/symphony-proof-of-work/SKILL.md
owned_external_resources:
  - Local generated bundle/profile fixtures only; no host install, service restart or daemon
    activation.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R07/R09/R10/D03/D05/D07: Active/Evaluating dispatch, Happy/Unhappy resting, wake 15m and
    Evaluating concurrency 1; profile/setup tests exercise both mapped repositories."
  - Adopter README/AGENTS/CLAUDE/.github tool guidance allowed; local first, Docker only for
    environment gaps, current-head CI always; exact missing-admin handoff.
  - Prompt/templates/maturity/finalizer/proof wording uses both fresh predicates, ready status and
    severe-regression removal; no bot APPROVE requirement remains in active guidance.
  - Only acceptance wording changes in shared schema/templates; no fields, criteria, renderer or
    generic planning-process change. Mark actual deployment separately from source availability.
validation_commands:
  - node --test scripts/symphony/runtime-bundle/runtime-bundle.integration.test.mjs
    scripts/symphony/host/hosted-runtime-integration.test.mjs
  - npx prettier --check WORKFLOW.md scripts/symphony/runtime-bundle/workflow/WORKFLOW.md
    docs/engineering/review docs/engineering/symphony/project-workflow.md
delivery_notes:
  Estimate 450–800 changed lines; ticket-template-contract. Own prose and profile
  wiring after ROUTE behavior lands. Read-only sweep of
  APPROVE/APPROVED/reviewDecision/staleApproval/CADENCE_REVIEWER/cadence-loop/mature classifies
  history and tests; ownership gaps require plan amendment, not unlisted edits. DEPLOY installs
  accepted refs.
dependencies:
  - item: ROUTE
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Describe and bundle implemented routing behavior, not an invented future interface.
difficulty: hard
```
