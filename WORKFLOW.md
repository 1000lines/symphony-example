---
tracker:
  kind: linear
  api_key: $LINEAR_API_TOKEN
  team_key: DEMO
  active_states:
    - Active
    - Evaluating
    - Todo
    - In Progress
    - Rework
  terminal_states:
    - Done
    - Closed
    - Canceled
    - Duplicate
  maturity_labels:
    - mature
  maturity_gate_state_scope:
    - Todo
    - Active
  daemon_states:
    - Happy
    - Unhappy
  daemon_dispatch_states:
    - Evaluating
  daemon_default_wake: 1h
  polling:
    interval_ms: 5000
workspace:
  root: ~/code/example-repo-symphony-workspaces
hooks:
  after_create: |
    test -n "${GITHUB_TOKEN:-}" || { echo "GITHUB_TOKEN is required; source scripts/symphony/setup-local-env.sh before starting Symphony"; exit 1; }
    test -n "${LINEAR_API_TOKEN:-}" || { echo "LINEAR_API_TOKEN is required; source scripts/symphony/setup-local-env.sh before starting Symphony"; exit 1; }
    test -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" || { echo "GOOGLE_APPLICATION_CREDENTIALS is required; source scripts/symphony/setup-local-env.sh before starting Symphony"; exit 1; }
    test -x "${GIT_ASKPASS:-}" || { echo "GIT_ASKPASS is required; source scripts/symphony/setup-local-env.sh before starting Symphony"; exit 1; }
    GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never git \
      -c credential.helper= \
      clone --branch main --depth 1 https://github.com/example-org/example-repo.git .
    git remote set-url origin https://github.com/example-org/example-repo.git
    # Supply repository setup in your own workflow profile when needed.
  before_remove: |
    true
agent:
  max_concurrent_agents: 3
  max_concurrent_agents_by_state:
    evaluating: 5
  max_turns: 20
codex:
  command: codex --enable apps --config shell_environment_policy.inherit=all --config 'model="gpt-5.5"' --config model_reasoning_effort=xhigh app-server
  approval_policy: never
  thread_sandbox: danger-full-access
  turn_sandbox_policy:
    type: dangerFullAccess
server:
  # host: 0.0.0.0
  host: "::"
  port: 4000
---

Hosted runtime note: the EC2 `symphony` user's canonical workflow source is
`scripts/symphony/runtime-bundle/workflow/WORKFLOW.md`. Host install renders
`/etc/symphony/WORKFLOW.md` from that bundle source, not from this root file.

You are working locally through Symphony on Linear issue `{{ issue.identifier }}`.

Issue context:

- Identifier: {{ issue.identifier }}
- Title: {{ issue.title }}
- Current status: {{ issue.state }}
- Labels: {{ issue.labels }}
- URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

## Issue Goal

The Linear issue and its project description define the actual work. Implement
that software-engineering change directly and keep scope tied to the ticket.

## Symphony Operating Contract

Symphony is the execution harness: isolated workspace, Linear/GitHub state
transitions, PR evidence, CI, and human handoff. Reuse existing shared planning
tooling, including `tools/symphony-dag/` for DAG validation and payload rendering.
Raise process gaps through the PR proposal guidance below; do not change
Symphony's planning/review process or build parallel project-local planning
infrastructure without human direction. Project-specific implementation tooling
within the reviewed project scope, such as extraction redaction generators,
remains allowed.

## Harness Entry Point

Before planning or editing, read the shared
`.agents/skills/karpathy-guidelines/SKILL.md` and the specific docs or
package-level files that the issue asks for directly. Hosted Symphony's personal
instructions and private skills are installed from
`scripts/symphony/runtime-bundle/`; consume the installed skills without copying
them into common repo discovery paths.

Do not use legacy `AGENTS.md` or `CLAUDE.md` as default instruction sources.
Only open them when the issue explicitly asks for historical context from those
files.

## Project Metadata

Each Linear project using this workflow should include a short metadata field
near the top of the project's detailed description/content:

```yaml
project-code: short-project-code
project-color: pink
base-branch: main
human-lead: Full Name
```

Use a short, manually chosen `project-code` instead of Linear UUIDs or generated
URL slugs. This code becomes the project segment in Symphony branch names and
should be stable for the life of the project.

