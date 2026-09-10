# Fan-Out Plan Informal Schema

Plans may be documentation projects, coding projects, operations projects, or a
mix. The schema is biased toward exact ownership: every item should make clear
which files it may edit or create, which context is read-only, what dependency
state it needs, and what evidence proves the spawned ticket is done.

Human feedback can revise this allocation. Follow
[Replanning From Human Feedback](../engineering/symphony/replanning.md) to
amend ownership before crossing file boundaries, coordinate existing writers,
and account for retained, superseded, and already-merged work. A change to a
node's approach need not change its graph edges or require a new ticket.

For plan review, put a short outcome and size summary near the top: node count,
estimated additions and deletions per node, files touched, and substantial
uncertainty or complexity. Estimates are prompts for judgment, not acceptance
quotas. Explain why a large node needs its size and whether existing mechanisms
could satisfy it more simply. For a replan show old versus new values, including
explicit removal work. Do not increase implementation size to meet an estimate.

## Plan Header Fields

`project_code`

- Short stable project code used for ticket grouping and Symphony branch names.

`project_color`

- Optional GitHub label or execution-lane color for PRs spawned from the plan.
- Use the same short value from the Linear project metadata when present.

`base_branch`

- Optional Git branch used as the clean branch point and GitHub PR base for
  spawned tickets.
- Defaults to `main` when absent.
- Do not use `base_branch` as branch ancestry. Each task PR should be
  independently reviewable against the selected base branch.

`seed_issue`

- Linear issue identifier for the planning ticket that produced the plan.

`target_project`

- Optional Linear project name for spawned tickets.
- When absent, spawned tickets inherit the project from the fan-out trigger
  issue. If a prompt names a different target project than the trigger issue's
  project, stop and ask for confirmation before creating tickets.

`human_lead`

- Single human lead for the fan-out project.
- Prefer the human's full name plus Linear and GitHub handles when known, so
  generated tickets and PRs can be assigned without guessing.
- When absent from the plan, inherit the value from Linear project metadata if
  present. If neither source names a human lead and generated tickets or PRs
  need an assignee, stop and ask for the mapping instead of assigning an
  arbitrary reviewer.

`suggested_labels`

- Optional labels to apply to every generated ticket or PR for the plan.
- Use this only for labels that are project-wide and already defined by the
  project metadata or accepted workflow.

`github_pr_labels`

- Optional GitHub labels that every spawned PR from the plan must carry.
- Use this when PR labels differ from Linear issue labels, or when the project
  requires a shared automation label in addition to the color lane, such as
  `symphony`.
- Include the plan's `project_color` label when the project metadata requires
  it, plus any accepted project-wide PR labels.
- If any required GitHub PR label is missing or cannot be applied, the spawned
  ticket should record the exact label failure and stop in `Human Input Needed`
  instead of opening an unlabeled or partially labeled PR.

`linear_issue_labels`

- Optional Linear labels that every generated issue from the plan should carry.
- Keep these separate from `github_pr_labels` when the project needs matching
  concepts in both tools but the labels are created and applied through
  different APIs.
- If a required Linear label is missing and the generated ticket is not scoped
  to create it, ask for label setup or create a separate label-setup item rather
  than silently dropping the label.

`project_prerequisites`

- Optional shared setup, identity, credential, fixture, environment, or source
  document prerequisites that spawned tickets must preserve.
- Use this for project-wide inputs that are not owned by one item, such as
  redacted customer examples, provider identities, DNS setup, or feature flags.
- When a source document needs a specific CLI, API, credential, export path, or
  fallback read method, name that access method here so generated tickets can
  preserve it mechanically.
- Source-document access instructions should avoid relying on whichever user
  identity happens to be active in a CLI session. Name the intended credential
  or activation path, the source document ID source, and any sharing/API
  prerequisites.
- Use placeholders such as `${SOURCE_DOC_ID}` for reusable commands, and state
  how generated tickets should fill them from `source_notes` or project
  metadata. Keep literal document IDs only as examples or project-specific
  values.
