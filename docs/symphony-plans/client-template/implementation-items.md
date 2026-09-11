# Client template implementation items

Part of [100-39's plan](../fan-out-plan-100-39-client-template.md). Every item
inherits its ticket execution contract, labels, main/main branching and evidence
requirements. Paths below are relative to `1000lines/symphony-example`.
Estimated sizes and difficulties are in the main plan. No item creates live
participant projects or operates the parent rehearsal.

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
  their directly/transitively imported helpers; config reader and license.
- **required_actions:** map each D1 artifact to a generated path and reason;
  enumerate existing target collisions, source-only files and exclusions.
  Name every source path needed by review and CI reusable entry points in the
  two newline-separated lists, including instructions, tests, package dependencies
  and license attribution. Identify planned new paths in CT-C/R; expand imports
  rather than copying the tooling package or dormant controller wholesale.
  The inventory names source-to-template mappings and publication CI assets.
  `client-copy.txt` fixes an existing, reviewed source SHA and every source →
  `templates/symphony-client/template/` destination, with file mode/hash. It
  includes only existing nonsecret files; new Copier metadata belongs to CT-Q,
  and later Docker/Codex additions are listed separately, never invented copies.
  Specify which copied files can be converted immediately and which raw workflow
  bodies must be omitted until CT-L adds their thin reusable callers.
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
  `docs/engineering/symphony/tooling-setup.md` (mode guidance only).
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
  completion events, failed→Active, passed→Inactive, stale/terminal rejection.
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

- **Scope:** expose existing native review/handoff as reusable workflows with
  explicit target inputs/secrets, add key-selected Codex execution, and prove
  the early real review in the seed. Retain the working Claude-only path.
- **owned_files:** `.github/workflows/cadence-ai-review-events.yml`,
  `.github/workflows/cadence-ai-review-trigger.yml`,
  `.github/workflows/cadence-ai-review.yml`,
  `.github/workflows/cadence-linear-rework.yml`,
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
  feedback/workpad/permission helpers and Claude skill; read dormant Codex source
  only to understand historical constraints, not to revive its controller.
- **required_actions:** declare `workflow_call` inputs for repository/default
  branch, identity and discovered App IDs; caller config/source and pinned trusted
  workflow/helper checkouts stay separate. Explicitly declare/map
  `CADENCE_APP_PRIVATE_KEY`, `CADENCE_LINEAR_API_TOKEN`, optional
  `CADENCE_OPENAI_API_KEY`, optional `CADENCE_AI_REVIEW_ANTHROPIC_API_KEY`.
  Handoff gets only App/Linear. Remove the adopter requirement for legacy bot PAT;
  both providers publish with the configured App. No generated/onward cross-repo
  `inherit`. Use native jobs/maintained Actions and a small result adapter for
  `{repository, prNumber, headSha, verdict, summary, findings}`. Codex wins with
  OpenAI, Claude runs with Anthropic alone, neither fails before review, and API
  failure never selects another provider. Reuse the existing review ledger and
  APPROVE/COMMENT publication; no GitHub REQUEST_CHANGES.
  Preserve 100-43's App-owned actual-head queue/run/result, same-head feedback
  freshness, safe overlap/cancellation/closure and draft-ready behavior for both
  providers. Preserve authorization, full source reads, loop cap and terminal
  guards. Replace main/repository assumptions with trusted target values; do not
  run PR-controlled code with privileged secrets or widen environment eligibility
  to unreviewed refs. Keep native/manual compatibility entry points working.
- **acceptance_checks:** all four key combinations and malformed/stale/missing
  output tested; one provider runs; both use the same verdict/handoff contract.
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
  provider question, blanket workflow deletion or public-fork key service.
- **split_criteria:** `automation-identity-boundary`, `async-pipeline-boundary`.

## CT-Q — Define and test the seven Copier answers

- **Scope:** build the ordinary Copier question/answers package independently
  of file inventory, copying, Docker compatibility and provider implementation.
- **owned_files:** `templates/symphony-client/copier.yml`, `README.md`, `LICENSE`,
  `PROVENANCE.md`, `tests/requirements.txt`, `tests/test_answers.py`, and
  `.github/workflows/ci.yml` under that staging root;
  `.github/workflows/client-template-test.yml` at the seed root.
- **owned_external_resources:** task-local temporary Copier fixture directories
  and its seed PR/checks only. No live secrets, App/repo/project writes.
- **creates:** all owned files. **edits:** none.
- **dependencies:** none. D4 already fixes the answer interface; CT-I's file
  selection is unnecessary to ask and serialize those answers.
- **source_files:** merged design D4 and ordinary Copier configuration guidance.
- **required_actions:** `_subdirectory: template`; exactly `repo_slug`,
  `default_branch`, `linear_team_key`, `symphony_app_slug`, `cadence_app_slug`,
  `build_command`, `test_command`. Keep defaults/types and source/ref metadata
  ordinary Copier. No credentials, project binding, mode/provider/ref question.
  Pin the Python/Copier requirements. Build tests in a task-local minimal
  `template/` fixture so CI exercises the questions even before CT-M/T land.
  Root CI discovers the package tests; the seed caller uses the same command.
  Record the interim package's limited scope and the later CT-L release gate.
- **acceptance_checks:** seven answers work noninteractively for two repo slugs,
  non-main branches, teams and commands with quotes/newlines; ordinary answer
  metadata retains `_src_path`/`_commit` without secrets. No writes inside the
  committed `template/` tree, no CI registration or claim of live client behavior.
- **Validation, in order:** local install of pinned `tests/requirements.txt`,
  `python -m unittest discover -s templates/symphony-client/tests`, actual
  `copier copy` into temporary fixtures and locked formatting/diff checks.
  Docker skipped on pass; otherwise digest-pinned Python 3.12 with Git, the same
  requirements/command and workspace UID/mount policy. Mandatory seed CI and
  `client-template-test.yml` at the published head; record actual emitted checks.
- **delivery_notes / exclusions:** CT-Q can run with CT-I/M/C/R: it owns package
  metadata and question tests, CT-M owns only copied `template/` files. CT-T
  consumes the accepted question interface; CT-L later registers final CI.
  No Copier hooks/update, rendered operator skill or late workflow integration.
- **split_criteria:** `ticket-template-contract`, `risk-blast-radius`.

## CT-M — Copy every listed client file without changes

- **Scope:** a separate, mechanically verifiable PR copies the complete CT-I
  list into staging before any template conversion.
- **owned_files:** exactly the `templates/symphony-client/template/` destination
  paths in accepted `client-copy.txt`; no package metadata or inventory edits.
- **owned_external_resources:** task-local immutable source export and its own
  branch/PR. No Actions/secret/repository settings or participant operations.
- **creates:** every listed destination. **edits:** none. **deletes:** none.
- **dependencies:** CT-I, hard, accepted source/path/hash list. No CT-Q/C/R gate.
- **source_files:** every exact source path/ref in CT-I's merged copy list.
- **required_actions:** use ordinary Git/copy tools to copy all listed bytes and
  modes, including dotfiles. No selection, substitutions, redaction, formatting,
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
- **required_actions:** introduce substitutions for the seven established names;
  escape GitHub expressions and serialize shell arrays/YAML/JSON correctly.
  Render short instructions, config, direct App manifest and only callers whose
  interfaces already exist at reviewed seed refs. Default native mode by omission.
  Reuse existing application CI and preserve unrelated instructions/license/files.
  Omit unavailable review/CI callers from this initial cut and enumerate their
  exact CT-L additions in PROVENANCE; never invent refs/interfaces, emit raw
  reusable bodies or claim Docker/Codex support before its integration.
- **acceptance_checks:** real Copier render matrix covers two slugs/default
  branches (including non-main), teams, quoted/newline commands and file
  collisions. No project key, provider toggle, secrets, host or reusable bodies
  in output. The direct App manifest includes required checks-write grants;
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
- **creates:** the deferred thin review/handoff/wakeup/CI caller paths in the
  accepted inventory. **edits:** other owned paths. **deletes:** none.
- **dependencies:** CT-T, CT-C and CT-R, hard: merged initial tree and final
  reader/runner/reviewer interfaces, export lists and reviewed seed refs.
- **source_files:** CT-T pending-addition list, CT-C/R final files/proof,
  actual config reader and both reviewed exports.
- **required_actions:** add the missing thin callers and any client-Dockerfile
  mode guidance/config changes without changing the seven answers. The client
  supplies its Dockerfile; do not introduce a generic application Dockerfile.
  Pin reviewed full seed refs, explicitly map named secrets at every hop and
  preserve 100-43's advisory/ready behavior without a setting or required check.
  Handoff has App/Linear only; CI/ingress have no review secrets. Register the
  observed render job name/workflow/App in seed required checks. Close the
  PROVENANCE pending list and keep source/version metadata.
- **acceptance_checks:** full CT-T matrix plus native/optional Docker/remote
  reader compatibility passes; generated paths equal the final inventory;
  no remaining deferred caller, placeholder ref or raw workflow body. Exact
  secret mappings and provider matrix match CT-R's tested interface; no new
  questions. Existing application/instruction/license content is preserved.
  Template is now complete for CT-U publication and CT-O onboarding authoring.
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
- **dependencies:** CT-L, hard, complete merged template/actual seven-answer interface
  needed for executable skill instructions and render dry runs.
- **source_files:** CT-L README/template/config/manifest and test fixtures,
  existing repository/Linear/planning skills and their tools; D7/D8/D9.
- **required_actions:** apply installed skill-creator guidance; reuse existing
  GitHub, repository, Linear and planning operations. Fork by default into
  1000lines and grant the owner admin; direct for private/secret-dependent CI
  uses the owner's App manifest/installation. Inspect first on repeated invocation
  so no duplicate repo/App/project/secrets/seed set; preserve unrelated settings.
  Supply seven known answers; set chosen mode/commands outside questions;
  discover IDs, Actions enablement/permissions and actual required checks.
  Provision named secrets separately and show names only. Record accepted public
  App cross-installation PR/issues/checks write scope accurately; no fork-key gate.
  Select/create the initial Linear project through existing planning tools;
  additional projects reuse the same client and derive metadata from each issue.
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
- **delivery_notes / exclusions:** CT-U runs concurrently but owns a different
  repository and no shared credential operations. Later relocation of this
  skill is unnecessary. No unattended project-factory installation or new helper
  without a demonstrated existing-tool API gap and amended ownership.
- **split_criteria:** `codex-skill-boundary`, `operational-prerequisite`.
