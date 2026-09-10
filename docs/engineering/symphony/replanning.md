# Replanning From Human Feedback

An ordinary human PR comment can change the approach or the plan. No special
command, label, or `CHANGES_REQUESTED` verdict is required. The existing review
bridge wakes eligible work for nonempty human `COMMENTED` reviews; the worker
interprets the feedback in context. Cadence is advisory. Its approval does not
override a later human objection or establish final merge readiness.

## Choose The Smallest Coherent Revision

Read the complete review, current issue, accepted plan and decisions, related
PRs, and fresh human replies. Distinguish an instruction from a question or
tentative suggestion. Use the project's human authority and existing task
authorization; ask only about material choices the available context cannot
settle. A clear replacement approach is actionable even if it contradicts
generated acceptance criteria. Record which criteria it supersedes.

| Change                 | When it fits                                                                     | Action                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Implementation repair  | The outcome, approach, and ticket boundary still hold.                           | Fix and validate in the existing ticket/PR.                                                                                |
| Replace implementation | The outcome and node boundary hold, but the approach is wrong.                   | Keep the ticket/PR; replace its internals and revise its criteria and estimates. The DAG may remain identical.             |
| Partial replan         | Ownership, interfaces, dependencies, or deliverables change across some tickets. | Amend the affected plan, reuse sound tickets, and split, combine, supersede, or add work where needed.                     |
| Full replan            | The project outcome or central assumptions invalidate the decomposition.         | Propose a replacement plan with an explicit disposition for existing work. Retain useful work where supported by evidence. |

Do not cancel a sound node merely because its implementation is poor. Conversely,
do not preserve a bad boundary merely to save a PR. A replacement may be much
smaller: replanning can contract as well as expand the work.

Treat explicit constraints such as "minor hooks around the existing scheduler"
or "no new controller code" as acceptance criteria. Remove superseded machinery
when the requested replacement makes it obsolete; wrapping it in a small hook
does not satisfy a request to simplify it. Show the resulting behavior and
implementation footprint so the human can judge whether the simplification
actually happened.

For a substantive change, keep a revision record in the pinned `## Codex Workpad`:
source URL/ID, author and update time, reviewed and current heads, interpretation,
chosen change class, superseded decisions/criteria, affected tickets, and next
action. Keep unresolved feedback until explicitly addressed, deferred with
rationale, or blocked. Advancing the workpad timestamp does not consume it.
Reread edited comments and later clarification; do not redo already applied
work simply because the same event is delivered again.

## Determine Impact Before Moving Boundaries

Start with the rejected decision and the current plan's consumers. Inspect
downstream hard and soft dependencies, shared files and external resources,
interfaces, tests, documentation, and deployment assumptions. Graph reachability
is a candidate set, not an instruction to cancel every descendant. Some
consumers may be unaffected; a shared interface can also affect a sibling with
no graph edge. Record the evidence for retained as well as changed work.

Read live issue states, PR heads, merge status, and running work before applying
changes. For each affected item, record one disposition: retain, rework in place,
supersede, create replacement/follow-up, or remove obsolete delivered behavior.
Include old/new ownership and dependency changes. Use existing issue IDs when
the outcome remains coherent. Reuse a recorded replacement issue or PR instead
of duplicating it on retries.

- **Pending work:** revise or supersede obsolete tickets before dispatch.
- **In-flight work:** coordinate a pause for conflicting writers through the
  available controller/operator path and confirm they have stopped before
  reassigning files. Setting an issue to `Inactive` alone is not proof that a
  running worker stopped. Preserve its branch and workpad. If stopping cannot
  be verified, park the dependent change with that specific coordination need.
- **Merged work:** inspect the current base and callers. Create explicit
  removal/migration work where needed, including obsolete tests, configuration,
  docs and deployed resources. Historical `owned_files` identifies places to
  inspect, not files to delete wholesale: other useful changes may now share
  them. Keep completed tickets as history; cleanup is new work with its own
  acceptance evidence and deployment authority.

Continue independent work. Do not pause or cancel the whole project when a
local change is sufficient. Do not claim that invalidating a plan reverted code,
stopped workers, or removed deployed resources.

## Update The Plan And Execute Within Authority

Update the affected decision and acceptance text, exact create/edit/delete file
ownership, external-resource ownership, estimates, and integration/cleanup
responsibilities. Shared files need a single owner or explicit sequencing and
handoff. Record the new allocation before editing outside the old allocation;
do not make an unauthorized edit and retroactively add it to `owned_files`.

For topology changes, update the plan's Mermaid graph, standalone `.mmd`, DAG
manifest, branch declarations, and direct hard-blocker payloads together. Run
the project's existing plan validation. An unchanged graph does not mean an
unchanged design: include the decision/criteria diff even when no edge moves.
Task branches and PRs keep the selected base; dependencies do not change branch
ancestry. Follow the [fan-out schema](../../symphony-plans/fan-out-plan-schema.md).

Apply changes already covered by clear human direction or accepted project
authority. Do not demand a second approval for a fully specified in-scope
replacement. For an unresolved cross-ticket or project decision, prepare the
concrete revision and ask the smallest decision question. Keep proposed new
work parked until the applicable plan/activation authority is satisfied. A
proposal is not an accepted plan, and it grants no deployment or access rights.
Use the normal plan/fan-out path; do not create a new project or planning seeds
as a side effect of reviewing a ticket.

When authorized, update ticket descriptions, ownership and exact hard relations;
create only needed new tickets with the project's human lead and plan/source
links. Confirm each mutation by reading it back. Preserve a resumable record of
created IDs and completed steps if part of the change fails. Do not activate
replacement writers while conflicting work or relations remain unresolved.

## Replace Code And Revalidate

An existing PR can remain the review artifact after a substantial rewrite.
Use ordinary commits or an authorized branch rewrite as appropriate. For a
force push, record the previous remote head and review links, then use an
explicit `--force-with-lease=refs/heads/<branch>:<observed-sha>` on the task
branch. If the lease fails, fetch and reconcile the concurrent work. Never use
an unconditional force push or rewrite the selected base.

Record old and new SHAs and the decision that caused the rewrite. Keep durable
links and the rationale in the workpad; do not rely on assumptions about remote
object retention. Outdated line comments still need a disposition. All previous
checks and review evidence remain historical, not evidence for the replacement
head. Refresh the PR title/body, local checks, CI and configured review against
the revised criteria and current head. Preserve the feedback ledger across the
rewrite so the old implementation is not reconstructed on the next turn.
New human direction invalidates acceptance against superseded criteria even
when the head has not changed. A finding grounded only in a superseded criterion
needs a recorded disposition, not a patch that resurrects the rejected design.

## PR 12 Example

[The human review on PR #12](https://github.com/1000lines/symphony-example/pull/12#pullrequestreview-5173381374)
rejects the monitor approach and gives a simpler alternative: use the server's
`wake:15m`, `Unhappy` while CI is pending, `Inactive` on success, and `Active` on
failure. The reviewer need not encode this as a new plan. Start by testing
whether the existing WAIT node can deliver that outcome; preserve the PR if it
can. Inspect consumers and existing state/wake behavior before promising that
the change is local. Amend conflicting decisions and downstream assumptions;
do not make minor fixes to the rejected monitor merely because its old criteria
are satisfied. This example is a feedback-handling case, not a global change to
every project's CI state policy or proof that the server has been deployed.
