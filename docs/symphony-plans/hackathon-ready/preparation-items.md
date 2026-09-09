# Hackathon readiness: preparation items

These are the required item fields for the identically named nodes in the
[100-7 plan](../fan-out-plan-100-7-hackathon-ready.md). Copy fields verbatim into
tickets, together with their manifest branch/PR/state policy and the
[common execution contract](execution-contract.md). Paths are relative to the
item's repository unless qualified. No new shared schema is defined here.

## CI

```yaml
id: CI
title: Bootstrap CI for every controller change
repository: 1000lines/symphony-example
summary:
  Add the adopter caller for every push and PR, including draft/docs changes. Pass explicit
  tested-ref through all reusable jobs and record actual child/aggregator results.
creates:
  - .github/workflows/ci.yml
  - .github/README.md
edits:
  - .github/workflows/symphony-build.yml
  - .github/workflows/symphony-lint.yml
  - .github/workflows/symphony-test.yml
owned_files:
  - .github/workflows/ci.yml
  - .github/README.md
  - .github/workflows/symphony-build.yml
  - .github/workflows/symphony-lint.yml
  - .github/workflows/symphony-test.yml
owned_external_resources:
  - Controller Actions runs on this task branch; no workflow enable/disable or branch-rule
    administration.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R06/R07/D06/O04: build, lint, test and changed-Markdown jobs run; always-running CI Required
    fails if any expected child does not succeed."
  - Leaf/Markdown timeout 20m, aggregator 5m; read-only credentials, no privileged secrets; exact
    head evidence on branch and merged main.
  - Observe CI Required name, Actions App ID and workflow provenance; report baseline test failures
    without suppressing checks.
validation_commands:
  - npm run build
  - npm run lint
  - npm test
  - npx prettier --check .github/workflows/ci.yml .github/README.md
  - gh run list --repo 1000lines/symphony-example --commit <published-head>
delivery_notes:
  "Estimate 200–400 lines; validation-surface/default-branch-dispatch-prerequisite.
  Existing identity bootstraps CI before APP/GATE. Commands with placeholders use observed refs. No
  unrelated suite repairs: report any blocking baseline failure."
dependencies: []
difficulty: hard
```

## APP

```yaml
id: APP
title: Add renewable App credentials and explicit actor identities
repository: 1000lines/symphony-example
summary:
  Implement installation-token acquisition and renewal for Git askpass, gh wrappers and
  direct API clients. Replace required PAT/user-prefix and org-team assumptions with configured App
  IDs and explicit human mapping; retain the working deployment until DEPLOY.
creates:
  - scripts/symphony/github-app-auth.mjs
  - scripts/symphony/github-app-auth.test.mjs
  - scripts/symphony/github-app-exec.sh
edits:
  - scripts/symphony/setup-local-env.sh
  - scripts/symphony/setup-local-env.test.mjs
  - scripts/symphony/host/install.d/40-credentials.sh
  - scripts/symphony/host/lib.sh
  - scripts/symphony/host/lib.test.mjs
  - scripts/symphony/host/templates/symphony.service
  - scripts/symphony/ensure-pr-labels.mjs
  - scripts/symphony/host/ensure-pr-labels.test.mjs
  - scripts/github-actor-classification.mjs
  - scripts/github-actor-classification.test.mjs
owned_files:
  - scripts/symphony/github-app-auth.mjs
  - scripts/symphony/github-app-auth.test.mjs
  - scripts/symphony/github-app-exec.sh
  - scripts/symphony/setup-local-env.sh
  - scripts/symphony/setup-local-env.test.mjs
  - scripts/symphony/host/install.d/40-credentials.sh
  - scripts/symphony/host/lib.sh
  - scripts/symphony/host/lib.test.mjs
  - scripts/symphony/host/templates/symphony.service
  - scripts/symphony/ensure-pr-labels.mjs
  - scripts/symphony/host/ensure-pr-labels.test.mjs
  - scripts/github-actor-classification.mjs
  - scripts/github-actor-classification.test.mjs
owned_external_resources:
  - Only mocked App/Secrets Manager endpoints and per-test credential caches; no live host, secret
    or App mutation.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R03/R04/D02: exact-repository/permission tokens; refresh five minutes before one-hour expiry;
    serialized refresh and one expiry retry after write readback."
  - Expired/revoked/suspended/unselected/denied grants fail closed without PAT fallback; no secrets
    in URLs/logs; long-lived worker clients obtain fresh tokens.
  - Materializer supports App mode without GITHUB_TOKEN; provider/Linear fields remain preserved;
    both actor identities and numeric issue label helper work.
validation_commands:
  - node --test scripts/symphony/github-app-auth.test.mjs scripts/symphony/setup-local-env.test.mjs
    scripts/symphony/host/ensure-pr-labels.test.mjs scripts/github-actor-classification.test.mjs
    scripts/symphony/host/lib.test.mjs
  - bash -n scripts/symphony/github-app-exec.sh scripts/symphony/host/install.d/40-credentials.sh
  - npm run lint
delivery_notes:
  Estimate 700–950 lines; credential-boundary. Exports getInstallationToken and an
  execution wrapper for later CODEX/WAIT/ROUTE; INSTALL uses its preflight. Runtime source
  unchanged. RETIRE owns explicit legacy-mode removal after live proof.
dependencies:
  - item: CI
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Controller CI caller accepted on main before credential integration can satisfy mandatory CI.
integration_pattern:
  pattern: disabled_or_flagged_path
  seam_owner: "APP: scripts/symphony/setup-local-env.sh"
  seam_files:
    - scripts/symphony/setup-local-env.sh
    - scripts/symphony/host/install.d/40-credentials.sh
  marker: HACKATHON_LEGACY_AUTH
  isolated_validation: node --test scripts/symphony/github-app-auth.test.mjs
    scripts/symphony/setup-local-env.test.mjs scripts/symphony/host/ensure-pr-labels.test.mjs
    scripts/github-actor-classification.test.mjs scripts/symphony/host/lib.test.mjs
  composed_validation: DEPLOY App/Codex/check/CI rehearsal on accepted main refs.
  finalize_item: RETIRE
  finalize_action: Remove legacy selector/path after replacement proof; preserve durable enabled opt-in.
finalization_responsibility: RETIRE removes HACKATHON_LEGACY_AUTH from the listed seam_files; FINAL verifies absence.
difficulty: hard
```