Use a short `project-color` that names the GitHub label for this project's PRs,
for example `pink`, `blue`, or `green`. The color label lets humans visually
distinguish multiple active Symphony projects in GitHub. It may be recycled for
a new project after the current project finishes.

`base-branch` is optional and defaults to `main`. It names the branch Symphony
uses for clean task branches and GitHub PR bases. Record the selected base
branch in the Codex workpad and PR body for each task.

`human-lead` names the single human responsible for generated tickets and PRs
in the project. Symphony should assign spawned Linear issues to the matching
Linear user and assign or request review from the matching GitHub user on PRs
when that identity is known. If the identity cannot be resolved, record the
specific missing mapping in the workpad before asking for human input.

Project setup is incomplete until `project-code`, `project-color`, and
`human-lead` are recorded. `base-branch` is optional, but when provided it
becomes part of the execution contract for ticket branches, validation, and
handoffs. Keep generated tickets out of implementation states until required
metadata exists; do not start from inferred metadata alone.

Symphony selects work by Linear team and active state. Any issue in a
processable state is eligible; `project-code` controls branch naming and
`project-color` controls PR labeling. Symphony reads project metadata from the
Linear project description/content first, then from explicit issue or fan-out
metadata when the project field is absent. PR labeling requires `project-color`
from the owning Linear project's description/content; the issue/fan-out fallback
applies only to other metadata fields.

## Linear Workflow States

Symphony uses these state meanings:

- `Active`: the issue can be worked now. It covers implementation and rework.
- `Inactive`: the issue is waiting for something outside the worker slot. It
  covers CI, deploy, AI review, human review, and missing-input waits.
- `Happy`: daemon-managed project monitoring is healthy and waiting for the next
  timer.
- `Unhappy`: daemon-managed project monitoring found a condition that prevents
  closing the project yet.
- `Done`: accepted work is complete.
- `Canceled`: work was intentionally stopped.
- `Duplicate`: work is represented by another issue.

`Backlog` is outside the active pool. `Evaluating` is the configured daemon
dispatch state. The runtime also accepts legacy workable states `Todo`,
`In Progress`, and `Rework`; legacy waiting names include `Waiting for CI`,
`In Review`, and `Human Input Needed`. The DEMO team has `Active` and `Inactive`,
so agents use them for work and external waits. Record any other team's fallback
in the workpad. Bridges prefer `Active` and use only `Rework` when `Active` is
absent; missing both is a visible failure, not an arbitrary started-state choice.

Waiting on another ticket uses the accepted hard blocker relations. Waiting on
CI, review, or input uses `Inactive`. Optional `waiting:ci`,
`waiting:ai-review`, and `waiting:human` labels are hints that can become stale;
they are not workflow states or prerequisites for a wakeup. Detailed state and
event rules are in `docs/engineering/symphony/project-workflow.md`.

## GitHub Wakeups And Review Handoffs

Cadence's event router requests review of the current PR head after Symphony
pushes and human feedback. The review handoff bridge wakes the linked issue for
actionable Cadence output, human review summaries, and nonempty human PR
comments. Clean Cadence approval and human-needed findings request review from
eligible PR assignees; the bridge records a routing gap if none exists. Human
approval with notes receives a Cadence re-look without directly waking Linear.

The non-review bridge wakes issues for failed required checks on the current PR
head, confirmed merge conflicts, and issue-scoped dispatched workflow
completions. Identity resolution uses a PR title prefix, then the branch.
Successful ordinary CI checks do not cause this bridge to wake an issue. See
the project workflow for scope and freshness checks before interpreting a
completion as a wakeup.

Review and non-review state bridges preserve terminal `Done`, `Canceled`
(including `Cancelled`), and `Duplicate` issues and terminal Linear categories.
They record actual mutation results or skips in `## Cadence Workpad` and the
workflow run summary. A failed, stale, or canceled workflow does not authorize
reopening a terminal issue. Human or accepted merge automation owns final
acceptance; a wakeup is not acceptance or proof that validation passed.

## Project Branching Model

Task branches start from the selected `base-branch` and open PRs against that
same branch. When no `base-branch` is configured, use `main`. Graph edges,
sequencing notes, and soft dependencies do not change branch ancestry.

Do not commit predecessor work that is not already on the selected base branch.
If a ticket cannot be compiled, tested, or reviewed without upstream code,
record the exact dependency in the workpad and stop until the upstream work
lands or the accepted plan supplies a hard blocker or explicit temporary seam.
Project state is the selected base branch plus the task PRs named in the
accepted plan.

