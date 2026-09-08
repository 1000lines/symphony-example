# Symphony Fan-Out Integration Patterns

Use this guide when a Symphony fan-out item intentionally creates a temporary
seam so clean task PRs can remain reviewable against the selected base branch
while composed behavior is validated on an accepted target ref.

The source of truth for ticket metadata is the fan-out plan
[`integration_pattern`](../../symphony-plans/fan-out-plan-schema.md#item-fields)
and `finalization_responsibility` fields. This guide explains how to choose and
review those fields; it does not replace the schema.

## Baseline Rule

Prefer no temporary seam. If a ticket can be implemented, validated, and
reviewed without a TODO, stub, adapter, compatibility export, flag, or disabled
branch, use `integration_pattern: none`.

When the planner can order sibling items so a durable contract lands first and
the consumer can import it directly from the base branch, prefer that ordinary
sequencing path over a temporary seam. This is still `integration_pattern:
none`; do not model the durable contract itself as a finalizer-owned seam.

When a seam is needed, the plan item must name:

- the one item and exact file that owns the seam
- the exact repo-relative seam files
- one searchable marker, symbol, flag, or stub path
- isolated validation for the clean task branch
- composed validation for the accepted target ref
- the finalizer item and the cleanup action it owns

Use project-scoped markers such as `TODO(<project-code>-finalize): ...`,
`<ProjectCode>Temporary...`, or `SYMPHONY_<PROJECT_CODE>_...` rather than
generic TODOs or unqualified temporary names.

## Patterns

### Finalizer TODO

Use `finalizer_todo` when a ticket must leave a temporary instruction in a
durable file, but the local behavior is otherwise complete. Typical examples
are a compatibility export, an extra registration line, or an interim branch
that should disappear once sibling work lands.

The seam is owned by the implementation item that edits the exact file
containing the TODO. Do not assign ownership to the later finalizer; the
finalizer owns removal, not the original seam.

The marker is the exact TODO text. It must include the project code or finalize
issue and the concrete cleanup target, for example:

```text
TODO(<project-code>-finalize): remove <ProjectCode>LegacyExport after <producer-ticket> composes.
```

Isolated validation proves the clean branch still passes its targeted checks
and that the TODO exists only in the planned seam file. A useful check is an
`rg` search for the exact marker in `seam_files`.

Composed validation proves the accepted target ref works with the related
project items present and that the finalizer ledger still finds the marker.

The finalizer must remove the TODO and the temporary code it describes. If the
underlying contract becomes durable, the finalizer must promote it by removing
the project-scoped marker and documenting the permanent owner.

### Isolated Stub File

Use `isolated_stub_file` when a downstream slice needs a compile-time or test
fixture stand-in before the real producer lands, and the stand-in can be kept
in one obvious file. Stubs are acceptable for fan-out independence only when
they are typed and isolated from production behavior.

The seam is owned by the item that creates the stub file. If a narrow export is
needed so consumers can import the stub, that export is part of the same seam
ownership and should be listed in `seam_files`.

The marker is the stub path, a stub-only exported symbol, or a header comment
that includes the project code, for example:

```text
STUB(<project-code>-finalize): replace with ReviewQueuePublisher after <producer-ticket>.
```

Isolated validation proves the stub satisfies the same typed contract the real
producer will satisfy. It should also prove the stub is not accidentally used
by production registration or runtime paths unless the plan explicitly owns
that disabled path.

Composed validation proves the accepted target ref uses the real producer or the
intended adapter instead of the stub, and that the stub marker is still
searchable for finalizer cleanup.

The finalizer must delete the stub file, remove stub exports and imports, and
replace any remaining references with the real implementation. If the stub
turns into a durable fixture, it must be renamed and documented as a fixture,
with all project-scoped stub markers removed.

### Typed Contract Or Adapter

Use `typed_contract_or_adapter` when two fan-out slices need to agree on a
payload, interface, provider token, event shape, or adapter boundary before
both sides can land. This is the preferred alternative to `unknown` payloads,
casts, duplicate shadow types, or late runtime lookups.

The seam is owned by the item that creates the contract or adapter file. There
should be one source of truth for the type, token, or adapter symbol. Producer
and consumer items should import that contract rather than redefining it.

The marker is the exported contract or adapter symbol, plus a project-scoped
TODO when the adapter shape is temporary. Examples include
`<ProjectCode>ReviewEventPayload`, `<ProjectCode>ReviewPublisherAdapter`, or
`TODO(<project-code>-finalize): flatten <ProjectCode>ReviewPublisherAdapter`.

Isolated validation proves the contract compiles and the owning slice can use
it without sibling runtime wiring. Prefer type checks, focused unit tests, or
fixture validation around the shared payload.

Composed validation proves producer and consumer behavior through the adapter
or contract after related items are present on the accepted target ref. For
queue, DI, route, or module seams, the composed check should exercise the actual
registration path, not only the contract type.

The finalizer must either promote the contract as durable architecture or
flatten the temporary adapter. Promotion means removing project-scoped markers
and documenting the permanent owner. Flattening means deleting compatibility
exports, casts, extra adapter layers, and TODOs that existed only to keep
fan-out PRs disjoint.

### Disabled Or Flagged Path

Use `disabled_or_flagged_path` when code must be checked in before it can run
by default. This is appropriate for feature flags, disabled queue handlers,
off-by-default route registration, or credential-dependent paths that need
review before activation.

The seam is owned by the file that defines the flag, disabled branch, or
registration gate. Do not scatter independent checks across callers. If a
module, route, workflow, or config file owns the gate, assign that file to one
seam-owner item.

The marker is the flag name, config key, disabled-path identifier, or exact
branch comment, for example `SYMPHONY_<PROJECT_CODE>_REVIEW_ENABLED` or
`disabled<ProjectCode>ReviewPath`.

Isolated validation proves the default disabled state is safe. Tests should
show that side effects do not run while the path is disabled, and that the
marker or flag remains searchable.

Composed validation proves the intended behavior with the flag enabled or the
disabled path composed with related project items. When credentials or external
systems are unavailable, the ticket should record the blocked composed check
rather than silently treating the disabled state as complete.

The finalizer must remove the temporary gate when rollout is complete, or
promote the flag to a durable feature flag with an owner, default, and
documentation. A project-scoped flag marker must not survive project
completion.

## Finalizer Items

Create or identify a finalizer item whenever a fan-out plan introduces any
non-`none` `integration_pattern`. A finalizer can cover several seams, but it
must list each marker, stub path, adapter symbol, disabled flag, compatibility
export, and project-scoped TODO from the contributing items'
`finalization_responsibility` fields.

Before a project is complete, the finalizer must verify:

- every planned marker was searched on the accepted target ref
- unexpected project-scoped TODOs or temporary symbols were investigated
- stub files were deleted or promoted to durable fixtures
- temporary adapters and compatibility exports were flattened or promoted
- disabled paths and rollout flags were removed or promoted to durable rollout
  controls
- missed sibling obligations, documentation mismatches, or workflow gaps found
  during the audit were fixed or explicitly handed off
- composed validation ran after cleanup, or a human explicitly descoped the
  remaining gate

A practical completion check is to run `rg` for the project code, finalize
issue, stub markers, temporary adapter names, and flag prefixes named in the
finalizer ledger. The project should not be marked complete while those
searches find unresolved temporary markers.

## Hidden Dynamic Wiring Anti-Patterns

Do not hide fan-out seams behind dynamic runtime behavior. These patterns make
isolated PRs look safe while moving risk into startup or integration time:

- optional `require`, `import()`, `ModuleRef`, service-locator, or registry
  lookup used to avoid declaring a real dependency
- `unknown`, `any`, casts, or duplicate shadow payload types across producer
  and consumer slices
- generic TODOs that do not name a finalizer item or searchable project marker
- stubs placed in production registration paths without a disabled-path
  pattern and validation
- feature flags with no finalizer owner, default-state test, or activation
  validation
- silent no-op branches that make composed behavior appear to pass when wiring
  is missing

If late lookup or dynamic wiring is unavoidable for a short-lived fan-out
window, model it as a typed contract or disabled path, give it one seam owner,
make the marker searchable, and assign finalizer cleanup before the spawned
ticket is considered ready.
