# Fan-Out Split Criteria

These are the split judgments used while preparing fan-out plans for coding,
documentation, operations, and mixed projects. They are written as
skill-buildable rules for DEMO-2.

## Criteria

### audience-conflict

trigger: The same source material needs both narrative human onboarding and lean
agent instructions.

reasoning: Human docs should explain context and sequence. Agent docs should be
short, imperative, and scoped. Combining them bloats both.

### package-boundary

trigger: Source files belong to a package with its own commands, conventions, or
ownership.

reasoning: Package-local docs keep agent context small and reduce accidental
cross-package edits.

### size-budget

trigger: An existing or projected scoped agent-instruction doc is near or above
32 KiB.

reasoning: Root and package-scoped agent instruction files, usually named
`AGENTS.md`, should stay small enough for reliable ingestion. Large references
should be indexed and split.

### instruction-scope

trigger: A rule applies only to one package, workflow, or tool.

reasoning: Narrow rules should live near the code or workflow they govern, not
in the root agent file.

### validation-surface

trigger: A set of docs implies a distinct validation method, harness, or
evidence standard.

reasoning: Validation docs and commands are easier to apply when grouped by how
work is checked, not only by product domain.

### proof-of-work-boundary

trigger: A project needs review evidence artifacts such as screenshots,
walkthroughs, command output, workflow runs, fixture results, or composed multi-ticket validation.

reasoning: Proof artifacts are part of the delivery contract, but they are not
the same as implementing the feature or workflow. Split the artifact standard
and handoff rules so agents record what they actually validated, ask for human
help when environments or credentials are missing, and do not let full remote
automation block the first usable proof path.

### historical-vs-current

trigger: Source material is a PRD, completed plan, branch review guide, or
Claude-generated plan whose current status is unclear.

reasoning: Historical context is useful but dangerous in onboarding unless it is
labeled as current, superseded, partially implemented, or archived.

archive trigger: Prefer archive placement when the implementation area has
churned since the document was written, the main work completed more than six
months ago, or the document is likely to mislead readers as current
documentation.

### raw-note-verification

trigger: Source notes include unverified claims, incident observations, or
explicit `[verify]` markers.

reasoning: Raw notes should seed durable docs only after code verification.
Agents follow written invariants closely, so stale claims have high cost.

### risk-blast-radius

trigger: Docs cover production operations, database behavior, auth, permissions,
credentials, migrations, or external integrations.

reasoning: High-risk docs need prerequisites, environment boundaries, rollback,
and validation evidence. They should not be mixed with general onboarding.

### workflow-boundary

trigger: Docs describe a review, orchestration, CI, deployment, or local-harness
workflow rather than application behavior.

reasoning: Workflow instructions need their own lifecycle and should not be
confused with product or architecture reference material.

### external-system-boundary

trigger: Docs require a third-party system, customer setup, provider API, or
external credential.

reasoning: External dependencies need setup and troubleshooting sections that
are different from ordinary repo development docs.

### credential-boundary

trigger: Following the doc requires access to secrets, cloud accounts, provider
dashboards, customer environments, or privileged local files.

reasoning: Credential-dependent steps should be explicit and should block or
ask a human rather than implying that any agent can execute them.

### locality

trigger: A doc is only useful while editing a specific component, fixture, or
directory.

reasoning: Local docs should remain close to code, with indexes linking to them
instead of moving detailed local knowledge into global docs.

### domain-boundary

trigger: Source files share a product or architecture domain with a coherent
mental model and owner.

reasoning: Domain grouping gives humans and agents a focused path while keeping
target areas disjoint.

### concept-depth

trigger: Source material needs a conceptual explanation before file-level
instructions make sense.

reasoning: Deep concepts such as Part graph traversal, ORQL, or signal stages
should be explained once as references and linked from package docs.

### workflow-boundary-cross-package

trigger: A workflow crosses packages but has one user-visible lifecycle, such as
document upload, conversion, extraction, and analysis.

reasoning: Cross-package workflows need a single overview plus package-local
links so agents can reason about contracts without merging unrelated docs.

### cross-package-contract

trigger: A doc describes a contract that must stay aligned across UI, API,
bridge, jobs, or external services.

reasoning: Cross-package contracts need one owning doc so follow-up tickets do
not update each side independently and drift the contract.

### durable-data-contract