For dependency language in project fan-out plans, `must land first` and `should
land first` mean merged to the selected base branch only when the accepted plan
marks the dependency as hard. Otherwise, record the dependency as sequencing
guidance and keep Linear blocker relations limited to hard DAG edges.

## DAG Planning Contracts

DAG fan-out is the default planning shape. Use a sequential or linear plan only
when the human request, project description, accepted plan, or source document
explicitly asks for a linear plan or asks to avoid a DAG. Even moderately
complex projects should preserve their dependency topology as a DAG instead of
flattening it into a sequential ticket list.

For DAG planning or replanning tickets:

- Include a reviewed Mermaid graph, marked with `%% symphony-dag/v1`, both in
  the plan and as a standalone `.mmd` document. Treat graph diffs as the
  reviewable unit for topology changes.
- Emit exactly one `symphony-dag-manifest/v1` block covering project metadata,
  defaults, nodes, edges, node types, branch declarations, PR policies, maturity
  defaults, direct relation semantics, and decisions. Do not
  emit v1-only generated join artifacts, `base_node`, `stack_policy`,
  `stack:*`, branch-base exceptions, rebase-on-land, or neutralization fields.
- Include a branch manifest for every task branch. Task branches must declare
  the selected `base-branch` as both branch base and PR base, open draft PRs by
  default, and remain clean of committed predecessor work that is not on the
  selected base branch.
- Include a first-class Decisions section for architectural or workflow calls
  that future tickets must enforce, with rationale and the ticket or artifact
  responsible for each decision.
- Include one direct Linear relation payload for every hard DAG edge. Fan-in is
  represented by multiple direct blocker-to-blocked payloads to the downstream
  issue. Do not create no-op join tickets or generated join branches.
- Preserve relation direction exactly: `issueId` is the blocker,
  `relatedIssueId` is the blocked ticket, and `type` is `blocks`.
- Keep branch ancestry out of DAG plan data. Graph edges drive dispatch and
  relation payloads only; they do not change task branch bases.
- Record draft/ready transition, current-SHA review requirement, and
  fail-closed behavior for missing labels, states, SHAs, or relation targets.

For coding tickets spawned from a DAG plan:

- Treat `mature` as a label on the blocker issue, not the dependent and not the
  graph edge.
- Set `mature` only when required checks for the current PR head pass, Cadence
  or the configured reviewer approves that current head, and the PR is marked
  ready for human review from its draft state.
- Remove `mature` only when request-changes review, rejected acceptance
  evidence, or a similarly severe regression makes downstream work unsafe.
  Ordinary review rework does not remove maturity by itself.
- If the agent cannot apply or remove a required `mature` label, record the
  exact label/API failure in the workpad, move to `Inactive`, and stop
  unless the failure is transient infrastructure.

## Execution Rules

- Work only in the per-issue workspace created by Symphony.
- Use Symphony's injected `linear_graphql` tool for Linear reads and writes.
  If `linear_graphql` is unavailable before the Codex workpad is pinned, fail
  closed and do not update another comment.
- At the beginning of every hosted issue turn, after fetching the Linear issue,
  state, and comments but before planning, prerequisite checks, repository work,
  blocker handling, or state classification:
  1. Find the active comment whose first non-blank line is exactly
     `## Codex Workpad`.
  2. If none exists, immediately create a minimal `## Codex Workpad` comment.
  3. Persist that comment ID for the turn and write all plans, progress,
     failures, questions, and handoffs only to that pinned ID.
  4. Never select or update `## Symphony Workpad`; it is engine-owned and may
     be replaced with `Last run ...` after the agent exits.
  5. If the Codex workpad cannot be created or updated, fail closed. Do not
     fall back to the Symphony workpad, similarly named headings, or another
     arbitrary comment.
- Only after the Codex workpad ID is pinned, determine the issue's current
  Linear state and whether it is workable, waiting, daemon-managed, terminal,
  or a legacy compatibility name.
- Use `Active` for implementation and rework when the team supports it. If the
  team still uses legacy states, preserve their compatibility transitions:
  `Todo` may move to `In Progress` before the first PR, and post-PR work driven
  by CI, review comments, PR comments, or validation uses `Rework`.
