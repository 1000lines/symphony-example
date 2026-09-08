# Review Agent Methodology

This optional workflow is for AI-assisted PR review. Symphony-managed PRs use
the mandatory [Cadence automation lane](./cadence-ai-review.md), which consumes
this methodology as review rubric input. It is separate from the
human-facing [Engineering Review Guide](./README.md) because agents need precise
axis prompts, issue-ledger conventions, and handoff formats that ordinary PR
authors should not have to read.

Repo-local scripts or personal tools may implement this workflow, but the
durable repo contract is the process below. Do not store private paths, secrets,
API keys, or machine-specific runtime details in repo docs.

## When To Use It

Use the review-agent workflow for PRs that are large, high-risk, AI-generated,
stacked, or hard to review with a single pass. It is especially useful when the
PR touches API contracts, data migrations, security boundaries, shared
architecture, or AI workflows with prompt/evidence behavior.

Small PRs can use the human guide directly.

## Boundaries

- The review agent reviews and coordinates; it does not edit application code
  unless a human explicitly asks.
- The PR remains the clean human-facing artifact.
- A linked GitHub issue is the ledger for the optional general review workflow.
  Cadence uses the linked Linear issue's single `## Cadence Workpad` for raw
  findings and action briefs; Symphony records responses in `## Codex Workpad`.
- Raw review detail goes to the applicable ledger. Cadence publishes a concise
  PR review with its reviewed SHA and workpad link; the general workflow's final
  verify pass may post one concise PR-facing outcome comment.
- Every agent finding gets a stable finding ID so follow-up agents can respond
  without relying on private context.
- Product judgment, unclear risk tolerance, missing credentials, and ambiguous
  deployment assumptions become human-needed items.

## Review Loop

1. Collect the PR, linked issue, intended base, head SHA, changed files, CI
   status, prior review comments, and stack context.
2. Run a PR-shape preflight. If the PR is too large or mixes unrelated work,
   produce a reshape brief before detailed axis review.
3. Select axes. Always consider reviewability, scope coherence, test/evidence,
   and backward compatibility. Add conditional axes based on the diff.
4. Run one bounded review per selected axis.
5. Post raw reviewer comments to the linked issue using visible metadata and
   stable finding IDs.
6. Read the raw comments back, deduplicate semantically, and produce one action
   brief for the coding agent.
7. The coding agent responds by finding ID with implementation evidence,
   rejection rationale, or human-needed questions.
8. Treat direct human review feedback as authoritative input. Human feedback
   does not need an AI reviewer to restate it before a coding agent can act.
9. For Cadence/Symphony handoffs, read the current `## Cadence Workpad` before
   acting on Cadence-driven rework, and read the current `## Codex Workpad`
   before Cadence re-review when Symphony's latest execution state matters.
10. Verify claimed fixes and update the issue ledger. Keep looping only while
    concrete high-value findings remain.

Cadence bounds this rubric to the changed end-to-end use cases: summarize the
PR, inspect functionality, performance, scalability, reliability, and security
where the diff affects them, load relevant area guidance, and prioritize
findings with concrete examples. It uses the current PR head and verifies fixes
in code or artifacts. Agent-only Cadence loops stop at the configured cap of
three; human feedback resets the loop. Review readiness requires current-head
checks and review evidence, not an approval attached to an older commit.

## Axis Prompt Pack

Use these prompts as compact agent instructions. Each reviewer may raise an
adjacent concern only when it is evidence-backed and not duplicative.

### Reviewability / PR Shape

Core question: can a human review this PR confidently as shaped?

Look for unrelated changes, mechanical churn hiding behavior changes, missing
review evidence, process-heavy PR bodies, titles that name construction history
instead of current behavior, generated files without explanation, and stack
changes in the wrong PR.

Stay in lane: do not block coherent large PRs only because they are large.
Escalate shape problems when they materially harm review confidence.

### Scope Coherence / Decomposition

Core question: does every change belong in this PR and stack position?

Look for opportunistic cleanup mixed with product behavior, API or architecture
changes beyond the stated scope, fixture rewrites that imply a broader
migration, child work in parent PRs, parent prerequisites in child PRs, and
unclear product ownership.

Stay in lane: allow small local cleanup when it makes the main change simpler
and easy to review.

### Test / Evidence

Core question: is the changed behavior proven at the right level?