trigger: A change adds or changes persisted fields, bridge types, API payloads,
or data that must remain readable for existing rows.

reasoning: Durable contracts need isolated ownership, compatibility notes,
fixtures for missing legacy values, and tests that prove old data still reads
honestly.

### async-pipeline-boundary

trigger: A change crosses a queue, event listener, retry, deduplication,
provider callback, or background worker boundary.

reasoning: Async handoffs need separate ownership for enqueue timing,
idempotency, retry semantics, and evidence that durable state exists before
side effects run.

### shared-orchestrator-file

trigger: Several desired behaviors converge on one orchestration file, module
registration file, route, controller, or shared workflow entry point.

reasoning: Preserve disjoint file ownership by creating one orchestration ticket
for that file and separate tickets for services or helpers it calls. The
orchestration ticket carries explicit dependencies instead of letting multiple
tickets edit the same file.

### typed-seam-contract

trigger: Fan-out slices need optional, dynamic, or delayed wiring across a
producer/consumer boundary, especially when one slice must compile before its
sibling has landed.

reasoning: Define the seam as a typed interface, token, payload, or shared
contract in one owned location. Dynamic or optional runtime wiring may still be
necessary for disjoint PRs, but the if-present contract should remain
TypeScript-checkable instead of relying on `unknown`, casts, or shadow payload
types. A temporary seam created only for fan-out delivery must be marked with a
project-scoped TODO and assigned to the project's finalize/TODO cleanup ticket.
By project completion, the seam should either be part of the intended
architecture or be removed, flattened, or made invisible to callers.

### seam-owner

trigger: A behavior depends on registration, DI wiring, queue hookup, module
exports, or another connection point between otherwise disjoint slices.

reasoning: Wiring is its own deliverable. Assign the seam file to exactly one
ticket and make composed validation an acceptance check, because producer and
consumer tickets can pass in isolation while the integrated behavior is still
broken. If the seam owner needs an interim adapter, re-export, or extra layer
only to keep file ownership disjoint, record the later flattening as an explicit
TODO instead of treating the interim shape as final design.

### module-cycle-boundary

trigger: A change would make one package or NestJS module call back into a
module that already depends on it, or would hide that cycle behind `ModuleRef`,
optional `require`, late lookup, or provider construction by hand.

reasoning: Hidden cycles make local slices appear independent while moving
runtime risk into module startup or late service lookup. Split the work so the
cyclic seam moves to an owning module, a boundary contract, or an orchestrator
that is allowed to depend on both sides.

### merge-readiness-sequencing

trigger: A spawned item may need upstream work before final merge readiness, but
can still be drafted, reviewed, and validated with explicit upstream context.

reasoning: Treat this as sequencing guidance, not a Linear blocker. The
dependent task should inspect explicit upstream refs or wait for upstream work to
land, then recheck before final merge if upstream review changed the contract.

### ci-gated-runway

trigger: A small upstream contract, export, migration, or shared UI surface is
needed before downstream work can compile cleanly from the base branch, but the
project should fan out before human review or merge completion.

reasoning: Create all tickets up front, validate the runway item first, and let
dependent tickets start after required CI passes and the runway is
available. Keep dependent task PRs based on the selected base branch; use typed
temporary seams or an explicit wait when the clean branch cannot compile yet.
Avoid Linear blockers unless the accepted plan marks the dependency as hard.

### hard-dependency-boundary

trigger: A spawned item cannot produce an independently reviewable and passing
PR against the base branch until another item has merged there.

reasoning: Hard dependencies should be rare and explicit because they constrain
merge order. Use them when a task imports an upstream API or type, depends on a
persisted contract or migration, documents implemented behavior that must
already be true on the base branch, or otherwise cannot use a review-independent
CI-gated runway or temporary seam. These may become true issue blockers.

### integration-validation-dependency

This stable criterion ID is retained for accepted plans. It describes validation
across tasks and does not require a shared branch.

trigger: A spawned item can keep disjoint file ownership and a clean PR, but its
final behavior or stronger tests need provisional work from another item.

reasoning: Mark this as a composed validation dependency. Validate the composed
behavior on the accepted target ref or after the upstream work lands, and avoid
Linear `blockedBy` links or main-merge requirements in the fan-out metadata.

### rollout-gate

trigger: A feature may need a flag, staged rollout, environment gate,
organization setting, or kill switch.