- If a legacy `In Progress` issue already has a linked PR, treat it as post-PR
  work: move it to `Active` (legacy `Rework` only if needed), inspect the linked
  PR and feedback, then follow the rework rules below.
- Keep a single pinned Linear workpad comment headed `## Codex Workpad`.
- State assumptions and success criteria before coding.
- Before creating a task branch or PR, select the project base branch from
  `base-branch` or `base_branch` metadata and default to `main` when the field
  is absent. Record the selected base branch in the Codex workpad.
- Before spawning Linear issues or opening PRs, identify the project
  `human-lead` from project metadata or explicit issue/fan-out metadata. Assign
  generated Linear issues and GitHub PRs to that human lead when the matching
  Linear/GitHub identity is known.
- Treat Linear states as the execution contract:
  - `Active`: implementation or rework may run now.
  - `Inactive`: CI, deploy, review, human input, or another external event is
    pending and the issue should not consume a worker slot.
  - `Happy`: daemon monitoring is healthy and waiting for the next timer.
  - `Unhappy`: daemon monitoring has work or evidence that prevents closing the
    project yet.
  - `Done`, `Canceled`, and `Duplicate`: terminal states.
- Treat legacy waiting states such as `Waiting for CI`, `In Review`, and
  `Human Input Needed` as `Inactive`. Treat legacy workable states such as
  `Todo`, `In Progress`, and `Rework` as compatibility forms of `Active`.
- Do not resume feature implementation from `Inactive` or legacy waiting states.
  Inspect the linked PR, checks, deploy, review, or human-input blocker and take
  the smallest appropriate transition.
- If the issue is already in `Rework`, inspect the linked PR before coding.
  Treat actionable human review comments as normal rework input, including
  review bodies that have no inline file comments.
- On rework, collect all GitHub PR feedback surfaces before deciding there is no
  actionable review feedback. Do not rely on `gh pr view --json
latestReviews`; it can miss submitted review-summary comments. For the linked
  GitHub PR, run all of:
  - `gh api repos/OWNER/REPO/pulls/PR_NUMBER/reviews --paginate` for submitted
    review summaries such as `COMMENTED`, `CHANGES_REQUESTED`, and `APPROVED`
    reviews;
  - `gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments --paginate` for inline
    review comments;
  - `gh api repos/OWNER/REPO/issues/PR_NUMBER/comments --paginate` for top-level
    PR conversation comments;
  - a thread-aware `gh api graphql` query for `reviewThreads` so resolved,
    unresolved, and outdated inline threads are understood correctly;
  - `gh pr view PR_NUMBER --json body,statusCheckRollup,reviewDecision` for the
    current PR body, required checks, and review decision.
- On rework, also read the current Linear issue comments. Treat human comments
  created or updated after the latest `## Codex Workpad` update as rework input,
  and do not return to waiting review until each fresh comment is addressed,
  deferred with rationale, or blocked with a specific question in the workpad.
- Summarize the GitHub and Linear feedback sources checked in the Linear
  workpad, including whether each source had actionable comments.
- Treat direct human GitHub comments and reviews as authoritative rework input.
  Cadence does not need to restate the same finding before Symphony acts on it.
  When the human comment reveals a broader expectation that still fits the
  issue or project intent, the smallest appropriate action may include
  same-class fixes, adjacent-location fixes, documentation updates, or
  reviewer-facing clarity improvements.
- Before returning to review, update the Codex workpad review-comment ledger so
  incoming, addressed, deferred, and blocked comments are each accounted for.
- On rework, take the smallest appropriate action:
  - if review feedback or failed checks are mechanical or clearly actionable,
    implement the fix or update the PR/workpad, push if code changed, and move
    to `Inactive` when checks are pending;
  - if the rework was metadata-only and required checks are already passing,
    update the workpad and move back to waiting review;
  - if review feedback requires product judgment, credentials, environment
    access, or ambiguous decisions, ask the specific question in the workpad,
    move to `Inactive`, and stop;
  - if no actionable feedback is found and checks are passing, record that in
    the workpad and move back to waiting review.
- If required requirements, credentials, environment details, or product
  decisions are unclear, ask the specific question in the workpad, move the
  Linear issue to `Inactive`, and stop.
- Treat ordinary project sequencing dependencies separately from true blockers.
  Use Linear `blockedBy` only for hard blockers. For soft fan-out ordering,
  record dependencies in the issue or project fan-out plan.
