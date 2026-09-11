# Client template delivery and reuse items

Part of [100-39's plan](../fan-out-plan-100-39-client-template.md). Every new item
inherits the execution contract, labels, main/main branching, size estimate and
validation policy. Explicit repository overrides below must be copied into
generated tickets. New public repositories are execution destinations, not
repositories created by this planning ticket.

## 100-43 — Reuse advisory check and readiness implementation

- **existing_issue:** `100-43`, UUID `57d7cdf2-4283-4baa-8a36-5a1194615160`;
  repository `1000lines/symphony-example`, Misc/blue, PR #31. Reuse its existing
  assignment, branch, scope, check/ready implementation and initial live proof.
  Never create a payload, duplicate issue, second implementation or relabel it pink.
- **Known state:** refreshed September 11: Done, PR #31 merged at 14:02:53Z
  as `ca5c37344df600468ee69e73c04c54197a5b062c`. State is not proof; Reread its actual status/ref and
  workpad at fan-out and CT-R start. A later Done needs its accepted evidence.
- **Ownership/use:** its existing ticket owns the native advisory helper/workflows
  and seed proof until accepted; CT-R takes those files only afterward. No new
  file/resource ownership is granted to 100-43 by this plan.
- **Dependencies:** no new incoming edge. The plan adds only 100-43 → CT-R after
  review; do not restore 100-43 → 100-39, which Jeremy removed on September 11.
- **Validation expected from existing ticket:** current-head required CI and
  Cadence, queued/running→final App check on the true head, fresh draft→ready,
  safe overlap/failure/cancellation/close tests and confirmation it is advisory.
  CT-R records its actual merge SHA and initial live evidence before consuming it.
- **Exclusions:** 100-42 acknowledgement work is related context, not a blocker
  or a duplicate implementation task. Preserve later merged behavior when reading
  the base; this plan does not reopen old readiness work.

## CT-U — Publish the reviewed template repository

- **Repository override:** `https://github.com/1000lines/symphony-client-template`;
  branch and PR base `main`. `symphony-client-template` is the working name.
- **Scope:** copy the entire reviewed staging root to this public repository,
  preserve license/provenance and prove rendering from its published ref.
- **owned_files:** the entire new root copied exactly from CT-L's completed
  `templates/symphony-client/`; publication-only additions/edits to root
  `README.md`, `PROVENANCE.md`, `.symphony.cfg.json` and `.github/workflows/ci.yml`
  for this repository's own setup/CI. These files are outside the rendered tree.
- **owned_external_resources:** this destination's creation/bootstrap,
  main/PR/alpha branch refs, Actions enablement/variables/named secrets and required
  CI configuration, through existing authorized tools or Jeremy. No writes to
  seed content, onboarding skill, workflow destination or participant repos.
- **creates:** all owned import files except the bootstrap README.
  **edits:** bootstrap `README.md`; publication metadata changes to imported
  `PROVENANCE.md` and `.github/workflows/ci.yml` remain part of their new-file diff.
- **dependencies:** CT-L, hard, complete accepted staging commit with passing render CI;
  reason: exact import source. CT-O/V are independent and share no mutable
  file, repository setting, alpha ref or live proof resource.
- **source_files:** full staging root at its accepted SHA, client inventory,
  license, template tests and source CI; all source reads are immutable.
- **required_actions:** verify name availability/public access and actual push,
  App/review/Actions grants. A real collision goes to Jeremy for a new name;
  no speculative question. If the repository is absent, have the authorized
  owner create it with a minimal README main, then branch from that actual main
  and import through a draft PR. Do not silently write the whole template to
  unreviewed main. Record bootstrap action/ref separately. Use existing copy/Git
  tools with dotfiles; record source SHA/path, destination SHA, path mapping,
  justified publication-only differences and Apache-2.0 attribution. Preserve
  template tests/CI at their root-relative paths. After human acceptance publish
  `refs/heads/alpha` at the accepted main commit and perform a fresh Git-URL
  render with `--vcs-ref=alpha`. Record branch resolution and actual rendered
  commit; verify no same-name tag. Follow the plan's alpha evidence contract.
- **acceptance_checks:** public anonymous readback; source/tree comparison with
  no lost dotfiles, secrets or additional rendered assets; seven answers and
  `_src_path`/`_commit`; exact published render passes CT-L's full matrix. Template
  still references reviewed seed workflows at this intermediate publication; CT-F owns
  final alpha references. Record actual destination CI/reviewer provenance and ref links.
- **Validation, in order:** local `git diff --no-index` between export and
  destination (explicit publication differences reviewed), pinned requirements
  install and `python -m unittest discover -s tests`; `copier copy --vcs-ref=alpha
<published-git-url> <isolated-target>` with fixture answer files.
  Docker skipped on local pass; otherwise CT-Q's pinned Python/Git environment
  and workspace UID/mount policy. Mandatory destination `.github/workflows/ci.yml`
  render tests on the published task head, plus any observed required checks.
  CI must exist and run; absence is not a green import. Record App/check names
  from the actual run, not seed assumptions. Read back alpha and its actual commit after human merge.
- **delivery_notes / exclusions:** CT-V publishes independently in its own repo;
  CT-F waits for both and later edits these references/provenance. No workflow implementations in the template repo,
  staged-source deletion, upstream submission, participant setup or copier update.
  Missing create/admin rights needs the prepared import patch/PR and exact named
  owner operation; it does not authorize expanded credentials or direct merges.
- **split_criteria:** `external-system-boundary`, `risk-blast-radius`.

## CT-V — Publish reusable workflows and required helpers

- **Repository override:** `https://github.com/1000lines/symphony-client-workflows`;
  branch and PR base `main`. This is a working name verified at execution.
- **Scope:** near project end publish only the reviewed client-facing workflows
  and dependencies, with trusted helper/nested-call refs targeting this repository.
- **owned_files:** new destination paths enumerated by the union of accepted
  `review-export.txt` and `ci-export.txt`, plus its `README.md`, `LICENSE`,
  `PROVENANCE.md`, `.symphony.cfg.json` and `.github/workflows/ci.yml`.
  Expand those accepted lists into the ticket before copying. The import is the
  whole listed set, not further unreviewed file selection.
- **owned_external_resources:** workflow destination creation/bootstrap, public
  read/access/Actions settings and its main/PR/alpha branch refs; task-specific CI.
  No source deletions, seed credential mutation or template publication writes.
- **creates:** accepted export-list paths and owned destination metadata/CI
  except bootstrap `README.md`. **edits:** bootstrap `README.md`.
- **dependencies:** CT-L, hard, final integrated caller/export contract with
  accepted CT-C/R exports and 100-43 proof. CT-V can publish concurrently with
  CT-U; it neither reads an unfinished CT-U result nor writes that repository.
- **source_files:** exact accepted seed refs/export lists and their tests,
  early-review evidence, CT-L caller mapping and source license/provenance.
  No CT-U public ref is needed for the import.
- **required_actions:** verify name/access/permissions, minimal-main bootstrap
  when needed, then draft import PR against destination main as in CT-U. Copy
  the reviewed lists with dotfiles, source/destination mapping and license.
  Separate mechanical copy from ≤250 lines of pin, minimal CI or path adaptation;
  a newly required dependency returns to explicit inventory review rather than
  silently copying the controller. Preserve common helpers/tests once, with no
  assumption of a full target-side Node package. Use repo-root package/lock only
  for actually imported workflow tooling dependencies, as listed by CT-I/R.
  Keep helper checkout repository/ref distinct from target source/config and
  preserve the caller's target context. Reference nested calls and helper checkouts at
  destination `alpha` code, not `github.sha` of a target PR; record actual helper
  commits used. Same-repository nested calls may use native same-commit semantics
  where verified; avoid circular self-SHA requirements. Ensure explicit secrets
  remain intact at each remote hop, including App-only cleanup. After human
  acceptance publish `refs/heads/alpha`, record its actual commit, anonymous
  availability and workflow-call access, and verify no same-name tag. Follow the
  alpha evidence contract; no release tag is required.
- **acceptance_checks:** imported tests pass; graph of nested calls/helper
  checkouts resolves to reviewed destination refs. Both providers, native CI,
  feedback routing and inherited advisory/readiness contracts survive. Public
  reusable invocation is configured; actual final consumer evidence is CT-A,
  not inferred from source. No seed entry point removed while it has consumers.
- **Validation, in order:** local exact tree mapping and targeted imported Node
  test commands from CT-C/R at their unchanged paths, minimal dependency install,
  locked formatting and YAML/call-boundary review; Docker skipped on local pass,
  otherwise digest-pinned Node 20 with workspace policy. Mandatory destination
  CI runs those imported tests on the current head, with actual required
  workflow/App/check readback; record any bootstrap/trusted-workflow limitation.
  Publish/resolve the human-reviewed alpha branch before CT-F proceeds.
- **delivery_notes / exclusions:** this is an intentional large mechanical diff,
  not a reason to expand its behavioral scope. Do not delete/retarget seed
  callers here, copy host installers, move onboarding skills or claim final live
  review. CT-F owns template alpha references; CT-A owns consumer migration; CT-Z owns retirement.
- **split_criteria:** `external-system-boundary`, `default-branch-dispatch-prerequisite`.

## CT-F — Connect template alpha to published workflow alpha

- **Repository override:** `https://github.com/1000lines/symphony-client-template`;
  main/main. **Scope:** integrate both accepted publications so template alpha
  emits callers using workflow `@alpha`.
- **owned_files:** `template/.github/workflows/` caller files from CT-L's final
  inventory (only source/ref mappings), root `README.md`, `PROVENANCE.md`,
  `tests/test_render.py` (expected destination refs only).
- **owned_external_resources:** template task branch/PR and its moving `alpha` branch. CT-U relinquishes this repository's write ownership; CT-V is read-only.
- **creates:** none. **edits:** all owned files, source/ref expectations only.
- **dependencies:** CT-U and CT-V, hard direct fan-in. CT-U supplies the accepted
  template repository and relinquishes its files/alpha ref; CT-V supplies the
  accepted public workflow alpha branch and complete mapping. Both must exist
  before the final references can be validated and published.
- **source_files:** CT-U source metadata and tests; CT-V alpha/provenance.
- **required_actions / acceptance_checks:** repoint every generated workflow
  caller to the literal destination `@alpha`; inspect onward references via
  CT-V evidence. Keep all named secrets and seven questions unchanged. After
  human acceptance advance template `refs/heads/alpha`, render using
  `--vcs-ref=alpha` from its Git URL in a fresh isolated checkout and record
  the actual template/workflow commits. Moving branches are intentional; apply
  the alpha evidence contract rather than replacing consumer refs with SHAs. Inspect no remaining
  active seed-workflow pin in rendered callers. Historical source refs stay valid.
- **Validation, in order:** local pinned render unittest matrix and diff check;
  real published-ref Copier render; Docker skipped on local pass or same pinned
  CT-Q/U Python/Git fallback. Mandatory current-head template CI and discovered
  required checks, even for this small pin change; then alpha branch/readback provenance.
- **delivery_notes / exclusions:** CT-A consumes this pair; no seed/staging edits,
  workflow behavior changes, copier update, tags or unreviewed code on alpha.
- **split_criteria:** `cross-package-contract`, `low-risk-batch`.

## CT-A — Adopt published template and prove live consumer paths

- **Repository:** `1000lines/symphony-example`, main/main.
- **Scope:** reviewed self-adoption of CT-F's published pair, preserving seed
  application/tooling/manual paths; real final review/modes/onboarding proof.
- **owned_files:** rendered paths from the accepted client inventory:
  `.github/workflows/cadence-review-ingress.yml`,
  `.github/workflows/symphony-client-review.yml`,
  `.github/workflows/symphony-client-handoff.yml`,
  `.github/workflows/symphony-client-review-cleanup.yml`,
  `.github/workflows/symphony-client-wakeups.yml`,
  `.github/workflows/symphony-client-ci.yml` only if needed,
  `SYMPHONY.md`, `.github/symphony/REVIEW.md`,
  `.github/symphony/cadence-app-manifest.json`, `.symphony.cfg.json`,
  `.copier-answers.yml`; native event triggers in
  `cadence-ai-review-events.yml`, `cadence-linear-rework.yml`,
  `symphony-linear-wakeups.yml`, `cadence-ai-review-trigger.yml` and
  `cadence-ai-review.yml` and `cadence-review-check-cleanup.yml` under
  `.github/workflows/` only as needed to prevent
  duplicate admission while retaining manual/compatibility paths;
  `templates/symphony-client/` deletion and
  `.github/workflows/client-template-test.yml` removal/repoint after extraction;
  `docs/symphony-plans/client-template/adoption-evidence.md`,
  `docs/symphony-plans/client-template/consumer-census.md` (new).
- **owned_external_resources:** seed generated-caller variables/named secrets,
  Actions/required-check settings and test runs, provided through Jeremy/owner;
  one task-linked proof PR, its advisory checks/reviews and the task's nonterminal
  Linear state; owner-controlled onboarding walkthrough and existing host-reader
  version/readback. Use the task's own issue for remote CI recovery, never mutate
  unrelated/terminal tickets. CT-R is complete before this resource handoff.
- **creates:** new `symphony-client-*` callers, `SYMPHONY.md`,
  `.github/symphony/REVIEW.md`, `.github/symphony/cadence-app-manifest.json`,
  `.copier-answers.yml`, `adoption-evidence.md` and `consumer-census.md` at their
  owned paths. **edits:** owned ingress/config/native trigger files and seed
  template-test workflow. **deletes:** staging root and obsolete seed render
  workflow if replaced. Existing-file collisions convert the corresponding
  create into a reviewed edit; never overwrite unrelated content.
- **dependencies:** CT-F and CT-O, hard: final reviewed public refs and merged
  skill are required for adoption and the owner-operated walkthrough.
- **source_files:** CT-F/CT-V publication evidence, CT-O skill, CT-C compatibility
  and CT-R early proof, current seed config/application/manual workflow paths.
- **required_actions:** render from CT-F's published Git URL with `--vcs-ref=alpha` into
  an isolated clean checkout. Inspect collisions and merge existing config and
  instruction content explicitly; preserve unrelated file hashes and existing CI.
  Keep Copier source/version answers and record actual resolved template and
  workflow/helper commits under the alpha evidence contract. Delete staging only after extraction and
  successful isolated adoption; human reviews the adoption diff before merge.
  Disable duplicate automatic triggers atomically with caller replacement;
  retain useful manual/forwarding entry points. No indiscriminate body deletion.
  Record consumer census (repo, entry path/ref, replacement owner and run) for
  every old entry being replaced. Required checks exclude `Cadence review`.
  Jeremy installs/invokes the merged skill for the controlled walkthrough;
  record installed ref and command, actual App grants and secret delivery names.
  Verify fork/direct/repeat/additional-project procedures, two projects sharing
  one repo config, and actual current installed reader support before activation.
- **acceptance_checks:** after trusted adoption callers land, a real follow-up
  PR executes those callers using workflow `@alpha` and gets a real
  Codex Cadence review, App/head-correct advisory queued/running→linked result,
  and clean-current-head draft→ready with no newer feedback pending. Record
  caller/ref/run/review/check IDs, actual consumed template/workflow/helper SHAs,
  provider/App identity and before/after PR state. The local cleanup listener
  must match the actual caller workflow names and close checks after canceled
  or failed review execution; include migrated cancellation/recovery proof.
  Keep proportional Claude-only/both/neither tests at the final exported source;
  an actual provider fallback smoke test is required if migration changes its
  execution boundary beyond already tested behavior. Do not claim Claude live
  execution from a fixture. Confirm secrets reach all needed hops without values.
  Demonstrate native commands and client-Dockerfile commands with image digest.
  Demonstrate remote with missing local toolchain: available checks, intentional
  failing current-head CI on the task-linked proof PR, real failure→Active,
  corrected head→passing required checks→Inactive. Record Linear state and wake
  label readbacks; existing stale-head/terminal tests must still pass. Run failure
  rehearsal only on this isolated proof PR, never on main or another active task.
- **Validation, in order:** local published-ref render, reader validation,
  `npm run build`, `npm run lint`, relevant imported workflow tests and file
  preservation diff; Docker fallback skipped on pass, with separate required
  client-Dockerfile mode demonstration as in CT-C. Remote mode intentionally
  records its unavailable toolchain. Mandatory seed current-head CI, any adopted
  required check, and real migrated workflow/provider/CI-state runs. Native
  pull_request_target/workflow_run changes cannot prove themselves before
  default-branch merge: publish the prepared draft, obtain owner merge, then
  execute the follow-up proof and record evidence in the workpad or a small
  evidence PR. Keep CT-A open until required live evidence exists.
- **delivery_notes / exclusions:** unavailable secret/admin/reload operation
  requires exact target/App/error/grant, Jeremy action and readback in the PR
  and workpad. Source/install fixtures do not prove runtime reload, provider
  execution or timer recovery. Wider participant rehearsal and host concurrency
  remain parent-owned. Do not expand App grants, merge autonomously or remove
  unrelated seed tooling/workflows.
- **split_criteria:** `integration-validation-dependency`, `rollout-gate`.

## CT-Z — Retire migrated bodies and finalize evidence

- **Repository:** `1000lines/symphony-example`, main/main.
- **Scope:** close the project against all design ACs, remove only obsolete
  project-owned bodies/seams after consumer replacement passes, and publish the
  final owner handoff. This is real cleanup/evidence work, not a join ticket.
- **owned_files:** `docs/symphony-plans/client-template/finalization.md` (new),
  `docs/symphony-plans/client-template/consumer-census.md`,
  `docs/symphony-plans/client-template/adoption-evidence.md`;
  obsolete bodies at `.github/workflows/cadence-ai-review-events.yml`,
  `.github/workflows/cadence-ai-review-trigger.yml`,
  `.github/workflows/cadence-ai-review.yml`,
  `.github/workflows/cadence-linear-rework.yml`,
  `.github/workflows/symphony-linear-wakeups.yml`,
  `.github/workflows/symphony-client-commands.yml`,
  `.github/workflows/cadence-review-check-cleanup.yml`, and only exported helpers
  explicitly marked unreferenced in the accepted consumer census. Expand those
  exact helper paths before edits; preserve shared seed imports/manual wrappers
  and the generated client cleanup listener. Standing path/usage references in
  `README.md`, `docs/engineering/symphony/tooling-setup.md`,
  `docs/engineering/symphony/project-workflow.md` and
  `docs/engineering/review/cadence-ai-review.md` are owned only where this
  migration changes their instructions; keep historical plans as records.
- **owned_external_resources:** read-only public ref/CI/review/settings census;
  this task's branch/PR. No repo deletion, tag removal, participant credential
  revocation, host reload or unsolicited project terminal-state mutation.
- **creates:** owned `finalization.md`. **edits:** owned census/evidence and
  retained compatibility entry points and owned standing guidance. **deletes:** only owned bodies/helpers
  proven unreferenced by the accepted consumer census; otherwise retain them.
- **dependencies:** CT-A, hard, accepted adoption and final live evidence;
  reason: retirement cannot be justified from an untested replacement.
- **source_files:** every item workpad/merged PR, both publications, census,
  final render/mode/onboarding/provider/advisory evidence, design AC1–AC13.
- **required_actions:** apply installed symphony-finalize-project skill. Search
  project-owned files for TODO/FIXME/stub/adapter/disabled paths, lingering staging,
  duplicate event bodies and old active pins. Resolve only project-scoped work;
  document unrelated historical controller code as excluded. Retain forwarding
  or manual entry points with actual consumers and record them as intentional
  compatibility, with owner/ref/run evidence. Delete bodies only where every
  caller migrated and replacement runs passed; do not invalidate old published
  refs. Summarize accepted refs, PRs, CI, review, onboarding/reader/mode execution,
  license/public access and any parent-owned follow-up. No unowned temporary seam
  may remain; a discovered gap keeps its actual delivery open.
- **acceptance_checks:** AC1–AC13 evidence matrix is complete with exact targets;
  staging absent; consumer census covers retained/deleted paths; no project-scoped
  TODO, stub, disabled behavior or duplicated maintained body is unexplained.
  Source, installed version and real execution are separate evidence records.
  Jeremy approves final acceptance; no readiness/CI signal alone marks Done.
- **Validation, in order:** local `rg` marker/reference search on census paths,
  `git diff --check`, locked Markdown formatting and affected native/manual
  workflow tests after deletions; Docker skipped on local pass or pinned Node 20
  fallback. Mandatory seed CI on this cleanup/docs head; real smoke of each
  retained manual/forwarding entry point whose executable path changed. Reuse
  unchanged final consumer evidence only where its target/ref still applies.
- **delivery_notes / exclusions:** no planned temporary code seams; staging and
  retained entry paths have explicit CT-A/Z lifecycle ownership. If implementation
  introduces a seam, amend its structured integration_pattern and
  finalization_responsibility before delivery. No broad cleanup of the host or
  dormant controller, new validator, extra ticket or acceptance shortcut.
- **split_criteria:** `fan-out-finalization-boundary`, `temporary-artifact-lifecycle`.