reasoning: Rollout gates are product and operations decisions as well as code.
They should be split or explicitly deferred so alpha-critical fixes are not
blocked by an unresolved rollout policy.

### alpha-cutline

trigger: A project has known gaps but only a minimum alpha path should ship now.

reasoning: Put the smallest user-visible success path in committed fan-out
items and record UI polish, broader threading, migration cleanup, and optional
rollout controls as deferred or separately gated work.

### codex-skill-boundary

trigger: A change creates or updates a reusable Codex skill, prompt bundle,
template set, or operator workflow that a human or agent will invoke for future
work.

reasoning: Codex skills are executable instructions, not ordinary docs. Split
skill behavior, required source reads, failure modes, templates, and dry-run
checks from product implementation so future users do not inherit ambiguous or
overbroad instructions.

### ticket-template-contract

trigger: A workflow generates Linear issues, PR instructions, workpad
templates, project descriptions, or other ticket-ready text from a reusable
template.

reasoning: Generated tickets need stable fields and no hidden judgment. Split
template contracts from live project execution so a human, script, or agent can
audit the generated scope, labels, dependencies, evidence, and blockers before
work starts.

### dag-plan-contract

trigger: A project should execute as a reviewed DAG with Mermaid graph diffs,
manifest-backed nodes and edges, branch manifests, direct Linear blocker
relation payloads, draft/ready handoff, or maturity-gated DAG execution.

reasoning: DAG topology is an execution contract, not ordinary sequencing
guidance. Split the graph/manifest/relation contract from implementation so
future tickets preserve blocker-to-blocked relation direction, base-branch task
PR policy, branch birth policy, and blocker-side mature-label behavior instead
of silently flattening the work into a sequential plan.

### color-lane-capacity

trigger: A workflow assigns one finite Symphony project color label from a
shared color set.

reasoning: A Symphony project gets exactly one color. Split label setup and the
availability helper from individual project work so generated projects either
receive one available color or abort with a concrete human action; do not plan
multi-color projects or race-condition-free reservation until that problem
actually appears.

### observability-trace-surface

trigger: An LLM, classifier, router, asynchronous worker, or external provider
decision affects persisted state, user-visible status, monitoring, or later
evaluation.

reasoning: Split or explicitly include trace metadata, model/prompt identity,
input/output annotations, and failure visibility so reviewers can evaluate the
decision path without reproducing the provider call.

### evaluation-first-ai-change

trigger: A prompt, model, or AI decision-policy change is motivated by a
specific production, customer, or evaluation failure mode.

reasoning: Capture the failure as a unit eval that uses the production
prompt/request construction path before changing the prompt, model, or policy.
The eval should establish the current baseline and then serve as before/after
evidence, so reviewers judge the change by reproducible behavior instead of
subjective prompt inspection or one-off model output.

### untrusted-content-boundary

trigger: External user, vendor, or customer-supplied content is rendered,
converted, classified, extracted, or sent to an LLM-driven workflow.

reasoning: Untrusted content needs a narrow processing boundary, sanitization or
prompt-risk notes where applicable, and source-grounded evidence before derived
signals or findings are emitted.

### product-area

trigger: Source files cluster around a feature family or product capability
rather than a package or infrastructure boundary.

reasoning: Product-area docs should be organized by the workflow humans
recognize, with implementation links underneath.

### operational-prerequisite

trigger: A doc cannot be safely followed without specific environment access,
tooling, service state, or approval.

reasoning: Operational prerequisites must be stated before commands so agents
and humans do not run unsafe or impossible procedures.

### default-branch-dispatch-prerequisite

trigger: A GitHub Actions workflow must be manually dispatchable while feature
work is happening on a non-default branch.

reasoning: `workflow_dispatch` discovers workflow files from the default branch.
Land durable stubs or wrappers on the default branch before branch-local
implementation work depends on manual dispatch. Keep the stub/wrapper files
owned by one ticket, and put branch-evolving behavior behind scripts or
reusable entry points with separate file ownership.

### static-ephemeral-infra-boundary

trigger: A project has both long-lived shared infrastructure and on-demand
resources that are created, reset, or destroyed per user, tenant, branch,.