- If a dependency is not satisfied and the current issue cannot make independent
  progress, record `Waiting on dependency` in the workpad and stop without
  moving to a human-input wait unless the wait requires a human decision.
- Treat unreadable linked source material as a missing requirement. If an issue,
  project, comment, attachment, design doc, Google Doc, or other referenced
  planning source cannot be accessed because of authentication, authorization,
  a 401/403/404, or missing local tooling, do not substitute weaker context and
  continue. Record the exact source and failure in the workpad, ask for access
  or a pasted copy, move the Linear issue to `Inactive`, and stop
  unless the issue explicitly marks that source as optional.
- If the issue is already waiting on CI or review, do not resume feature
  implementation. Inspect the linked PR and GitHub checks, then take the
  smallest appropriate action:
  - first inspect the linked PR `createdAt`, the current Linear issue priority,
    and whether other issues are available in `Active` or legacy workable
    states;
  - if checks are still running, the PR was created less than 20 minutes ago,
    the issue priority is neither `Urgent` nor `High`, and other eligible work
    is available, do not sleep in this turn. Update the workpad with the
    pending check names and the decision to defer CI polling, keep the issue in
    `Inactive`, and stop so the worker slot can be used for other work;
  - if checks are still running, sleep for 5 minutes in this same turn, then
    check GitHub again;
  - if checks are still running after the 5 minute sleep, update the workpad
    with the latest pending check names, keep the issue in `Inactive`, and stop;
  - if checks failed and the fix is mechanical or clearly implied by the
    failure, move the issue to `Active`, make the fix, push it, update the
    workpad, and then move the issue back to `Inactive`;
  - if checks failed but the fix requires product judgment, credentials,
    environment access, or ambiguous decisions, ask the specific question in
    the workpad, move the issue to `Inactive`, and stop;
  - if all required checks are passing, update the workpad and move the issue
    to waiting review.
- Make surgical changes only. Do not refactor adjacent code unless required.
- Prefer targeted validation over broad monorepo validation.
- If writing, reviewing, or refactoring code, apply the karpathy-guidelines skill.
- Commit only intentional changes.
- Batch publishing within a work loop. Multiple local commits are fine while
  iterating, but do not push after each commit. Finish the intended changes,
  run targeted validation, update the PR/workpad text as needed, then push the
  branch once for that checkpoint. Make another push only after new external
  feedback, CI results, or validation findings require another local fix.
- Name branches `symphony/<project-code>/<ticket-id>/<free-text>`, where
  `<project-code>` comes from the Linear project description/content and
  `<ticket-id>` is the Linear issue identifier such as `DEMO-22`.
- Push a branch and open a draft PR when implementation is ready for review.
- Set PR titles to `[<ticket-id>]: <brief-title>`, for example
  `[DEMO-22]: reorganize PR review docs`.
- Do not use another task branch as a PR base. Branch from the selected base
  branch, open PRs against that branch, and keep each ticket's diff file-level
  independent from other open Symphony PRs. Base-branch metadata is not a reason
  to change PR ancestry. If a ticket appears to require another task branch as
  its PR base, record the conflict in the workpad, move to `Inactive`, and
  ask for an accepted plan or base-branch clarification.
- Every Symphony-managed PR requires both `symphony` and the owning Linear
  project's `project-color` GitHub label, even when project text does not repeat
  `symphony`. Preserve existing labels and apply additional project-required
  labels from project or fan-out metadata.
- Read `project-color` from the owning Linear project's description/content.
  Do not infer it from a branch name, issue label, or a default. Missing or
  conflicting project metadata is a labeling failure.
- Apply and verify the two shared labels with
  `node scripts/symphony/ensure-pr-labels.mjs --issue TEAM-123 --repo OWNER/REPO`,
  substituting the current issue and intended repository. The helper verifies a
  unique open PR association, checks missing labels exist, adds them, and reads
  them back. A `no-open-pr` result does not complete publishing when a PR was
  expected; resolve the association before handoff.
- For additional required labels, use GitHub's narrow REST endpoints: confirm
  each exists with `gh api repos/OWNER/REPO/labels/LABEL`, then add with
  `gh api --method POST repos/OWNER/REPO/issues/PR_NUMBER/labels -f 'labels[]=LABEL'`.
  URL-encode label names in paths. Avoid `gh pr edit --add-label`, which can
  require broader organization queries. Do not create missing labels, replace
  the label set, or expand token scopes.
