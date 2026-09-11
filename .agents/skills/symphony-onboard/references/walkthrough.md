# Onboarding walkthrough preparation

This is the dependency checkpoint for [100-54](https://linear.app/1000lines/issue/100-54).
The `onboard <repo-url>` skill and its executable walkthrough are not delivered
yet. This note records what the onboarding author can consume and what must
arrive before completing the four owned skill files.

## Accepted source and remaining dependency

Inspected `1000lines/symphony-example` main at
`20e28fbc02257aee4c0ed9fe54c1ecfd26cee4f6`, September 11, 2026.
[Jeremy approved the partial CT-L checkpoint](https://github.com/1000lines/symphony-example/pull/48#pullrequestreview-5182733845)
and [PR #48](https://github.com/1000lines/symphony-example/pull/48) merged. His
decision allows that checkpoint to land and be amended subsequently; preserve
the accepted 100-49 and 100-53 issue states.

The merged [template README](../../../../templates/symphony-client/README.md)
and [PROVENANCE](../../../../templates/symphony-client/PROVENANCE.md)
describe 23 generated paths, with three caller paths still pending:

| Missing generated workflow           | Boundary needed by the onboarding instructions                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `symphony-client-review.yml`         | Reviewed events/manual/trigger entry points, explicit reviewer choice and App/Linear/provider secret mappings.     |
| `symphony-client-handoff.yml`        | Reusable feedback entry receiving App and Linear credentials only.                                                 |
| `symphony-client-review-cleanup.yml` | Native completion listener matching the generated review workflow, calling reusable cleanup with the App key only. |

At the inspected commit, the seed review trigger has no `cadence_reviewer`
input or `CADENCE_OPENAI_API_KEY` declaration. Events/manual still use internal
secret inheritance; handoff/cleanup have no `workflow_call`. The three planned
provider paths in [review-export.txt](../../../../docs/symphony-plans/client-template/review-export.txt)
are absent. [Early review evidence](../../../../docs/symphony-plans/client-template/early-review-evidence.md)
does not establish the remaining reusable provider or live Codex proof.

The eight-answer Copier interface is available. The
[CT-O contract](../../../../docs/symphony-plans/client-template/implementation-items.md#ct-o--deliver-forkdirect-and-repeat-onboarding-skill)
also requires the complete merged CT-L template for executable instructions and
render acceptance. A successful render of the partial tree cannot demonstrate
working review, feedback or cleanup. Do not invent those interfaces or copy
unmerged predecessor code into this task.

## Resumption handoff

Jeremy supplies the accepted follow-up source/PR and proof for the remaining
CT-R interface and CT-L caller integration on `main`. This task does not reopen
terminal issues or take ownership of those workflow implementations. Before
resuming authoring, inspect the actual merged artifacts:

1. The template's inventory and pending-addition list agree on a complete tree,
   including all three callers above and the fourteen copied skill/resources.
2. Callers map named secrets explicitly at every repository boundary. The
   required eighth answer, `cadence_reviewer`, selects exactly `claude` or
   `codex`, with no default or fallback. Both keys present still runs the chosen
   reviewer; an invalid/missing selection or missing matching key fails before
   provider execution. Check the accepted provider/key matrix and cleanup
   cancellation/recovery evidence.
3. The merged package supplies the local render command and fixtures used for
   onboarding dry runs. Record that source commit separately from the reviewed
   tooling checkout. Verify installed reader support before activating an
   explicit `ci.mode`; source support does not prove host rollout.

Then deliver `SKILL.md`, `references/fork.md`, `references/direct.md` and the
completed `references/walkthrough.md` in this directory's parent. Reuse existing
GitHub, repository, Linear and planning tools. Load project-factory and Linear
GraphQL from the generated client's `.agents/skills/`, and replan from its
`scripts/symphony/runtime-bundle/skills/symphony-replan/SKILL.md`. Retain their
resources/licenses and a separate reviewed tooling checkout; workflow publication
does not supply those client skill files.

## Acceptance still to demonstrate

Run the fork, direct, repeat and additional-project walkthroughs with synthetic
resource responses and real local renders. Fork defaults to `1000lines` with
owner admin and the accepted existing App; private/secret-dependent direct use
uses the owner's manifest/installation. Repeated invocation must inspect before
creating repositories, Apps, projects, secrets or planning seeds. Additional
projects reuse the client without repository-wide project binding.

Supply the eight known answers; configure mode/commands outside the questions.
Discover actual IDs, Actions settings and required check provenance. Keep secret
values outside answers/transcripts; retain the accepted public App's
cross-installation PR/issues/checks write scope and the automatic, nonrequired
advisory check. Preserve unrelated target settings.

Author from the completed local staging package until publication is available.
Final public rendering uses `--vcs-ref=alpha`; final callers use workflow
`@alpha`. Check branch/tag collisions and record actual template/workflow/helper
commits alongside ordinary Copier metadata. Include the template repository's
root client as a separate consumer, with root `copier.yml` selecting only
`template/`; [100-57](https://linear.app/1000lines/issue/100-57) owns its eventual
live self-use proof.

Record locked Markdown, link/command inspection and the dry-run transcript,
followed by mandatory current-head CI. No onboarding render or live operation
has been performed for this checkpoint. [100-58](https://linear.app/1000lines/issue/100-58)
owns the later live walkthrough; Jeremy/parent owns installation, invocation,
participant credentials and rehearsal. Project-factory remains human-invoked
and outside the unattended hosted profile.