Look for missing regression tests, happy-path-only coverage, brittle snapshots,
mock assertions that test implementation details, missing negative/fallback
cases, unexplained snapshot or fixture updates, nondeterministic eval fixtures,
open handles, and expensive validation that fails only after external calls.

Stay in lane: do not demand exhaustive or slow tests when a focused test proves
the behavior.

### Backward Compatibility

Core question: can existing callers, data, and deploy states keep working?

Look for changed defaults, removed fields, renamed keys, type changes, stricter
or looser validation, changed error shape, changed side effects, new required
arguments, and tests that only accept new behavior when old behavior remains
supported.

Stay in lane: intentional breaking changes are acceptable when the PR states the
contract, migration path, and rollout implications.

### Architecture Fit

Core question: does the change fit existing ownership boundaries and lifecycle
patterns?

Look for inverted dependencies, business logic in the wrong layer, duplicated
architectural mechanisms, one-off shared abstractions, bypassed validation or
persistence paths, mutable internal state escaping its owner, and stateful
clients without lifecycle behavior.

Stay in lane: do not redesign from first principles. Prefer narrow local
solutions unless they conflict with durable repo patterns.

### API Surface / Existing Usage

Core question: is the new or changed API surface necessary, and does it preserve
existing usage?

Look for new endpoints or service entry points that duplicate existing flows,
convenience wrappers that lose established flags or transitions, logic that
should hook into an existing handler, missing caller surveys, and assumptions
that a UI workflow requires a new API when existing APIs can support it.

Stay in lane: approve new surfaces when existing APIs genuinely cannot represent
the use case.

### DRY / Reuse

Core question: is duplication meaningful enough to drift, or is local clarity
better?

Look for copied behavior, reimplemented utilities, repeated policy constants,
duplicated test helpers, generic helpers with unclear ownership, and helpers
that erase domain meaning.

Stay in lane: do not treat all repetition as bad. Recommend reuse only when the
existing helper carries behavior, policy, configuration, lifecycle, or clear
ownership.

### Code Economy / Comment Discipline

Core question: does the PR add more surface area than the change justifies?

Look for obvious comments, comments that should be names, file headers that
narrate stack history, design-doc citations beside straightforward code,
verbose tests or fixtures, oversized prompt prose, generated-looking
scaffolding, and PR bodies that read like process logs.

Stay in lane: keep comments that explain non-obvious domain constraints, safety
boundaries, compatibility traps, or regression mechanisms.

### Dev / Prod Separation

Core question: are local, test, debug, and production paths kept separate?

Look for debug behavior reachable in production, fixtures imported by
production code, brittle environment checks, local paths or secrets, excessive
production logging, build config that includes eval/test code, and dev defaults
that can escape.

Stay in lane: do not demand elaborate config machinery when a small safe default
is enough.

### Security / Safety

Core question: does the change preserve trust boundaries and safe failure
behavior?

Look for missing permission checks, trusted client identifiers, unsafe parsing,
secrets in code or logs, broadened access without tests, SSRF, path traversal,
injection, XSS, CSRF, replay, confused-deputy risks, sensitive data persistence,
and failures that expose data or corrupt state.

Stay in lane: require a concrete path. If risk depends on policy or deployment
assumptions, classify it as human-needed.

### Documentation / API Clarity

Core question: can users, operators, and callers understand the contract?

Look for changed public behavior without docs, config without defaults or
constraints, unclear names, unrecoverable error messages, docs inconsistent with
implementation, and PR claims not reflected in durable docs or API text.

Stay in lane: do not ask for long prose when a short example, migration note, or
error message would solve the problem.

### Standing Docs / Current State

For workflow, review, instruction, skill, and operational docs, apply the
[standing-docs axis](../../../scripts/symphony/runtime-bundle/review-axes/standing-docs-current-state.md)
loaded by Cadence. Check claims against implemented behavior and durable sources.
Use `blocker` for planned or unwired behavior presented as current,
`should-fix` for migration narrative that ages poorly, `suggestion` for timeless
wording, and `human-needed` when current behavior cannot be established.

Transition history belongs in PR bodies, workpads, changelogs, or explicitly
dated planning documents. Do not treat an accepted historical plan as proof that
its implementation landed. A canceled PR is not a source for current behavior.

### Migration / Rollout

Core question: can the change deploy, roll back, and coexist safely?