## GATE

```yaml
id: GATE
title: Define trusted repository mapping and fresh acceptance predicates
repository: 1000lines/symphony-example
summary:
  Provide one trusted mapping and shared ci_passes/ai_accepts interpretation. Persist review
  generations and complete human-feedback watermarks while preserving requirement/finding history.
creates:
  - .github/symphony/repositories.yml
  - scripts/symphony/review-contract.mjs
  - scripts/symphony/review-contract.test.mjs
edits:
  - scripts/fetch-pr-review-state.mjs
  - scripts/fetch-pr-review-state.test.mjs
  - scripts/cadence-linear-workpad.mjs
  - scripts/cadence-linear-workpad.test.mjs
owned_files:
  - .github/symphony/repositories.yml
  - scripts/symphony/review-contract.mjs
  - scripts/symphony/review-contract.test.mjs
  - scripts/fetch-pr-review-state.mjs
  - scripts/fetch-pr-review-state.test.mjs
  - scripts/cadence-linear-workpad.mjs
  - scripts/cadence-linear-workpad.test.mjs
owned_external_resources:
  - Fixture-only API records; controller mapping file is authoritative but target entries remain
    disabled until DEPLOY.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R05/R06/R12/D03/D05/D11: numeric target authorization, owner/name, per-owner installations,
    project/issue association and config revision validated before action."
  - CI requires nonempty exact name/App/workflow/event/head allowlist and latest attempt; AI
    requires Cadence 4866513, Cadence Review, current head/generation, valid output and durable
    workpad.
  - Wrong App/workflow/target, stale head/attempt, same-head new feedback, missing sources/workpad,
    skipped/neutral/unknown results never pass; paginate reviews/comments/threads and exclude
    generated bookkeeping.
validation_commands:
  - node --test scripts/symphony/review-contract.test.mjs scripts/fetch-pr-review-state.test.mjs
    scripts/cadence-linear-workpad.test.mjs
  - npm run lint
delivery_notes:
  Estimate 700–950 lines; durable-data-contract. Exports evaluateCi, evaluateAi,
  resolveTarget and review-generation data. CODEX/WAIT import landed exports. DEPLOY alone
  fills/activates mapping after setup; RETIRE removes the temporary legacy review mode.
dependencies:
  - item: CI
    type: hard
    requires: Accepted result; repository changes merged to the owning repository main.
    reason: Controller CI caller accepted on main before shared gate integration can satisfy mandatory CI.
integration_pattern:
  pattern: disabled_or_flagged_path
  seam_owner: "GATE: .github/symphony/repositories.yml"
  seam_files:
    - .github/symphony/repositories.yml
  marker: HACKATHON_LEGACY_REVIEW
  isolated_validation: node --test scripts/symphony/review-contract.test.mjs
    scripts/fetch-pr-review-state.test.mjs scripts/cadence-linear-workpad.test.mjs
  composed_validation: DEPLOY App/Codex/check/CI rehearsal on accepted main refs.
  finalize_item: RETIRE
  finalize_action: Remove legacy selector/path after replacement proof; preserve durable enabled opt-in.
finalization_responsibility: RETIRE removes HACKATHON_LEGACY_REVIEW from the listed seam_files; FINAL verifies absence.
difficulty: hard
```

## RUST

```yaml
id: RUST
title: Make selected Rust CI prove the explicit PR head
repository: jeremycarroll/venn-search-rs
summary:
  Adapt existing venn-search-rs CI to check out the PR head and declare 60-minute job
  timeouts. Document existing local/container/CI commands without changing application behavior.
creates:
  - .github/README.md
edits:
  - .github/workflows/ci.yml
owned_files:
  - .github/README.md
  - .github/workflows/ci.yml
owned_external_resources:
  - jeremycarroll/venn-search-rs task branch/PR and ordinary CI only; no installation/protection
    changes.
source_notes:
  - Read the accepted design at dc71026c35b7fc97f58e54cd03ce7fe513621e1f and execution-contract.md;
    requirement IDs below define scope.
exclusions:
  - Unlisted files/resources; unrelated product work; downstream ticket creation.
acceptance_checks:
  - "R06/R07/R12/O03/O04: all six accepted Rust checks test explicit head, including documentation
    changes; preserve ncolors_3 through ncolors_6 tests/doc tests, strict Clippy and formatting."
  - Read target README, CLAUDE.md and workflow/toolchain guidance; collect actual
    name/App/workflow/job/run/head evidence; no controller secrets in target.
validation_commands:
  - cargo build --release
  - cargo test --release --features ncolors_3
  - cargo test --release --features ncolors_4
  - cargo test --release --features ncolors_5
  - cargo test --release --features ncolors_6
  - cargo clippy --all-targets -- -D warnings
  - cargo clippy --all-targets --features ncolors_5 -- -D warnings
  - cargo fmt --all -- --check
delivery_notes:
  Estimate 80–160 lines; package-boundary. Owns paths in the Rust repository only. No
  dependency on controller CI because target CI already exists. Local pass skips Docker; missing
  Rust uses the contract container fallback. DEPLOY owns later App-authored rehearsal.
dependencies: []
difficulty: easy
```