- When the source is a Google Doc, prefer full-document text export for context
  reads when available. If using a structured document API fallback, require
  recursive text extraction so tables, lists, and nested elements are not
  silently dropped.
- A generated ticket that needs one prerequisite should copy the specific
  prerequisite into its description instead of requiring the assignee to infer
  it from the header.

`completion_gates`

- Optional project-level checks, item IDs, or evidence requirements that must
  be satisfied before the fan-out project can be called complete.
- Use this for source-document success criteria, final evaluation fixtures,
  temporary-seam cleanup, launch-readiness checks, or other requirements that
  span several otherwise disjoint tickets.
- Each gate should name the exact item or evidence source, the satisfaction
  condition, and whether an unresolved gate should block completion, move a
  spawned issue to Human Input Needed, or require a human scope decision.
- Do not use completion gates to replace item-level `acceptance_checks`; use
  them to make cross-item completion semantics mechanically visible.

`known_open_decisions`

- Optional product, security, operations, or design decisions from source
  material that are intentionally not turned into implementation items yet.
- Use this only when the source material itself marks the decision as open,
  deferred, or requiring a named human decision. Ordinary implementation work
  should be assigned to an item instead.
- Each entry should name the source line or issue/comment, the decision needed,
  the current plan behavior while unresolved, and the instruction for spawned
  tickets if the decision becomes required before project completion.

`baseline_context`

- Optional branch, commit, target ref, product-state note, or other stable
  baseline used while planning.
- Use this when the plan depends on provisional upstream work, a closed or
  canceled source plan, a non-`main` target state, or a specific external
  artifact version.

## DAG Plan Fields

Use these fields by default for Symphony project plans. A plan should omit the
DAG fields only when the project or accepted source explicitly requests a linear
plan or asks to avoid a DAG. Even moderately complex projects should preserve
their dependency topology as a DAG because dependency patterns rarely linearize
cleanly.

`mermaid_dag`

- Required for DAG plans.
- Use one Mermaid block marked with `%% symphony-dag/v1`.
- Keep the same graph in a standalone `.mmd` document. Use meaningful labels
  for work boundaries and outcomes, with visible dependency rounds so the
  diagram serves as a human overview on its own.
- Treat graph diffs as the reviewable unit for planning and replanning topology
  changes.

`dag_manifest`

- Required for DAG plans.
- Use exactly one `symphony-dag-manifest/v1` block.
- It should include project metadata, defaults, nodes, edges, node types, branch
  declarations, PR policies, maturity defaults, relation semantics, and
  decisions.
- Do not include v1-only DAG fields such as generated join artifacts,
  `base_node`, `stack_policy`, `stack:*`, branch-base exceptions,
  rebase-on-land, neutralization, or join relation policies.
- The parser rejects `project.integration_branch` and
  `defaults.frontier_blocked_label` with `removed-manifest-field`.
  `defaults.integration_branch_policy` remains rejected as
  `unsupported-v1-field`. Existing plans with these fields need an explicitly
  accepted replan before further fan-out; do not silently discard their workflow
  requirements. Preserve archived plans as history.
- Generated fan-out payloads omit `project.integrationBranch` and
  `existingPlanTimeRefs`; they no longer emit provisional project branch refs.
- The graph and manifest must match: every graph node and edge should appear in
  the manifest, and every manifest edge should appear in the graph.
- Prefer omitting redundant transitive edges consistently from the graph,
  manifest, and direct relation payloads: `A → B → C` needs no extra `A → C`
  unless that direct edge has an independent requirement. Preserve reachability
  and document any such independent requirement. Existing shared checks compare
  exact edge sets; a reduction applied only to the diagram is invalid.

`branch_manifest`

- Required for DAG plans.
- List each task branch.
- Each task branch entry should include the ref or template, selected base
  branch, PR base, branch birth policy, PR policy, and whether the PR opens
  draft, can become ready, or is omitted.
- Task branch bases and PR bases should be the selected `base_branch` by
  default.