Look for code that assumes migrations completed everywhere, non-idempotent
migrations, undocumented deploy ordering, cache or queue format changes, new
background work without retry or observability, feature flags without defaults
or cleanup, and stack PRs that cannot deploy independently when they need to.

Stay in lane: do not require rollout machinery for small internal changes with
no deploy-time compatibility risk.

### Requirement Coverage / Cross-PR Gaps

Core question: across a PR group, is every requirement owned by a PR, and do the
PRs fit together?

Look for requirements (from acceptance criteria or design docs) with no owning
PR, requirements partially covered or split across PRs without clear ownership,
interface/schema/event/config/migration seams where one PR produces what another
consumes, deploy-order assumptions between PRs, and the same behavior duplicated
across PRs.

Stay in lane: only assert a coverage gap against a stated requirement with a
source. Do not invent requirements. Classify ambiguous product scope as
human-needed.

## Reviewer Comment Format

Use visible Markdown metadata so humans can read the ledger without hidden
state:

```md
| comment id                             | role             | issue      | pr      | axis          | iteration   | head        | status     |
| -------------------------------------- | ---------------- | ---------- | ------- | ------------- | ----------- | ----------- | ---------- |
| `AR-<issue-or-pr>-<AXIS>-C<iteration>` | `codex-reviewer` | `#<issue>` | `#<pr>` | `<axis-slug>` | `<integer>` | `<git-sha>` | `proposed` |

### Codex <Axis Name> reviewer: AI Review

Summary:
<one to three sentences>

Findings:

1. **<finding-id> / <blocker|should-fix|suggestion|human-needed> / <low|medium|high> / confidence <0.00-1.00>**
   <concise finding>

   Evidence:

   - path/symbol: `<file-or-symbol>`
   - scenario: <diff fact, test gap, failure path, or repo convention>

   Suggested action:
   <smallest implementable next step>

Disposition:
pending
```

Finding classes:

- `blocker`: must fix before review can proceed
- `should-fix`: materially improves correctness, safety, reviewability, or
  maintainability
- `suggestion`: useful but not required unless accepted by the human or author
- `human-needed`: requires product, risk, credential, or deployment judgment

## Human-Grounded Follow-Up

When a human reviewer identifies required rework, treat that feedback as the
source of authority for the coding agent. AI reviewers may add same-class
follow-up only when it is directly grounded in the human comment and remains
inside the issue's scope.

Classify follow-up as mandatory only when it is needed to resolve the same issue
class, reviewer clarity gap, or in-scope requirement gap. Mandatory follow-up
belongs in `blocker` or `human-needed` findings and in the lead brief's required
work.

Classify follow-up as optional when it is speculative, nice-to-have, or outside
the current required outcome. Optional follow-up belongs in `should-fix` or
`suggestion` findings and should be labeled non-blocking unless a human reviewer
or the issue explicitly accepts it as required work.

For Cadence, keep the detailed evidence, same-class rationale, skipped events,
and AI-to-AI coordination in the Linear `## Cadence Workpad`. GitHub-visible
Cadence output remains a concise PR review assessment and never uses
`REQUEST_CHANGES`. Symphony should read that workpad as the authoritative
Cadence handoff before deciding what rework remains; Cadence should read the
`## Codex Workpad` during re-review when it needs Symphony's latest response,
validation evidence, or deferred-question context.

## Coding Agent Response Format

Coding agents should respond by finding ID:

```md
| comment id                              | role                    | issue      | pr      | responds to    | agent     | head        | status     |
| --------------------------------------- | ----------------------- | ---------- | ------- | -------------- | --------- | ----------- | ---------- |
| `CA-<issue-or-pr>-<agent>-C<iteration>` | `coding-agent-response` | `#<issue>` | `#<pr>` | `<finding-id>` | `<agent>` | `<git-sha>` | `<status>` |

### Coding Agent Response

Summary:
<one to three sentences>

Addressed:

- `<finding-id>`: <what changed or why not>

Evidence:

- <test command, commit, PR update, or reason no code change was made>
```

Use `implemented`, `partial`, `blocked`, or `question` for response status.

## Lead Agent Brief

After raw axis comments are posted, the lead agent should deduplicate them into
one brief with these buckets:

- Must Fix
- Should Fix
- Suggestions
- Do Not Act On
- Human Needed

The brief should say what to fix, what not to act on, and what evidence is
needed for verification. It should not ask the coding agent to keep patching a
PR shape that needs a split or rewrite; in that case, produce a reshape brief
instead.