reasoning: Static resources such as DNS, shared networking, ingress, durable
storage, or provider credentials have different review, rollback, and apply
risks than ephemeral compute and data-plane resources. Split them so reviewers
can verify static blast radius separately from deploy-time lifecycle behavior.
When a repo has a namespace reserved for deployable environment stacks, place
long-lived static roots in a separate shared/static namespace. When ephemeral
resources have a best-before, TTL, lease, or expiration tag, keep the cleanup
owner explicit enough to prove idempotency, no-grace expiration behavior, and
exclusions for durable resources such as S3 or DNS.

### target-user-workflow

trigger: Docs are best understood by the product workflow a user performs,
rather than by package or implementation layer.

reasoning: Product and feature docs should answer "what user flow is this for?"
before diving into code anchors.

### terminology-boundary

trigger: A planned change uses a term that is overloaded in the problem domain
or already means something else to reviewers, operators, or external systems.

reasoning: Naming is part of the contract. Split semantic renames from behavior
changes when the old name can cause review confusion, wrong abstractions, or
incorrect future placement.

### low-risk-batch

trigger: Several small docs share the same disposition and can be archived or
normalized together.

reasoning: Low-risk batches reduce ticket overhead without causing overlapping
file ownership or review complexity.

### temporary-artifact-lifecycle

trigger: A planning artifact is useful while a fan-out project is active but
should become historical evidence after the spawned work lands.

reasoning: Temporary project-planning docs should not remain in primary
onboarding as future work once they have served their coordination purpose.

### fan-out-finalization-boundary

trigger: Disjoint fan-out work uses temporary TODOs, stubs, adapters, flags,
compatibility exports, disabled paths, or other temporary scaffolding that must
be cleaned up before the project is complete.

reasoning: Finalization is its own deliverable. Assign cleanup, marker search,
and composed validation to one ticket or existing finalize issue so temporary
scaffolding does not become accidental architecture after parallel PRs have
landed.

## Difficulty Tags

`hard`: likely needs human input before work starts, a thorough human review
before merge, or both.

`easy`: an agent should be able to complete the work end to end, with human
review limited to a quick correctness skim.

## Application Rule

Briefly compare a few materially different breakdowns, then record the chosen
one and its main tradeoffs. Balance coherent nodes and validation, reviewable
PR size (aim for fewer than roughly 1,000 changed lines), low DAG height, disjoint
parallel files, and nonconflicting use of concrete external resources. Height
means minimum dependency rounds along the longest path, not elapsed time or
worker capacity. Repeated file edits or conflicting resource use require
ordering and scope handoffs, increasing height; weigh this against coherence
and review size rather than minimizing ticket count or serializing everything.
The size target is a heuristic, not a gate: exceptionally coherent mechanical
work can be much larger when decisions are explicit and execution is easy to
verify. See the [planning template](../../.agents/skills/symphony-project-factory/templates/tickets/plan-project.md#decomposition-judgment)
for the justified-file-list then mechanical-copy example. Keep comparison and
rationale concise; no exhaustive search or scoring framework is needed.

The criteria are prompts for judgment, not mandatory independent splits.
Consider a split when an item crosses an audience boundary, package
boundary, module-cycle boundary, seam boundary, risk boundary, verification
boundary, workflow-state boundary, review-automation boundary, review-trigger
boundary, automation-identity boundary, manual-handoff boundary, agent-skill
boundary, ticket-template boundary, DAG plan contract boundary, color-lane
capacity boundary, shared-environment boundary, evaluation-first AI boundary,
terminology boundary, communication-evidence boundary, rollout-gate boundary, temporary-artifact
lifecycle, default-branch dispatch prerequisite, or static/ephemeral
infrastructure boundary. Batch only when the files share the same disposition
and validation needs. Type dependencies as sequencing by default, except where
the plan explicitly names a CI-gated runway or a hard dependency. Use a
CI-gated runway when a small contract can unblock downstream work after CI,
before human review completes. Reserve hard dependencies for cases that cannot
be drafted, reviewed, or temporarily seamed without the upstream change on the
base branch. When temporary seams preserve clean PRs, require structured
`integration_pattern` and `finalization_responsibility` metadata instead of
leaving cleanup as prose. Do not create Linear `blockedBy` or `blocks` links
from fan-out dependencies unless a human explicitly asks for blocker links after
reviewing the generated plan or the plan marks the dependency as a true hard
blocker. For accepted DAG plans, the graph's relation payload table is the
reviewed hard-blocker instruction: create exactly those blocker-to-blocked
relations, preserve mature-label application/removal semantics, and do not add
extra inferred blockers.