`linear_relation_payloads`

- Required for DAG plans with hard execution edges.
- Use one payload per direct issue-to-issue graph edge. In each payload,
  `issueId` is the blocker, `relatedIssueId` is the blocked ticket, and `type`
  is `blocks`.
- Preserve relation direction exactly. `issueId` is the blocker/source of the
  edge; `relatedIssueId` is the blocked/dependent ticket.
- Fan-in is represented by multiple direct blocker-to-blocked payloads to the
  downstream issue. Do not create no-op join tickets or generated join branches.
- Do not add extra Linear blocker relations beyond the accepted DAG relation
  table unless a human accepts an amended plan.

`maturity_label`

- Optional manifest default; `mature` is the expected default when maturity
  gates are enabled.
- The label belongs on the blocker issue, not on the dependent and not on an
  edge.
- Generated coding tickets should instruct the blocker agent to set the label
  only when required checks for the current PR head pass, Cadence or the
  configured reviewer approves that current head, the task branch is clean of
  committed predecessor work that is not on the selected base branch, and the PR
  is marked ready for human review from its draft state.
- Generated coding tickets should instruct the blocker agent to remove `mature`
  only for request-changes review, rejected acceptance evidence, or a similarly
  severe downstream-invalidating regression.

`decisions`

- Required for DAG plans when the source material leaves architectural,
  workflow, branch policy, graph storage, draft/ready, or maturity decisions for
  the planner.
- Each decision should name the choice, rationale, source, and the ticket or
  artifact responsible for enforcing it.

## Item Fields

`ticket_title`

- One-line title suitable for Linear or GitHub.

`existing_issue`

- Optional Linear issue identifier for an already-created ticket that should
  satisfy, replace, or be updated from this item.
- Use this when planning finds seed, land-early, finalize, or manually created
  sibling issues before fan-out.
- State the current known issue state and the generation instruction, such as
  reuse if still open, do not duplicate if already done, or spawn a replacement
  when the existing issue is canceled.

`difficulty`

- `easy` or `hard`.
- Use `hard` when the item likely needs human input before work starts or a
  thorough human review before merge. Common triggers include cross-package
  contracts, high-risk operational behavior, external integrations, raw notes
  that require verification, broad workflow changes, or historical status that
  is unclear.
- Use `easy` when an agent should be able to complete the work end to end and a
  human review can be a quick correctness skim.

`scope`

- The boundary of the follow-up ticket.
- Must state what the item owns and what outcome is expected.

`dependencies`

- Other item IDs that matter for start order, composed validation, review
  sequencing, or final merge readiness, or `none`.
- Required only when the item is not safely executable or reviewable in
  isolation.
- Each dependency entry should include:
  - `item`: one upstream item ID.
  - `type`: normally `sequencing`; use another type only when the plan explains
    the human-approved semantics.
  - `requires`: concrete satisfaction condition.
  - `reason`: why the order matters, not just the upstream item name.
- Use `sequencing` when the dependent ticket should wait for, look at, or
  validate with upstream work before final review, without creating a Linear
  blocker.
- Legacy `type: integration` entries read as `sequencing`; migrate their
  satisfaction conditions to the selected base or an accepted temporary seam.
- Use `ci-gated-runway` when the upstream item is a small shared contract,
  export, or UI runway and the project should start dependent work after the
  upstream PR has required CI passing, without waiting for human review or merge
  to `main`.
- A `ci-gated-runway` dependency should state the clean-branch strategy the
  dependent ticket uses before the contract lands on `main`, such as a typed
  temporary seam or waiting until the upstream lands.
- Fan-out dependency entries are not Linear scheduling blockers by default. Do
  not create Linear `blockedBy` or `blocks` relations from them unless the plan
  has an explicit `linear_blocker: true` field or a human separately asks for
  blocker links after reviewing the fan-out.
- Avoid untyped phrases such as "must land first" or "should land first". State
  the concrete dependency condition instead.
- Prefer one dependency entry per upstream item so the plan can be turned into
  tickets without interpreting grouped lists.
