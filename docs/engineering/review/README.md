# Engineering Review Guide

This is the repo-level guide for human PR authors and reviewers. It describes
the evidence a PR should provide and the review axes that should be considered
before code is accepted.

This guide is not a branch-specific explainer and not an agent runtime prompt.
AI-assisted review guidance is split between the general
[Review Agent Methodology](./review-agent-methodology.md) and the
[Cadence AI Review Automation](./cadence-ai-review.md) workflow for
Symphony-managed project PRs. Supply repository-specific history separately when
it is relevant to a review.

## Audience Boundary

Use this guide for ordinary human onboarding and PR review. Keep active review
docs focused on durable principles, expected evidence, and current repo
contracts.

Use the Cadence AI review automation doc only for Symphony-managed AI review
workflow configuration and state transitions. Cadence is mandatory for
Symphony PRs that carry the `symphony` label, but it is not yet a general
review service for non-Symphony work. Human reviewers should not need that
automation contract to review an ordinary PR.

Cadence keeps detailed run state, trigger decisions, skipped events, and
AI-to-AI coordination in the Linear
[`## Cadence Workpad`](./cadence-linear-workpad.md). GitHub-visible Cadence
output is a concise PR review assessment for humans. Symphony reads the
Cadence workpad to understand the current review state before acting on
Cadence-driven rework; Cadence may read the `## Codex Workpad` during a
re-review to understand what Symphony changed, validated, or deferred. Actor
authority for this boundary is defined by the
[GitHub Actor Classification](./github-actor-classification.md) contract,
including the `humans` and `ai` GitHub teams.

Do not add branch-only review guides to this area unless they have been
rewritten as stable architecture or workflow references. If a historical guide
contains current system knowledge, promote the durable parts into the owning
domain doc and leave branch archaeology in the archive.

## What A PR Should Provide

Every non-trivial PR should make review evidence easy to find:

- **Scope summary:** the problem, current behavior, changed behavior, and
  explicit non-goals.
- **Review map:** changed subsystems, important files, and a suggested review
  order when the diff is large or crosses layers.
- **Validation evidence:** exact commands run in the PR's `## Test Plan` or
  `## Tested` section, CI checks relied on, manual scenarios exercised, and any
  screenshots, traces, logs, or fixtures needed to evaluate user-visible
  behavior.
- **Risk notes:** compatibility, migration, rollout, security, permissions,
  data handling, performance, model cost, or operational assumptions.
- **Known limits:** intentional gaps, follow-up work, and human decisions that
  should not be hidden in implementation details.

For docs-only PRs, evidence can be narrow: link checks, formatting checks, a
diff review, and confirmation that application code was not changed.

## Review Axes

Review axes guide attention. They do not replace judgment, and they should not
turn into preference comments without evidence.

### Scope Coherence

Ask whether the PR has one clear purpose and whether each changed line supports
that purpose. Look for opportunistic cleanup, unrelated refactors, stack work in
the wrong PR, or optional polish that should be a follow-up.

Expected evidence:

- a concise scope statement and non-goals
- clear stack position when the PR depends on adjacent PRs
- explanation for any cleanup included with feature work

### Reviewability

Ask whether a reviewer can understand the change without reconstructing branch
history. Large PRs are acceptable when the shape is coherent, but they need a
review map and stronger evidence.

Expected evidence:

- title and description describe the current artifact, not process history
- generated or mechanical changes are called out separately
- suggested review order for multi-layer changes

### Test And Evidence

Ask whether the validation matches the behavior and risk being changed. Prefer
focused tests and concrete manual proof over broad commands with no explanation.

Expected evidence:

- automated tests for changed behavior, regressions, edge cases, and fallback
  paths where relevant
- local command output or CI check names
- manual scenarios for UI, integration, AI workflow, or operational behavior
- explicit rationale when tests are intentionally not added

### Documentation And API Clarity

Ask whether users, operators, and callers can understand the new contract. This
includes API names, configs, schemas, CLI behavior, error messages, examples,
and durable docs.

Expected evidence:

- docs or examples for public behavior changes
- clear defaults, constraints, and migration notes for config or API changes
- PR description claims that match implementation and docs

### Security And Safety

Ask whether the change affects authentication, authorization, tenant isolation,
secrets, inputs, external calls, logging, file handling, subprocess execution,
or sensitive data.

Expected evidence:

- permission or isolation tests for changed access paths
- explanation of trusted and untrusted inputs
- confirmation that secrets and sensitive data are not logged or persisted
- rollback or failure-mode notes when unsafe partial state is possible

### Migration And Rollout

Ask whether old and new code can coexist safely during deploys, migrations,
background jobs, queue/caches changes, or staged feature rollout.

Expected evidence:

- deploy-order, rollback, and compatibility notes
- idempotent migration behavior where applicable
- feature flag defaults, rollout plan, and cleanup owner
- observability or retry behavior for new background work

### Code Economy

Ask whether the PR adds more code, comments, fixtures, prompts, or scaffolding
than the change justifies. The goal is lower review and maintenance surface, not
aesthetic minimalism.

Expected evidence:

- comments explain non-obvious constraints rather than restating code
- tests and fixtures are no larger than needed to prove behavior
- new abstractions have real callers or match an established local pattern
- PR body avoids work-in-progress narration once the review artifact is ready

### Compatibility And Existing Usage

Ask whether existing callers, serialized data, schemas, events, configs, or
integration contracts keep working. New APIs should be justified against nearby
existing endpoints, services, handlers, events, and helpers.

Expected evidence:

- caller survey for changed public or shared interfaces
- compatibility tests or migration notes for old behavior
- explanation when a new surface is necessary instead of extending an existing
  path

### Architecture Fit And Reuse

Ask whether the change respects package boundaries, state ownership, lifecycle
rules, dependency direction, and established mechanisms. Reuse matters when an
existing helper carries policy or lifecycle; local clarity matters when
duplication is small and domain-specific.

Expected evidence:

- references to same-domain precedent when adding durable mechanisms
- explanation for new shared abstractions
- proof that production code does not depend on test-only helpers, fixtures, or
  local tooling

## Evidence By Change Type

- **UI changes:** provide focused component tests or screenshots, plus manual
  flows for interaction, navigation, loading, error, and responsive states.
- **API or service changes:** provide unit or integration tests for success,
  error, permission, and compatibility paths.
- **AI workflow or prompt changes:** provide fixtures, evals, traces, or manual
  examples that show grounding, fallback behavior, latency/cost expectations,
  and citation or evidence integrity.
- **Data or migration changes:** provide migration dry-run or targeted tests,
  deploy ordering, rollback notes, and compatibility behavior during mixed
  versions.
- **Security-sensitive changes:** provide auth, tenant isolation, validation,
  logging, and secret-handling evidence.
- **Docs-only changes:** provide formatting/link validation and a docs-only diff
  review.

## Review Findings

Good findings are grounded, actionable, and small enough to implement. Include:

- the path, symbol, scenario, or test result that proves the concern
- the user, operator, security, compatibility, or maintenance impact
- the smallest safe next action
- whether the issue is a blocker, should-fix, suggestion, or human decision

Avoid free-floating preference comments. If product intent, deployment topology,
or risk tolerance is unclear, label the item as human-needed instead of guessing.