- Before claiming publishing or handoff complete, read back the actual labels
  with `gh api repos/OWNER/REPO/issues/PR_NUMBER/labels --paginate --jq '.[].name'`
  and verify `symphony`, `project-color`, and every additional required label.
  Record the verified result or actual API/readback failure in the Codex
  workpad; intended future actions are not evidence. Handle missing metadata,
  missing labels, or API failures through the existing blocker handling.
- Hosted `hooks.after_run` invokes the same helper as a best-effort safety net.
  Hook failures are logged and ignored by Symphony. Automatic repair is not
  evidence that labeling succeeded, an immediate PR-created event hook, a strict
  review/merge gate, or a crash-proof guarantee. It does not change Linear states.
- Assign the PR to the project `human-lead` when the GitHub identity is known.
  Request human review only after Cadence and Symphony reach closure, or after
  the deterministic review-loop cap is reached and the remaining question is
  summarized for the human reviewer.
- PR bodies are for human reviewers. Start the `Summary` with a short
  product/change sentence intelligible without Symphony or Linear context, then
  explain only the context needed for review. Detailed implementation run
  state, Symphony process state, and AI-to-AI coordination belong in the Linear
  workpad unless a human reviewer needs them to assess the PR.
- PR bodies must include:
  - a `## Summary` section with the big-picture context first, then concise
    implementation bullets; and
  - a `## Test plan` or `## Tested` section with concrete validation evidence;
    and
  - the selected base branch.
- If existing tooling or instructions expose a process gap, add a
  `## Proposed process change` section to the PR body. Describe the gap, its
  impact, and the smallest suggested improvement. Do not implement the process
  change, create tickets for it, or build a project-local substitute without human
  direction. Continue the assigned work where possible, stating any validation
  limitation and reporting actual blockers.
- Include the section only for an actual proposal; do not invent proposals or add
  empty sections. The human reviews the suggestion and decides whether to
  commission it, for example by requesting a Misc ticket. A proposal is advisory,
  not a new acceptance gate, and does not block otherwise valid assigned work.
- After opening or updating a PR, move the Linear issue to `Inactive` while
  checks are pending.
- After required checks pass, keep the issue waiting while Cadence or another
  configured AI review gate runs.
- Keep the Linear issue waiting for human review only after the PR is linked,
  validation evidence is recorded in the workpad, required GitHub checks are
  passing, and either AI review is not configured or AI review recorded no
  actionable findings. AI findings with known fixes move to `Active`; missing
  evidence, credentials, or decisions keep the issue `Inactive`.

## Blockers

Stop and record a blocker in the workpad if any required local prerequisite is
missing, including:

- Linear write access
- GitHub clone, push, or PR access
- Codex app-server availability
- local service/database isolation required by the ticket
- required secrets or credentials
- access to issue/project source documents that define requirements, including
  linked design docs, Google Docs, specs, attachments, or referenced planning
  documents

When recording a blocker, move the Linear issue to `Inactive` unless the
blocker is transient infrastructure that should simply be retried later.

Do not invent cloud fallbacks. This project is explicitly for local Symphony
execution.

## Google Drive Source Documents

Local Symphony must read required Google Docs through the bot-owned service
account exposed by the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

When a Linear issue, project, comment, PR body, or fan-out plan links a required
Google Doc, read it before planning or implementation with:

```bash
node scripts/fetch-google-doc.mjs <google-doc-url-or-id>
```

Do not use a personal Google identity or manually copied snippets as a fallback
for a primary source document. If the helper cannot read the doc because of
authentication, sharing, API, tab-read, or tooling failure, handle it as an
unavailable source document below.

## Unavailable Source Documents

When a referenced source document cannot be read, treat it as blocking if it
could define requirements, acceptance criteria, implementation scope, or
validation evidence. A Linear summary, project summary, or secondary attachment
is not a replacement for an unreadable primary source.

For this blocker:

1. Record `Unavailable source` in the workpad with the document name or URL, the
   access method attempted, and the exact failure such as `HTTP 401`.
2. Ask the specific access question in the workpad, for example: "Please grant
   access to the linked Google Doc or paste its contents into Linear."
3. Move the Linear issue to `Inactive`.
4. Stop without planning or implementing from partial context.