- When a dependency exists because two coding slices need a seam, state the
  concrete contract or wiring surface that must compose. Do not rely only on
  "uses upstream work" language.
- Use `main` only as a rare true blocker when a downstream ticket cannot be
  usefully drafted, tested, reviewed, or temporarily seamed until an upstream
  shared type, export, migration, or durable behavior has actually landed on the
  base branch.
- Use any other dependency type only when the plan defines the
  exact semantics in `delivery_notes`.

`integration_pattern`

- Optional structured field for any spawned item that intentionally creates a
  temporary fan-out seam, stub, adapter, project-scoped TODO, compatibility
  export, or disabled path.
- Omit this field only when the item has no temporary integration seam, or use
  `pattern: none` when being explicit helps review.
- Allowed `pattern` values are:
  - `finalizer_todo`
  - `isolated_stub_file`
  - `typed_contract_or_adapter`
  - `disabled_or_flagged_path`
- For any value other than `none`, include:
  - `seam_owner`: item ID plus exact file that owns the seam.
  - `seam_files`: exact repo-relative files that contain the TODO, stub,
    adapter, typed contract, flag, compatibility export, or disabled branch.
  - `marker`: exact TODO text, stub marker, adapter symbol, flag name, or
    disabled-path identifier that makes the temporary seam searchable.
  - `isolated_validation`: checks the item can run on its clean task branch.
  - `composed_validation`: checks expected when the item is validated with
    related items on the accepted target ref.
  - `finalize_item`: item ID, generated ticket title, or existing finalize
    issue responsible for cleanup.
  - `finalize_action`: exact action the finalizer must take, such as delete the
    stub file, remove the TODO, replace the adapter, remove the flag gate, or
    promote a deliberately durable contract by removing temporary markers.
- Use a list when one item owns multiple temporary seams. Do not combine
  unrelated seams into a single free-form paragraph.

`finalization_responsibility`

- Required when `integration_pattern.pattern` is anything other than `none`.
- On ordinary implementation items, name the finalizer item or existing
  finalize issue and the exact marker, symbol, or file path it must search for
  before project completion.
- On a finalizer item, list the project-scoped markers, stub paths, adapter
  symbols, disabled flags, compatibility exports, and validation that prove all
  temporary scaffolding is removed or intentionally
  promoted.
- Create, identify, or update a finalizer item when a plan introduces any
  project-scoped TODO, stub file, temporary adapter, disabled path,
  compatibility shim, or temporary flag that should not survive project
  completion. Cleanup paths may overlap earlier implementation files, but the
  searchable markers must make that overlap explicit.

`source_files`

- Repo-relative files the ticket must inspect. Other files may be read when
  needed for context.
- Prefer disjoint `source_files` when those files are also the ownership
  surface. If several tickets need the same read-only context, list that context
  under `source_notes` instead.
- Listed source files may be edited only when they also appear in
  `owned_files` or are inside `owned_target_area`.
- Do not use broad globs in tickets spawned from this plan unless the glob
  expands to the listed files at ticket creation time.

`owned_files`

- Exact repo-relative files the ticket may create, edit, or delete.
- Must be disjoint across items that may run in parallel. If sequential items
  must edit the same file, list it for each with explicit ordering and a scope
  handoff in `dependencies` and `delivery_notes`; weigh the added DAG height
  against assigning the coherent work to one owner.
- List planned new files explicitly when the path is known.
- Directory prefixes are allowed only when the item owns all new files under
  that prefix and no other item owns the same prefix.
- A ticket may read files outside this list for context, but must not modify
  them unless the plan is updated first.
- If file-level disjointness requires a temporary compatibility export, cast,
  optional lookup, stub, disabled branch, adapter, flag, or `TODO`, the owning
  item must name it in `integration_pattern` and
  `finalization_responsibility`.

`owned_external_resources`

- Optional non-file resources the ticket may create, edit, or delete, such as
  GitHub labels, Linear labels, GitHub environments, repository variables,
  cloud environment names, service-account grants, or DNS records.
