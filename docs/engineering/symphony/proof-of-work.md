# Symphony Proof-Of-Work Standard

Symphony project tickets must leave reviewable evidence for what was validated,
where it was validated, and what still needs a human or later ticket. Proof of
work is a product reliability artifact: reviewers should not have to infer
coverage from branch names, broad claims, or hidden local state.

## Validation Order

For repository changes, validate in this order:

1. **Local:** run relevant, targeted checks with the tools already available on
   the worker host. Start with inexpensive checks that give useful feedback.
2. **Docker fallback:** if the relevant tests pass locally, skip Docker. Use
   the repository's container setup or a suitable pinned toolchain image only
   when required checks cannot run in the local environment, for example because
   tools or services are missing. Try that fallback before deferring to CI.
3. **CI:** publish the prepared change and run/inspect required repository CI on
   that exact commit, including small and documentation-only changes. Record
   workflow/run links and results. CI is mandatory because it is the shared,
   reviewable validation surface; local or Docker success does not replace it.

Use this order to get feedback before publishing, not to repeat identical tests
without useful coverage. Record `Docker: skipped — passed locally` when local
tests pass. If either environment is unavailable, record why and continue to
the next viable stage. Fix actionable
test failures before publishing, rerun affected checks, and distinguish an
environment limitation from a failing assertion. Do not install every toolchain
on the host or build new test infrastructure merely to satisfy the sequence.

Each implementation ticket should name the applicable local commands, Docker
command/image (or justified skip), and CI workflow/checks. Workpad and PR proof
should report these stages in order, with the tested SHA, actual outcome, and
limitations. Missing CI configuration, pending/failed/canceled runs, or results
for an earlier commit are not passing evidence; record the gap or wait using
the existing issue workflow. Metadata-only tickets with no repository change
record API readback evidence instead of manufacturing a code/CI change.

## Required Evidence Fields

Every proof item in a Linear workpad or PR body must name:

| Field                             | Requirement                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Target ref                        | Branch, commit SHA, PR head SHA, workflow run ref, composed validation ref, or deployed ref.                                    |
| Command or environment            | Exact local command, API request, workflow name/run, URL, or manual walkthrough context.                          |
| Acceptance criterion demonstrated | The ticket requirement, review request, or handoff condition the proof covers.                                                  |
| Artifact location                 | PR section, Linear comment, screenshot path, recording link, workflow run URL, uploaded report, log excerpt, or command output. |
| Result                            | Pass, fail, blocked, skipped with reason, or human-verified.                                                                    |
| Known limitation                  | Missing credential, skipped browser, partial fixture data, unrun suite, or `none`.                       |
| Next handoff                      | None, reviewer action, human deploy, credential request, product decision, or named ticket.      |

Do not summarize validation as "tested locally" without the command or
environment. Do not claim a proof item for validation that was not actually run.

## Acceptable Proof Types

Use the narrowest proof that demonstrates the acceptance criterion. Multiple
proof types may be needed for one ticket.

| Change type                     | Acceptable first-pass proof                                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI work                         | Component test output, manual walkthrough notes, screenshots, screen recordings, browser console/network notes, tested user role, viewport, URL, and relevant state setup.                      |
| Backend/API work                | Unit or integration test output, `curl`/GraphQL request and response summary, API logs, job logs, migration dry-run output, permission checks, compatibility checks, or contract test output.               |
| Workflow changes                | Workflow syntax review, `gh workflow` or `gh run` evidence, dry-run output, dispatch inputs, check-run URL, artifact upload URL, expected failure evidence for missing secrets, and state-transition notes. |
| Multi-ticket project validation | Target ref, included task refs, conflict notes, validation commands, affected sibling issues, and remaining finalizer TODOs or markers.                                                                     |

GitHub workflow-run URLs are first-class proof artifacts. A run URL may prove a
passing check, a deploy handoff, a preflight failure, or an
expected missing-secret blocker when the run identifies the target ref, inputs,
result, and artifact or log location.

Video is allowed but not required. Manual screenshots, short recordings,
walkthrough notes, logs, command excerpts, workflow runs, and artifact links are
valid proof when they identify the target ref and acceptance criterion.

## Sibling PR Evidence

Proof may already exist in another PR from the same Symphony project, especially
recent PRs with the same project color label. Reuse that evidence when it
demonstrates the same target ref, deployed ref, environment, or acceptance
criterion.

When referencing sibling proof, record:

- sibling PR number or workflow run URL
- project color or project issue set that ties the PRs together
- target ref covered by the sibling artifact
- which acceptance criterion it demonstrates for the current ticket
- any limitation, such as a newer task commit that still needs validation

