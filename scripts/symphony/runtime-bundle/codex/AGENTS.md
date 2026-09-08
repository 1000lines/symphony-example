# Hosted Symphony Codex Runtime

These instructions are installed as the personal `AGENTS.md` for the hosted
Symphony `symphony` user. They apply to unattended Symphony issue work, not to
ordinary developer checkouts.

## Instruction Priority

Follow system and developer instructions first. For Symphony project work,
fresh human input outranks initial bot-written instructions when they conflict:

1. Fresh human GitHub submitted reviews, inline review comments, and top-level
   PR comments on the current PR.
2. Fresh human Linear issue comments created or updated after the latest
   `## Codex Workpad` update.
3. The current Linear issue description, project metadata, accepted fan-out
   plan, and required source documents.
4. Bot workpads, Cadence summaries, generated branch metadata, and earlier
   automation notes.

When fresh human input asks for an in-scope change, do it. If it conflicts with
generated ticket text, bot workpads, or earlier automation notes, treat the
human input as the newer requirement and make the smallest coherent update. Stop
for a workpad question only when the request needs product judgment, missing
credentials, unavailable source material, or an unsafe state transition.

## Runtime Boundaries

- Work only in the per-issue workspace provided by Symphony.
- Use the injected `linear_graphql` tool for Linear reads and writes when it is
  available. If Linear write access is missing before the Codex workpad is
  pinned, fail closed and do not update another comment.
- Keep one Linear comment headed `## Codex Workpad` per issue. Record selected
  base branch, source reads, validation evidence, PR/check status, and any
  state fallback such as `Waiting for CI` for `Pause`.
- Branch from the project `base-branch` and open PRs against that base. Do not
  use a predecessor branch as the task PR base.
- Do not commit predecessor work that is not already on the selected base branch
  into a task branch. When upstream state is needed as context, read the linked
  PRs, issues, or source files and keep the task branch reviewable against the
  selected base.
- Do not install the human-only `symphony-project-factory` skill in the default
  unattended hosted runtime profile.
- Do not expose, print, commit, or forward secrets.

## Codex Workpad Startup

At the beginning of every hosted issue turn, after fetching the Linear issue,
state, and comments but before planning, prerequisite checks, repository work,
blocker handling, or state classification:

1. Find the active comment whose first non-blank line is exactly
   `## Codex Workpad`.
2. If none exists, immediately create a minimal `## Codex Workpad` comment.
3. Persist that comment ID for the turn and write all plans, progress,
   failures, questions, and handoffs only to that pinned ID.
4. Never select or update `## Symphony Workpad`; it is engine-owned and may be
   replaced with `Last run ...` after the agent exits.
5. If the Codex workpad cannot be created or updated, fail closed. Do not fall
   back to the Symphony workpad, similarly named headings, or another arbitrary
   comment.

## Review And Evidence

Before returning a PR to review, collect the required local validation and record
proof with target ref, command or environment, acceptance criterion, artifact
location, result, known limitation, and next handoff. Do not claim deploy,
workflow, screenshot, approval, or check evidence unless it exists.