- Use exact names and APIs when known, for example `GitHub label: orange` or
  `Linear label: yellow`.
- Parallel items must have disjoint ownership and no conflicting resource use.
  For sequential changes to the same resource, record explicit ordering and
  scope handoffs as for `owned_files`.
- Identify conflicting use even without resource configuration edits, such as
  resets of the same test database.
  Record the resource, operation, and ordering in `dependencies` or
  `delivery_notes`. Disjoint files alone do not make these tasks independent;
  shared read-only access is not itself a conflict.
- If a ticket needs an external resource owned by another item, list it in
  `source_notes`, `project_prerequisites`, or `dependencies` instead of
  claiming ownership.
- External resources do not replace `owned_files`; every coding or docs ticket
  still needs an explicit file ownership set, even when the set is empty.

`source_notes`

- Non-repo notes, external issues, Linear comments, docs, or read-only repo
  context that inform the item.
- These are source material, not files the ticket owns.

`owned_target_area`

- Existing files or target directory prefixes the ticket should create or edit.
- Use this when an item owns a content area rather than a short exact file list.
  For file-level coding plans, prefer `owned_files`.
- When both `owned_files` and `owned_target_area` are present, `owned_files` is
  the edit authority and `owned_target_area` is only a human-readable ownership
  summary. It must not expand the ticket's editable file set.
- Follow-up tickets should avoid shared parent indexes unless the field
  explicitly lists them.

`human_vs_agent`

- Legacy field used by older documentation reorg plans.
- New mixed or coding plans should prefer `delivery_notes`.

`delivery_notes`

- Short notes about how the spawned ticket should be delivered or reviewed.
- Use this for human/agent audience notes, compatibility-shim notes, isolated
  vs composed validation expectations, or temporary artifact lifecycle notes
  that are not themselves mechanical work steps.

`required_actions`

- Mechanical work steps for the spawned ticket.
- Should be concrete enough to execute without re-splitting the item.
- For coding tickets with producer/consumer or DI seams, include the typed
  interface, token, payload, module export, or wiring file the ticket owns.
  Hidden dynamic wiring should be temporary and called out explicitly.

`acceptance_checks`

- Observable completion checks for the spawned ticket.
- Prefer checks about discoverability, current-status labels, file size, and
  validation commands over vague "docs are better" language.
- For coding tickets that preserve disjoint PRs with sequencing dependencies,
  include both isolated validation and any composed validation expected on the
  accepted target ref.

`split_criteria`

- Labels from [`fan-out-criteria.md`](./fan-out-criteria.md) explaining why the
  item exists as a separate ticket.

`exclusions`

- Explicit nearby work the ticket must not do.

`todo_cleanup`

- Legacy field from earlier plans.
- New plans should use `integration_pattern` and
  `finalization_responsibility` instead, because they preserve seam ownership,
  validation, and cleanup as structured ticket metadata.

## Ticket Generation Rules

- Copy one item into one ticket.
- If `existing_issue` is present, follow its reuse/replacement instruction
  before creating a new issue. Do not create a duplicate ticket for an open or
  completed existing issue unless the plan explicitly says to do so.
- Preserve the selected `base_branch` in the generated ticket description. If
  the plan omits it, state that the ticket defaults to `main`.
- Preserve the project `human_lead` in generated ticket descriptions and assign
  each generated Linear ticket to that person when the Linear identity is
  known.
- Preserve `github_pr_labels` in the generated ticket's PR instructions. If a
  required label cannot be applied, the ticket should stop with the exact label
  name and API failure recorded.
- Preserve `linear_issue_labels` in the generated ticket metadata, or record why
  a missing label setup task must run first.
- Preserve the `source_files` list as the required inspection set.
- Preserve `owned_files` as the exact create/edit/delete set when it is
  present.
- Preserve `owned_external_resources` as an exact external ownership set; do
  not let another generated ticket create or edit the same named resource unless
  the plan explicitly assigns sequential scopes and handoffs for that resource.
