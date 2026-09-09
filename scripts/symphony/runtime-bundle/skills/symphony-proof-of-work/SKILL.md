---
name: symphony-proof-of-work
description: Collect Symphony proof-of-work evidence for Linear workpads and PR bodies without inventing validation. Use when a Symphony issue or PR needs evidence for UI, backend/API, workflow, deploy handoff, review readiness, missing-access handoff, or proof gaps.
---

# Symphony Proof Of Work

Use this skill to turn actual validation artifacts into a concise evidence
record. It does not run deploys or
manufacture proof.

## Read First

Before writing proof, read:

- The Linear issue, project metadata, current state, and `## Codex Workpad`.
- The PR title, body, base branch, head ref, head SHA, labels, assignee, and
  check status when a PR exists.
- `docs/engineering/symphony/proof-of-work.md`.
- The concrete artifacts produced by validation: command output, workflow runs,
  screenshots, recordings, logs, report URLs, or manual walkthrough notes.

If a required source or artifact is missing, name it and ask for the smallest
specific handoff. Do not substitute assumptions for proof.

## Boundaries

- Do not invent commands, URLs, workflow runs, SHAs, screenshots, recordings,
  human approvals, check results, or deploy outcomes.
- Do not claim UI coverage from docs-only review, unit tests, or
  workflow syntax checks.
- Do not paste secrets, tokens, passwords, customer data, private test data, or
  sensitive logs into Linear or GitHub.
- Do not run deploys or capture
  video unless the current ticket explicitly owns that action and credentials or
  approval are present.
- Treat manual screenshots, recordings, walkthrough notes, command excerpts,
  workflow runs, and artifact links as valid first-pass proof when they identify
  the target ref and acceptance criterion.
- Treat GitHub workflow-run URLs as first-class proof artifacts for checks,
  deploy handoffs, and expected preflight blockers.
- Reuse sibling PR proof from the same project color when
  it demonstrates the current ticket's target ref or acceptance criterion.

## Evidence Workflow

For repository changes, organize validation and evidence
**local → Docker if needed → mandatory CI**: run relevant tests locally first;
if they pass, skip Docker. Use containers only when the local environment cannot
run required tests, then always run CI on the published commit as the shared,
reviewable validation surface.
Record justified local/Docker skips and fix actionable test failures; do not
treat an unavailable toolchain as a failed assertion. Include the Docker image
digest and CI run/check links when used. Required CI still applies to small and
documentation-only changes; pending, missing, failed, canceled, or stale results
are not success. See the proof standard's `Validation Order` for the full rule.

1. List the ticket acceptance checks and handoff requirements the current
   checkpoint claims.
2. Match each claim to the proof item that directly demonstrates it.
3. Record each proof item with target ref, command or environment, acceptance
   criterion demonstrated, artifact location, result, known limitation, and next
   handoff.
4. If validation is partial, record what passed, what did not run, why it did
   not run, and the concrete handoff needed.
5. Update the Linear workpad proof section using `templates/workpad.md`.
6. Mirror the reviewer-relevant subset into the PR `## Tested` section when a
   PR exists. Preserve an existing `## Test plan` heading only when updating an
   older PR that already uses it.

## Proof Item Fields

Each proof item must include:

- **Target ref:** branch, commit SHA, PR head SHA, workflow run ref, composed
  validation ref, or deployed ref.
- **Command or environment:** local command, URL, GitHub workflow,
  API endpoint, or manual walkthrough context.
- **Acceptance criterion demonstrated:** the behavior, requirement, or handoff
  condition covered by this proof.
- **Artifact location:** Linear comment, PR section, screenshot path, recording
  link, workflow run URL, uploaded report, log excerpt, or command output.
- **Result:** pass, fail, blocked, skipped with reason, or human-verified.
- **Known limitation:** missing credential, untested
  browser, incomplete fixture data, partial environment, skipped suite, or
  `none`.
- **Next handoff:** none, reviewer action, human deploy, credential request, product decision, or another named ticket.

## Missing Proof

When no local proof can be produced, still write a complete proof item. Set the
result to `blocked` or `skipped with reason`, name the intended command or
environment, record the exact limitation, and make the next handoff concrete.
If a GitHub workflow run failed before validation because deploy evidence, credentials, or fixtures were missing, use that run URL as the
artifact location.

When a UI path cannot be exercised locally, record the blocked URL, user role,
feature flag, fixture, browser, or external service, plus any component/API
proof that did pass. Ask for a human walkthrough artifact, screenshot,
recording, or environment access for the specific path.

Missing proof can still be honest evidence. Hidden gaps are the failure mode.

## Sibling PR Proof

Before asking a reviewer to regenerate proof, check whether a recent sibling PR
with the same project color label already produced the artifact. Reference it
only when it covers the same target ref, deployed ref, environment, or
acceptance criterion. Record the sibling PR number or workflow run URL, the
shared project color or project issue set, and any limitation caused by newer
commits or narrower coverage.

## PR Shape

Use `## Tested` by default and keep it concrete:

```md
## Tested

- `npx prettier --check <paths>` - passed; validates Markdown formatting for
  the proof standard and skill template.
- Manual docs review on `<head-sha>` - passed; confirms the standard covers UI,
  backend/API, workflow, deploy, and composed project proof without
  requiring automated video capture.
```
