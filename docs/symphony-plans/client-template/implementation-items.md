# Client template implementation items

Part of [100-39's plan](../fan-out-plan-100-39-client-template.md). Every item
inherits its ticket execution contract, labels, main/main branching and evidence
requirements. Paths below are relative to `1000lines/symphony-example`.
Estimated sizes and difficulties are in the main plan. No item creates live
participant projects or operates the parent rehearsal.

[Jeremy's September 11 PR #42 review](https://github.com/1000lines/symphony-example/pull/42#discussion_r3991277811)
adds the required `cadence_reviewer` choice (`claude`/`codex`) to D4 and replaces
key-presence selection in D6. CT-Q owns the answer and synthetic render tests;
CT-R retains provider input/selection, CT-T carries the value, CT-L verifies the
complete caller/callee contract, and CT-O/U/F/A consume it. Existing nodes,
hard edges and implementation file ownership remain unchanged. CT-Q also owns
these small plan/acceptance updates and the primary-source provenance credit.
The native App-identity checkpoint merged in PR #43 does not prove the remaining
CT-R provider interface: CT-L must verify the actual merged artifact before
claiming integration, regardless of 100-49's terminal Linear state.

## CT-I — Inventory client files and justify export lists

- **Scope:** establish the smallest client tree and separately reviewed export
  lists before copying. This is selection work, not a second design exercise.
- **owned_files:** `docs/symphony-plans/client-template/client-inventory.md`,
  `docs/symphony-plans/client-template/client-copy.txt`,
  `docs/symphony-plans/client-template/review-export.txt`,
  `docs/symphony-plans/client-template/ci-export.txt` (new).
- **owned_external_resources:** none beyond this task's branch/PR. Existing
  repositories, App permissions and source refs are read-only inputs.
- **creates:** all four owned inventory files. **edits:** none.
- **dependencies:** none. Read 100-43's available PR for context; do not copy it.
- **source_files:** merged `client-template-design.md`; `.github/workflows/AGENTS.md`;
  native ingress, event, trigger, manual review, handoff and wakeup workflows;
  merged 100-43 `.github/workflows/cadence-review-check-cleanup.yml`;
  their directly/transitively imported helpers; config reader and license.
- **required_actions:** map each D1 artifact to a generated path and reason;
  enumerate existing target collisions, source-only files and exclusions.
  Name every source path needed by review and CI reusable entry points in the
  two newline-separated lists, including instructions, tests, package dependencies
  and license attribution. Identify planned new paths in CT-C/R; expand imports
  rather than copying the tooling package or dormant controller wholesale.
  The inventory names source-to-template mappings and publication CI assets,
  and the same generated client paths CT-U will instantiate at the published
  repository root. Keep that root's own workflows/instructions/config separate
  from `template/`; only `template/` is participant output.
  `client-copy.txt` fixes an existing, reviewed source SHA and every source →
  `templates/symphony-client/template/` destination, with file mode/hash. It
  includes only existing nonsecret files; new Copier metadata belongs to CT-Q,
  and later Docker/Codex additions are listed separately, never invented copies.
  Specify which copied files can be converted immediately and which raw workflow
  bodies must be omitted until CT-L adds their thin reusable callers. Include
  `.github/workflows/symphony-client-review-cleanup.yml` as a local native
  `workflow_run` listener: it must match generated caller workflow names. CT-R
  exposes its body as reusable cleanup; CT-L renders the App-only caller. Do
  not assume extracting the body moves a native event listener into clients.
- **acceptance_checks:** every proposed client file is local for a concrete
  reason; no host/secret/application payload or reusable body is rendered. Review
  and CI export lists are disjoint, except explicitly read-only/common files
  assigned to the review list once. CT-C/R own subsequent edits to their own list.
  License/source refs and maintained-Action pin verification are assigned.
- **Validation, in order:** local locked Prettier on the inventory and
  `git diff --check`; `git ls-tree`/`rg` checks each existing source path/import
  against the selected ref (planned paths explicitly distinguished). Docker:
  skip on local pass; if Node is absent use a digest-pinned Node 20 container
  with the workspace mount/UID policy from the main plan. Mandatory seed CI,
  including Changed Markdown and CI Required, on this docs-only PR's head.
- **delivery_notes / exclusions:** hand the frozen `client-copy.txt` to CT-M and `client-inventory.md` to CT-T,
  `review-export.txt` to CT-R and `ci-export.txt` to CT-C only after merge. Do not
  implement workflows, create a validator or mutate repository/App settings.
- **split_criteria:** `risk-blast-radius`, `external-system-boundary`.

## CT-C — Support portable config and native/Docker/remote CI

- **Scope:** make existing config readers/instructions and the existing CI bridge
  meet D4/D8 without repository project binding or a new controller. Supply a
  small secret-free reusable command runner for clients lacking application CI.
- **owned_files:**
  `scripts/symphony/runtime-bundle/skills/symphony-repository/scripts/config.mjs`,
  `scripts/symphony/runtime-bundle/skills/symphony-repository/references/config.md`,
  `scripts/symphony/runtime-bundle/skills/symphony-repository/SKILL.md`,
  `scripts/symphony/runtime-bundle/workflow/WORKFLOW.md`,
  `scripts/symphony/runtime-bundle/codex/AGENTS.md`,
  `scripts/symphony/repository-config.test.mjs`,
  `scripts/symphony/workflow.test.mjs`,
  `.github/workflows/symphony-linear-wakeups.yml`,
  `.github/workflows/scripts/symphony-linear-wakeups.mjs`,
  `.github/workflows/scripts/symphony-linear-wakeups.test.mjs`,
  `.github/workflows/symphony-client-commands.yml` (new),
  `.github/workflows/scripts/symphony-client-commands.test.mjs` (new),
  `docs/symphony-plans/client-template/ci-export.txt`,
  `docs/engineering/symphony/tooling-setup.md` (mode/config instructions,
  including existing setup sentences invalidated by this compatibility change).
- **owned_external_resources:** task-local fixture directories, Docker image
  `client-template-ci-${issue}` and task containers. No live provider, seed
  secret, branch-rule or Linear state mutation; CT-A owns integrated live proof.
- **creates:** `.github/workflows/symphony-client-commands.yml` and
  `.github/workflows/scripts/symphony-client-commands.test.mjs`.
  **edits:** every other path in this item's owned_files list.
- **dependencies:** CT-I, hard, requires its merged inventory/export list;
  reason: CT-C edits that exact list and implements the selected CI boundary.
- **source_files:** all owned existing files; read-only
  `scripts/linear-issue-wakeup.mjs`, its tests, `.symphony.cfg.json`, and
  `scripts/symphony/review-contract.mjs` for current CI provenance expectations.
- **required_actions:** allow only optional `ci.mode: native|docker|remote` in
  the current reader; old configs retain native-first behavior. Preserve
  `ci.requiredChecks` with name/workflow/App provenance and `linear.teamKey`
  alone. Use existing command arrays: correctly serialized `bash -lc` commands;
  Docker commands build the client-supplied Dockerfile and run its commands.
  Update operative worker guidance through the existing bundle path so remote
  runs available checks and publishes despite unavailable toolchains. Do not
  rebuild the host or make Docker a remote prerequisite.
  Expose `symphony-linear-wakeups.yml` through `workflow_call` with explicit
  target/event inputs and only `CADENCE_LINEAR_API_TOKEN`, preserving its existing
  native triggers until CT-A replaces them. CT-L/V consume this callable entry;
  CT-V only copies it and must not discover an unowned conversion.
  Replace the wakeup's hardcoded `CI`/`ci.yml` success lookup with the target's
  observed required-check contract; accept configured workflow completions and
  current-head failure/success appropriately. Preserve actual emitting App and
  workflow provenance, incomplete/missing/pending check waits, terminal-state
  protection, issue/team resolution, races and the timer fallback. The advisory
  Cadence check stays outside this evaluator. Retain old seed entry points.
- **acceptance_checks:** existing config unchanged when mode omitted; invalid
  mode and repository project key rejected; two issue/project contexts share
  one config. Native and client-Dockerfile commands execute in isolated fixtures.
  Remote missing-tool case records a limitation and reaches publication handoff;
  known failed assertions do not get waived. Tests include non-main default
  branch, differently named CI/workflow path, multiple required checks, generic
  completion events, failed→Active, passed→Inactive, stale/terminal rejection;
  test native and reusable wakeup dispatch with the same identity/CI contract.
  CI executes the exact head without review credentials or a Node package
  requirement on application clients. Update `ci-export.txt` to actual paths.
- **Validation, in order:** local
  `node --test scripts/symphony/repository-config.test.mjs scripts/symphony/workflow.test.mjs .github/workflows/scripts/symphony-linear-wakeups.test.mjs .github/workflows/scripts/symphony-client-commands.test.mjs`;
  locked formatting and supplied native fixture build/test. Run the required
  Docker-mode acceptance fixture once using its client Dockerfile, `docker build
-t client-template-ci-${issue} <fixture>`, then `docker run --rm --user
<uid>:<gid> --mount type=bind,src=<issue-workspace>,dst=/workspace --workdir
/workspace <recorded-image-digest> <fixture-command>`. This Docker execution
  tests the requested mode; it is not redundant fallback testing. For other
  local passes record Docker fallback skipped. Mandatory seed CI plus actual
  command-runner check on the published head; future integrated remote state
  proof remains explicitly CT-A's gate.
- **delivery_notes:** CT-L consumes merged reader/runner and owns final template CI
  registration; CT-A owns installed-reader readback and live mode proof before
  activation. A missing host rollout grant blocks that activation only. CT-C
  and CT-R share no writable files or external test targets; common wakeup/Linear
  helpers are read-only here. An unexpected required shared edit amends ownership
  before implementation. No central repository list, project filter, new
  validator, provider code or environment-secret change.
- **split_criteria:** `workflow-boundary`, `shared-orchestrator-file`.

## CT-R — Make native review reusable with explicit secrets and Codex

[Jeremy's September 11, 15:51 UTC instruction on PR #43](https://github.com/1000lines/symphony-example/pull/43#issuecomment-5637041350)
authorizes the native App-identity correction now in CT-R, before resolving the
broader export/initial-proof prerequisites below. Repository admin authority was
verified. This checkpoint also owns the Claude skill's identity preflight in
`.claude/skills/cadence-ai-review/SKILL.md`, the legacy-actor exclusion in
`scripts/cadence-linear-rework.mjs`, and their supporting regression coverage.
Verify that publication, outcome checks, advisory results and handoff use the
minted App identity without a legacy PAT. Keep this node/PR and the remaining
explicit-secret, provider and live-proof requirements open; no dependency edge
is changed by this limited instruction.

- **Scope:** expose existing native review/handoff as reusable workflows with
  explicit target inputs/secrets, add explicitly selected Codex/Claude execution, and prove
  the early real review in the seed. Retain the working Claude-only path.
- **owned_files:** `.github/workflows/cadence-ai-review-events.yml`,
  `.github/workflows/cadence-ai-review-trigger.yml`,
  `.github/workflows/cadence-ai-review.yml`,
  `.github/workflows/cadence-linear-rework.yml`,
  `.github/workflows/cadence-review-check-cleanup.yml` (from 100-43),
  `.github/workflows/scripts/cadence-ai-review-route-event.mjs`,
  `.github/workflows/scripts/cadence-ai-review-route-event.test.mjs`,
  `.github/workflows/scripts/cadence-ai-review-events.test.mjs`,
  `.github/workflows/scripts/cadence-forwarded-event.mjs`,
  `.github/workflows/scripts/cadence-forwarded-event.test.mjs`,
  `.github/workflows/scripts/verify-cadence-ai-review.cjs`,
  `.github/workflows/scripts/cadence-review-check.mjs`,
  `.github/workflows/scripts/cadence-review-check.test.mjs` (from 100-43),
  `scripts/cadence-provider-result.mjs`,
  `scripts/cadence-provider-result.test.mjs` (new small result adapter/tests),
  `.github/symphony/cadence-provider-review.md` (new common provider instructions),
  `docs/engineering/review/cadence-ai-review.md`,
  `docs/symphony-plans/client-template/review-export.txt`,
  `docs/symphony-plans/client-template/early-review-evidence.md` (new).
- **owned_external_resources:** seed Actions variables/named review secrets and
  existing `cadence-controller` configuration only as needed for explicit
  delivery, provisioned by Jeremy; one task-linked seed proof PR and its review
  runs/checks/Cadence workpad; target-scoped App publication and permission-read
  APIs. CT-C operates only local fixtures. CT-A later takes seed live-proof
  ownership after CT-R is complete. Keys never enter the repository or evidence.
- **creates:** `scripts/cadence-provider-result.mjs`,
  `scripts/cadence-provider-result.test.mjs`,
  `.github/symphony/cadence-provider-review.md`,
  `docs/symphony-plans/client-template/early-review-evidence.md`.
  **edits:** every other path in this item's owned_files list, after 100-43 lands.
- **dependencies:** CT-I, hard, merged `review-export.txt`; 100-43, hard, its
  human-reviewed merge to main and required initial advisory/readiness proof.
  Reasons: editing the selected export and the same native publication files.
  Do not duplicate 100-43, change its project/labels or copy its unmerged branch.
- **source_files:** all owned existing files; read native ingress, existing
  feedback/workpad/permission helpers, `scripts/symphony/review-contract.mjs`,
  its `cadence-review/v1` schema/ledger tests and Claude skill; read dormant Codex source
  only to understand historical constraints, not to revive its controller.
- **required_actions:** declare `workflow_call` inputs for repository/default
  branch, identity, `cadence_reviewer` and discovered App IDs; caller config/source and pinned trusted
  workflow/helper checkouts stay separate. Explicitly declare/map
  `CADENCE_APP_PRIVATE_KEY`, `CADENCE_LINEAR_API_TOKEN`, optional
  `CADENCE_OPENAI_API_KEY`, optional `CADENCE_AI_REVIEW_ANTHROPIC_API_KEY`.
  Handoff gets only App/Linear. Remove the adopter requirement for legacy bot PAT;
  both providers publish with the configured App. No generated/onward cross-repo
  `inherit`. Use native jobs/maintained Actions and a small provider adapter
  into the existing `cadence-review/v1`/workpad ledger contract. D6's small
  provider result does not replace that schema: preserve `requirements`,
  `findings`, `humanFeedback`, stable IDs, mandatory dispositions and requirement
  coverage through publication; trusted code supplies identity/provenance.
  Expose advisory cleanup via `workflow_call` with target/run inputs and App key
  only, retaining its seed native listener until migration. The generated local
  listener owns `workflow_run` names/triggers; no new secret or opt-in.
  Honor `cadence_reviewer` (`claude`/`codex`), including with both keys present;
  invalid/missing selection or a missing matching key fails before review, and
  API failure never selects another provider. Reuse the existing review ledger and
  APPROVE/COMMENT publication; no GitHub REQUEST_CHANGES.
  Preserve 100-43's App-owned actual-head queue/run/result, same-head feedback
  freshness, safe overlap/cancellation/closure and draft-ready behavior for both
  providers. Preserve authorization, full source reads, loop cap and terminal
  guards. Replace main/repository assumptions with trusted target values; do not
  run PR-controlled code with privileged secrets or widen environment eligibility
  to unreviewed refs. Keep native/manual compatibility entry points working.
- **acceptance_checks:** both reviewer choices across all four key combinations,
  missing/invalid selections, and malformed/stale/missing
  output tested; one provider runs; both use the same verdict/handoff contract.
  Include carried-forward mandatory human feedback and unmet requirements so
  a provider adapter cannot silently lose them or incorrectly permit approval.
  Boundary tests cover explicit secrets at every hop and no CI/ingress leakage.
  After human merge/trusted enablement, a real seed PR gets a Codex App-authored
  review, workpad, actual-head advisory result and appropriate readiness. Record
  workflow source SHA, caller/head, App, provider, run/review links and secret-name
  delivery without values. This early run does not replace CT-A's migrated proof.
- **Validation, in order:** local
  `node --test scripts/cadence-provider-result.test.mjs .github/workflows/scripts/cadence-ai-review-events.test.mjs .github/workflows/scripts/cadence-ai-review-route-event.test.mjs .github/workflows/scripts/cadence-forwarded-event.test.mjs .github/workflows/scripts/cadence-review-check.test.mjs`;
  locked formatting, YAML/explicit-boundary inspection and affected existing
  feedback tests. Docker fallback skipped on local pass, otherwise digest-pinned
  Node 20 with workspace/UID policy. Mandatory seed CI at the published head.
  Real provider/advisory proof requires trusted merged code; publish the draft
  and exact Jeremy dispatch/secret action first if unavailable, then keep this
  delivery open until evidence arrives. No source-only live-proof claim.
- **delivery_notes / exclusions:** one owner for native review behavior;
  CT-V copies the final reviewed export list later. Do not edit CT-C's config,
  wakeup or command-runner files; no custom queue/controller, new secret name,
  extra question beyond CT-Q's reviewer choice, blanket workflow deletion or public-fork key service.
- **split_criteria:** `automation-identity-boundary`, `async-pipeline-boundary`.

## CT-Q — Define and test the eight Copier answers

- **Scope:** build the ordinary Copier question/answers package independently
  of file inventory, copying, Docker compatibility and provider implementation.
- **owned_files:** `templates/symphony-client/copier.yml`, `README.md`, `LICENSE`,
  `PROVENANCE.md`, `tests/requirements.txt`, `tests/test_answers.py`, and
  `.github/workflows/ci.yml`, `.prettierignore` under that staging root;
  seed `.prettierignore` (only the raw staging-template exclusion);
  `.github/workflows/client-template-test.yml` at the seed root.
- **owned_external_resources:** task-local temporary Copier fixture directories
  and its seed PR/checks only. No live secrets, App/repo/project writes.
- **creates:** all owned staging files and the seed template-test workflow.
  **edits:** seed `.prettierignore`, preserving existing exclusions.
- **dependencies:** none. D4 already fixes the answer interface; CT-I's file
  selection is unnecessary to ask and serialize those answers.
- **source_files:** merged design D4 and ordinary Copier configuration guidance.
- **required_actions:** `_subdirectory: template`; exactly `repo_slug`,
  `default_branch`, `linear_team_key`, `symphony_app_slug`, `cadence_app_slug`,
  `cadence_reviewer`, `build_command`, `test_command`. The reviewer is a required
  string choice (`claude` or `codex`) without a default. Keep defaults/types and
  source/ref metadata ordinary Copier. No credentials, project binding, mode/ref
  question or additional provider setting.
  Fix `_envops` now: `variable_start_string: "[["`, `variable_end_string: "]]"`,
  `block_start_string: "[%"`, `block_end_string: "%]"`; preserve trailing newlines.
  Use these delimiters for all Copier substitutions, including answer metadata,
  so native `${{ ... }}` GitHub expressions pass through unchanged. CT-T/L must
  consume this syntax; do not defer the choice or use per-file raw-block wrapping.
  Pin the Python/Copier requirements. Build tests in a task-local minimal
  `template/` fixture so CI exercises the questions even before CT-M/T land.
  Root CI discovers the package tests; the seed caller uses the same command.
  Ordinary root lint/format checks exclude raw `template/` (and the seed's
  `templates/symphony-client/template/`); use normal ignore files/explicit paths.
  Keep test discovery outside raw templates, but always run dedicated render
  tests, including when only a template changes; inspect rendered workflows and
  config, never treat excluding raw syntax as permission to skip those tests.
  Record the interim package's limited scope and the later CT-L release gate.
- **acceptance_checks:** eight answers, including both reviewer choices, work
  noninteractively for two repo slugs; missing/invalid reviewer choices fail.
  Retain coverage of
  non-main branches, teams and commands with quotes/newlines; ordinary answer
  metadata retains `_src_path`/`_commit` without secrets. No writes inside the
  committed `template/` tree, no CI registration or claim of live client behavior.
  A fixture containing both `[[ repo_slug ]]` and `${{ secrets.CADENCE_APP_PRIVATE_KEY }}`
  substitutes only the Copier value. Root-only sentinel workflows/config/docs
  never appear in output; test with `_subdirectory` and the fixed delimiters.
- **Validation, in order:** local install of pinned `tests/requirements.txt`,
  `python -m unittest discover -s templates/symphony-client/tests`, actual
  `copier copy` into temporary fixtures and locked formatting/diff checks.
  Docker skipped on pass; otherwise digest-pinned Python 3.12 with Git, the same
  requirements/command and workspace UID/mount policy. Mandatory seed CI and
  `client-template-test.yml` at the published head; record actual emitted checks.
- **delivery_notes / exclusions:** CT-Q can run with CT-I/M/C/R: it owns package
  metadata and question tests, CT-M owns only copied `template/` files. CT-T
  consumes the accepted question interface; CT-L later registers final CI.
  No Copier hooks/update or late workflow integration; CT-M owns the selected
  client-session skill copies and CT-T owns their conversion.
- **split_criteria:** `ticket-template-contract`, `risk-blast-radius`.

## CT-M — Copy every listed client file without changes

- **Scope:** a separate, mechanically verifiable PR copies the complete CT-I
  list into staging before any template conversion, including the authorized
  list correction described below.
- **owned_files:** exactly the `templates/symphony-client/template/` destination
  paths in `client-copy.txt`. For Jeremy's [PR #44 correction](https://github.com/1000lines/symphony-example/pull/44#issuecomment-5638514034),
  also `docs/symphony-plans/client-template/{client-copy.txt,ci-export.txt,client-inventory.md}`
  and the affected plan/design/item notes; no package metadata.
- **owned_external_resources:** task-local immutable source export and its own
  branch/PR. No Actions/secret/repository settings or participant operations.
- **creates:** every listed destination (22 files after the correction).
  **edits:** the two lists, inventory and affected plan/design/item notes above.
  **deletes:** none; remove the fourteen mistaken CI memberships, not source files.
- **dependencies:** CT-I, hard, accepted source/path/hash list. No CT-Q/C/R gate.
- **source_files:** every exact source path/ref in CT-I's merged copy list plus
  the fourteen skill/resource paths selected in merged #46 and corrected by Jeremy.
  Keep all rows pinned to `d5e9692b84c3f338014b964fd9713143fb723b55`.
- **required_actions:** use ordinary Git/copy tools to copy all listed bytes and
  modes, including dotfiles. First move exactly the fourteen #46 skill/resource
  entries from CI export into client-copy, with explicit mode/blob/destination
  rows retaining their relative paths. Reconcile the inventory and downstream
  delivery notes in this PR; this human-authorized correction supersedes the
  earlier inventory-edit exclusion. No other selection, substitutions, redaction, formatting,
  thin-wrapper rewrite or new helper hidden in this PR. An invalid/sensitive
  entry returns to inventory review before copying. Source commits are read as
  data; do not merge or cherry-pick their history into the task branch.
- **acceptance_checks:** destination path set equals the list; `cmp` and Git
  mode/hash readbacks match every entry at its pinned source. Any size is
  justified solely by copying the whole reviewed list. Raw workflow copies are
  inert under staging and are not a usable/generated client release.
- **Validation, in order:** local `git ls-tree` and `git show <source-sha>:<path>`
  comparison, `cmp` per listed destination and `git diff --check`; Docker skipped
  on local pass, otherwise digest-pinned Git-capable image with workspace policy.
  Mandatory seed CI on this copy-only head, including Changed Markdown for copied
  Markdown. Do not silently reformat a byte mismatch to fix CI; prepare the
  source correction and refreshed list for review before recopying if needed.
- **delivery_notes / exclusions:** relinquish the copied tree to CT-T after
  acceptance. CT-Q uses disjoint package files and temporary test fixtures.
  Byte comparison includes native `${{ ... }}` expressions unchanged. CT-M
  introduces no Copier placeholders and does no instantiation; CT-Q/T own the
  delimiter/render checks, preserving this PR's mechanically exact-copy scope.
  No template syntax, new behavior, credentials or live review proof here.
- **split_criteria:** `risk-blast-radius`, `ticket-template-contract`.

## CT-T — Convert the copied files into the initial template

- **Scope:** a behavioral PR after the straight copy introduces template syntax
  and a testable initial generated tree, independently of CT-C/R completion.
- **owned_files:** CT-M's copied `templates/symphony-client/template/` paths;
  `templates/symphony-client/tests/test_render.py` (new);
  `templates/symphony-client/README.md`, `PROVENANCE.md`;
  `docs/symphony-plans/client-template/client-inventory.md` (conversion readback).
- **owned_external_resources:** task-local render fixtures and its PR/checks;
  no shared secret, App, repository or live-project writes.
- **creates:** `tests/test_render.py` under staging and any new generated paths
  explicitly approved by CT-I for the initial conversion.
  **edits:** copied generated paths, owned README/PROVENANCE/inventory.
  **deletes:** raw workflow bodies which CT-I assigns to later thin callers.
- **dependencies:** CT-M, hard, accepted exact copy; CT-Q, hard, merged Copier
  package/question interface for actual renders. CT-C/R are independent.
- **source_files:** CT-I mappings, CT-M snapshot, CT-Q package, design D1–D6.
- **required_actions:** introduce substitutions for the eight established names
  using CT-Q's fixed `[[ ]]` / `[% %]` delimiters; preserve native GitHub
  expressions and serialize shell arrays/YAML/JSON correctly.
  Render short instructions, config, direct App manifest and only callers whose
  interfaces already exist at reviewed seed refs. Default native mode by omission.
  Preserve the fourteen client skill/resource paths from corrected CT-M, their
  licenses and relative resources; document external tooling dependencies and
  verify loading paths from the generated client, including replan's nested path.
  Reuse existing application CI and preserve unrelated instructions/license/files.
  Omit unavailable review/CI callers from this initial cut and enumerate their
  exact CT-L additions in PROVENANCE; never invent refs/interfaces, emit raw
  reusable bodies or claim Docker/Codex support before its integration.
- **acceptance_checks:** real Copier render matrix covers two slugs/default
  branches (including non-main), teams, quoted/newline commands and file
  collisions. Carry `cadence_reviewer` into the generated caller's explicit input;
  CT-L closes any deferred reviewer wiring. No project key, extra provider toggle,
  secrets, host or reusable bodies
  in output. Assert exact preservation of `${{ ... }}` expressions, no unresolved
  Copier placeholders, and no root-only development workflows/config/tests in
  output. Validate rendered YAML/JSON while ordinary lint/format skips raw syntax.
  The direct App manifest includes required checks-write grants;
  public forks use the accepted existing App. Initial config loads with the
  current reader; any unconfigured
  required-check list is explicit. The bounded pending additions are CT-L-owned
  and prevent publication/onboarding, not this initial conversion's acceptance.
- **Validation, in order:** local pinned Python/Copier environment,
  `python -m unittest discover -s templates/symphony-client/tests`, actual render
  and current config reader, locked formatting/diff checks. Docker skipped on
  pass or CT-Q's pinned Python/Git fallback. Mandatory seed CI and render job on
  the current head. No live review/mode proof is claimed by structural rendering.
- **delivery_notes / exclusions:** CT-L takes the tree/tests/metadata after merge.
  CT-Q's package tests exercise isolated fixtures; conversion tests own separate
  fixtures. No Dockerfile, Codex implementation or changed question contract.
- **split_criteria:** `cross-package-contract`, `ticket-template-contract`.

## CT-L — Integrate late CI and Codex additions before release

- **Scope:** compose the initial template with accepted CT-C/R interfaces;
  close every explicitly deferred caller/mode addition before publication.
- **owned_files:** `templates/symphony-client/template/` paths selected by CT-I,
  staging `README.md`, `PROVENANCE.md`, `tests/test_render.py`,
  `.symphony.cfg.json` (seed render-check registration), and
  `docs/symphony-plans/client-template/client-inventory.md` (final readback).
- **owned_external_resources:** task-local render fixtures and seed task checks.
  No live provider/App/secret/project operations; CT-R/A retain those proofs.
- **creates:** the deferred thin review/handoff/wakeup/CI/cleanup caller paths in the
  accepted inventory. **edits:** other owned paths. **deletes:** none.
- **dependencies:** CT-T, CT-C and CT-R, hard: merged initial tree and final
  reader/runner/reviewer interfaces, export lists and reviewed seed refs.
- **source_files:** CT-T pending-addition list, CT-C/R final files/proof,
  actual config reader and both reviewed exports.
- **required_actions:** add the missing thin callers and any client-Dockerfile
  mode guidance/config changes without changing the eight answers. The client
  supplies its Dockerfile; do not introduce a generic application Dockerfile.
  Pin reviewed full seed refs, explicitly map named secrets at every hop and
  preserve 100-43's advisory/ready behavior without a setting or required check.
  Render `symphony-client-review-cleanup.yml` with local native `workflow_run`
  triggers matching actual generated review workflow names, calling CT-R's
  cleanup entry with App key only. Exercise cancellation/recovery boundary tests.
  Handoff has App/Linear only; CI/ingress have no review secrets. Register the
  observed render job name/workflow/App in seed required checks; verify CT-Q's
  raw-template lint/format exclusion remains effective while render tests run
  for template-only changes. Close the
  PROVENANCE pending list and keep source/version metadata.
- **acceptance_checks:** full CT-T matrix plus native/optional Docker/remote
  reader compatibility passes; generated paths equal the final inventory;
  no remaining deferred caller, placeholder ref or raw workflow body. Exact
  secret mappings and explicit `cadence_reviewer`/key matrix match revised D6
  and CT-R's tested interface. Verify the merged provider input and missing-key
  validation exist; PR #43's App-identity checkpoint alone is insufficient. No new
  questions or changed CT-Q delimiters. Test full generated workflows for
  unchanged GitHub expressions and exclusion of root development files.
  Existing application/instruction/license content is preserved.
  Template is now complete for CT-U publication and CT-O onboarding authoring;
  the accepted caller/export readback also enables concurrent CT-V publication.
- **Validation, in order:** local pinned render unittest matrix, existing reader
  validation for all three modes, YAML/secret/pin boundary inspection, locked
  formatting/diff checks. Docker fallback skipped on pass or CT-Q's pinned
  environment; CT-C owns executing Docker mode, CT-A owns final live proof.
  Mandatory seed CI plus registered render check at this published head, with
  actual check/workflow/App provenance. Rendering is not provider execution.
- **delivery_notes / exclusions:** CT-U copies the completed root, CT-O consumes
  its usage contract, CT-A eventually deletes staging. No change to `copier.yml`
  answers, workflow implementations, host rollout or new orchestration.
- **split_criteria:** `cross-package-contract`, `integration-validation-dependency`.

## CT-O — Deliver fork/direct and repeat onboarding skill

- **Scope:** one small `.agents/skills/symphony-onboard/SKILL.md` entry point for
  `onboard <repo-url>` with fork/direct/repeat procedures using existing tools.
- **owned_files:** that `SKILL.md`, `references/fork.md`, `references/direct.md`
  and `references/walkthrough.md` under the same new skill directory.
- **owned_external_resources:** none during authoring/dry-run. Describe owner
  operations, do not execute participant setup. CT-A later owns the one live
  walkthrough; Jeremy/parent owns installing/invoking the skill.
- **creates:** all four owned skill files. **edits:** none.
- **dependencies:** CT-L, hard, complete merged template/actual eight-answer interface
  needed for executable skill instructions and render dry runs.
- **source_files:** CT-L README/template/config/manifest and test fixtures,
  existing repository/Linear/planning skills and their tools; D7/D8/D9.
- **required_actions:** apply installed skill-creator guidance; reuse existing
  GitHub, repository, Linear and planning operations. Fork by default into
  1000lines and grant the owner admin; direct for private/secret-dependent CI
  uses the owner's App manifest/installation. Inspect first on repeated invocation
  so no duplicate repo/App/project/secrets/seed set; preserve unrelated settings.
  Final public usage selects template `--vcs-ref=alpha` and workflow `@alpha`;
  record actual resolved commits as described in the plan. Author/dry-run from
  CT-L's local staging source until both publication branches exist.
  Explain the template repository's own root client as a real consumer, with
  root `copier.yml` selecting only `template/`. Link CT-F's eventual live proof;
  do not claim self-hosted development before its runs exist.
  Supply eight known answers; set chosen mode/commands outside questions;
  discover IDs, Actions enablement/permissions and actual required checks.
  Provision named secrets separately and show names only. Record accepted public
  App cross-installation PR/issues/checks write scope accurately; no fork-key gate.
  Select/create the initial Linear project through existing planning tools;
  additional projects reuse the same client and derive metadata from each issue.
  Load project-factory, Linear GraphQL and replan from the generated client's
  copied paths, retaining their resources and the separate reviewed tooling
  checkout. Do not source those fourteen client files from CT-V's workflow repo.
  No repository project binding. Describe exact missing-access owner/action and
  idempotent resumption; the advisory check is automatic and never required.
- **acceptance_checks:** dry walkthrough of fork, direct, repeat and additional
  project paths using synthetic existing-resource responses; executable command
  references resolve to existing tools; invocation/installation and real
  walkthrough evidence reserved for CT-A. Parent participant rehearsal remains
  separate. No post-generation agentic interview or new host orchestration.
- **Validation, in order:** local locked Markdown formatting, link/command
  inspection and owner-readable dry-run transcript using the merged template's
  local render command; Docker fallback skipped on local pass, otherwise same
  pinned Python/Node environment as CT-T for unavailable tools. Mandatory seed
  CI including Changed Markdown on this skill/docs PR's head.
- **delivery_notes / exclusions:** CT-U/V run concurrently but own different
  repositories and no shared credential operations. Later relocation of this
  skill is unnecessary. No unattended project-factory installation or new helper
  without a demonstrated existing-tool API gap and amended ownership.
- **split_criteria:** `codex-skill-boundary`, `operational-prerequisite`.