- Preserve `integration_pattern` and `finalization_responsibility` exactly; do
  not collapse structured seam ownership, validation, or cleanup fields into
  prose in the generated ticket.
- Preserve `delivery_notes`; for older plans, preserve `human_vs_agent`.
- Treat `owned_target_area` as the primary create/edit surface only for items
  without `owned_files`, or when the plan explicitly says the item owns every
  file under that directory prefix.
- Any other edited files should be newly created files that naturally align with
  the item, or the plan should be updated before the ticket starts.
- Keep owned files and target paths disjoint for parallel tickets. Preserve any
  planned sequential overlap, ordering, and scope handoffs exactly.
- Preserve `dependencies` with their `type`, `requires`, and `reason` fields.
- Preserve them as ticket description guidance. Do not turn dependency entries
  into Linear `blockedBy` or `blocks` relations unless the plan or human request
  explicitly says to create Linear blockers.
- For DAG plans, preserve `mermaid_dag`, `dag_manifest`, `branch_manifest`,
  `linear_relation_payloads`, `maturity_label`, draft/ready policy, and
  `decisions` as mechanical generation input. The
  accepted DAG relation payload table is an explicit Linear blocker
  instruction; create exactly those relations and no extra inferred blockers.
- For DAG plans, preserve relation direction exactly:
  `issueId: <blocker>`, `relatedIssueId: <blocked>`, `type: blocks`.
- For DAG plans, preserve blocker-side maturity instructions in generated
  ticket bodies, including current-SHA readiness requirements and the
  severe-regression removal bar.
- For DAG plans, do not generate no-op join tickets or generated join branches.
  Create only the accepted task issues, existing-issue updates, and direct
  relation payloads.
- Preserve `project_color` and `suggested_labels` as PR label requirements.
- Generated PRs should be opened against the selected `base_branch`, assigned
  to the `human_lead` when the GitHub identity is known, and kept clean of
  committed predecessor work that is not on the selected base branch.
- If a required Linear label, GitHub PR label, workflow state, assignee,
  existing issue, relation endpoint, or relation direction cannot be resolved,
  the generated ticket instructions should fail closed: record the exact missing
  prerequisite or API failure and stop before partial mutation.
- If any item has a non-`none` `integration_pattern`, make sure the generated
  ticket set includes or references the named finalizer issue before the
  project is considered complete.
- If a file must move between items, update the plan first, then generate
  tickets.
- For coding plans, do not let two tickets each "just wire their side" of a
  shared module, route, controller, queue, or provider list. Create one seam
  owner item for that shared file.
- If an agent-facing output would exceed 32 KiB, split it into nested files
  inside the same owned target area before completing the ticket.
- Do not smuggle adjacent work into a spawned ticket. If investigation exposes
  work outside the item ownership surface, create or update a separate ticket.

## Validation Rules

A spawned ticket is ready for review when:

- All listed source files were inspected.
- All acceptance checks are addressed.
- Only listed `owned_files` or `owned_target_area` paths were modified.
- Any listed `owned_external_resources` were created or changed exactly as
  specified, or the ticket recorded the missing access/resource as blocked.
- Any historical or unverified source claims are labeled.
- Any agent-facing docs are below 32 KiB per file.
- Any temporary seam marker named in `integration_pattern` is still searchable
  and assigned to the named finalizer item or issue.
- Any `completion_gates` that apply to the spawned ticket are satisfied or
  explicitly recorded as blocked/deferred according to the gate instruction.
- The PR body states validation evidence, hard dependency status,
  sequencing status, selected base branch, and any intentionally skipped checks.

A fan-out project is ready for completion only when the finalizer item has
verified that all project-scoped TODOs, stub files, temporary adapters,
disabled paths, compatibility exports, and temporary flags named in
`finalization_responsibility` are removed, flattened, or intentionally promoted
to durable architecture; every `completion_gates` entry is satisfied or
explicitly descoped by a human; and every blocking `known_open_decisions` entry
has either been resolved into tickets or accepted as out of scope.