Do not regenerate proof only to duplicate a valid sibling artifact. Do not reuse
sibling proof when the current PR changes the behavior under test or moves the
target ref beyond what the sibling artifact actually covered.

## Required Versus Optional

Required proof is the smallest evidence set that lets a reviewer confirm the
ticket's acceptance checks and workflow handoff state.

Optional polish includes:

- edited demo videos
- automated video capture
- rich dashboards
- long-form walkthroughs
- extra browser/device coverage beyond the changed risk
- broad monorepo validation when targeted checks already cover the change

Optional polish must not block first-pass review unless the ticket explicitly
requires it. Manual artifacts and durable links satisfy this standard when they
demonstrate the required behavior.

## Linear Workpad Shape

Keep one `## Codex Workpad` comment per Linear issue. Pin its ID before planning
or prerequisite checks and update that comment in place. `## Symphony Workpad`
is engine-owned; `## Cadence Workpad` holds review and bridge state. Add a proof
section using the inline workpad shape below.

Use this shape:

```md
## Proof Of Work

Target ref:

- `symphony/sample-factory/DEMO-150/proof-of-work-standard@<sha>`

Evidence:

| Proof type | Command or environment                                            | Acceptance criterion demonstrated                     | Artifact location                          | Result | Known limitation | Next handoff |
| ---------- | ----------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ | ------ | ---------------- | ------------ |
| docs       | `npx prettier --check docs/engineering/symphony/proof-of-work.md` | Markdown formatting passes for the evidence standard. | Linear workpad and command output excerpt. | pass   | none             | none         |
```

The PR body should mirror the same facts under `## Tested` by default.
`## Test plan` is acceptable when updating an older PR that already uses it. The
workpad can be more detailed; the PR can be concise as long as it preserves the
concrete commands, artifacts, limitations, and handoffs.

## Missing Access Or Credentials

Missing proof is not a failure when it is recorded honestly. It becomes a
workflow problem only when the agent hides the gap or substitutes weaker proof.

Even a first pass with no local proof must leave a well-formed handoff. Record a
proof item with the intended target ref, the command/environment that could not
be exercised, the acceptance criterion at risk, the best artifact location
available, `blocked` or `skipped with reason` as the result, the exact
limitation, and the next handoff. If a GitHub workflow run failed during
preflight because deploy evidence, secrets, credentials, or
fixtures were missing, use that run URL as the artifact location.

When a UI path cannot be exercised locally:

- Record the blocked URL, role, feature flag, fixture, browser, or external
  service.
- Record any lower-level proof that still passed, such as component tests or API
  checks.
- Ask for a human walkthrough artifact, screenshot, recording, or environment
  access for the specific path.

If the missing proof prevents review readiness, move the issue to
`Inactive` (legacy `Human Input Needed` only when required by the current team)
according to the [project workflow](./project-workflow.md). If the gap
is expected follow-up work, keep the limitation visible and name the next
handoff.

## Current-Head Review And Bridge Evidence

For PR readiness, record the selected base SHA, current PR head SHA, required
check results for that head, Cadence's reviewed SHA and verdict, and draft/ready
status. Set blocker-side `mature` only when current-head checks and review pass
and the PR is ready for human review. An old approval or another task's green
check does not satisfy that gate.

For GitHub-to-Linear events, retain the actor, issue, identity source, PR when
present, head SHA, previous state, confirmed next state or skip, reason,
fallback, and workflow/check URL. Include run id/attempt for dispatched
completions. Missing identity, metadata, credentials, or current evidence is a
failed or skipped action, not a successful wakeup. Terminal issues stay terminal.
The [Cadence workpad](../review/cadence-linear-workpad.md) and workflow summary
hold the bridge result; record evidence-write failures and deduplication limits.

Durable review links point to repo files, commit/PR URLs, workflow runs, or
uploaded artifacts. A private local path alone does not give a reviewer access
to an artifact. Source inspection and fixture tests do not establish live host
installation or deployment coverage.

## Multi-Ticket Project Evidence

For projects where several task PRs must work together before completion, task
PRs remain reviewable against the selected base branch, and the project-level
validation must also leave proof. Record:

- task refs included in the project target;
- target ref and starting head;
- cleanup commits, or `none`;
- conflicts resolved, or `none`;
- validation commands and results;
- sibling issues or finalizer markers affected;
- remaining deploy or human-review handoff.

Do not treat a clean individual task PR as proof that the combined project
behavior was validated. The project-level target needs its own ref and evidence.
