# Symphony hackathon readiness

```yaml
project-code: hackathon-ready
project-color: pink
base-branch: main
human-lead: Jeremy Carroll
```

## Goal

Finish the minimum Symphony setup needed for the September 12, 2026 hackathon:
Codex-powered Cadence review, GitHub App identities that clients can install
without inviting bot users, and repository CI as the source of test evidence.
Jeremy requested this project on September 9. He plans to email the organizers
on September 10 about starter-kit keys; that email is his action.

Primary repository: `1000lines/symphony-example`. Runtime repository:
`1000lines/symphony`, only where the accepted design requires a runtime change.
The live host is `https://symphony.1000lines.dev` in Jeremy's personal AWS account
`350353785278`, region `us-west-2`.

## Required outcomes

### Codex review

- Replace Cadence's Anthropic/Claude execution with Codex while preserving its
  review criteria, actionable findings, current-head checks, Linear reporting,
  loop prevention and human handoff. Adapt the existing review instructions;
  changing providers must not silently weaken the acceptance gate.
- Initially reuse the same OpenAI API key already used by Symphony. Record the
  exact secret locations and reload procedure so Jeremy can replace the value
  with the organizers' event key without code changes. Never commit key values.
- Prove a real review with Codex and eliminate the active review path's need
  for the Anthropic key. Coordinate the cutover so the working reviewer remains
  available until the replacement is verified.
- Treat the organizers' response/key as an external input for final credential
  rotation, not a blocker on requirements, design or initial implementation.

### GitHub App identities

- Replace `1000-symphony-bot` and `1000-cadence-bot` PAT-based execution with
  GitHub App installation credentials. Keep implementation and review identities
  distinct. Inventory existing registrations and installations before creating
  duplicates; record App ownership and the operator actions needed.
- Define and validate a permission matrix for clone/push, workflow changes,
  PR creation, labels, CI reads, review publication and handoff. Request only
  permissions needed by those operations and handle installation approval when
  permissions change. Include token renewal for long-running workers, expired
  tokens, revoked installations and repository selection.
- Evaluate making Cadence's acceptance verdict a check run, as Jeremy suggested.
  If selected, define the check name, emitting App, commit SHA, conclusion and
  findings format. Update every consumer of the old APPROVE signal, including
  maturity, human handoff, stale-review detection and loop/coalescing logic.
  A successful AI check is distinct from Jeremy's human acceptance.
- Prove the chosen flow on a repository where neither bot user is a collaborator.
  Installing the Apps with the documented permissions must be sufficient.
  Avoid a hidden dependency on Jeremy's PAT or another customer's credentials.
- Document rollout, recovery and removal of obsolete PAT dependencies after
  verification; do not delete bot accounts as part of this project.

### Repository CI and waiting work

- Use each target repository's CI for validation even for the smallest change,
  including documentation. Reuse its existing build/test/lint workflows; wire
  the extracted reusable workflows into an appropriate caller where needed.
  Lightweight changes can have lightweight checks, but cannot bypass CI evidence.
- Record the workflow/run URL, tested commit, required checks and results. Missing,
  failed, canceled, timed-out or stale checks cannot count as passing. Verify that
  App-authored pushes and PRs actually trigger the required workflows.
- Missing local toolchains, such as Rust on the Symphony host, must not prevent
  publishing a reviewable change for CI to test. Update instructions that require
  unavailable local tests or prohibit this explicitly authorized CI path. Keep
  cheap available local checks useful without installing every toolchain on the host.
- Release the worker slot while CI is pending, then resume actionable failures
  or advance successful current-head evidence to the appropriate review/human gate.
  Define a small, observable recovery path for missed events and pending checks.
- Prefer the existing daemon mechanism: add `Happy`, `Unhappy` and `Evaluating`
  to Linear and the runtime workflow as needed, with `wake:15m`. Design must spell
  out whether a daemon monitors waiting ordinary tickets or which issues enter
  daemon states, how verdicts map to CI results, and how implementation work is
  resumed. Adding state names alone is not a working CI handoff.
- Verified runtime source: `elixir/lib/symphony_elixir/daemon_wake.ex` hard-codes
  `15m`, `1h`, `4h`, `1d`; `config/schema.ex` validates the same values. `wake:5m`
  and timer wakeups for ordinary tickets would require runtime work. Use the
  existing 15-minute path unless design finds a concrete blocker; do not silently
  add either optional extension. Account for the runtime's jitter and polling.

## Acceptance criteria

- A small real change produces CI evidence, Codex review, the chosen App-owned
  acceptance signal and a correct Linear/human handoff without either bot user
  being a target-repository collaborator.
- A failing CI change resumes for correction; a corrected commit gets fresh
  checks and review. Pending checks release the worker; stale success cannot
  satisfy the current-head gate. Demonstrate the selected 15-minute wake/recovery
  path and prevent duplicate or looping execution.
- Demonstrate validation through a repository's CI without relying on the
  corresponding local host toolchain; Rust is the motivating example. Use an
  existing suitable test surface or a minimal rehearsal fixture, not a new product.
- Deploy/reload the accepted integration on the existing host and record actual
  evidence, credential inventory, required operator actions and remaining limits
  in `MIGRATION.md`. Keep keys out of commits, logs and Terraform state.
- Borrowed provider keys are replaced with event credentials before the hackathon;
  if the external key has not arrived, record the owner and blocking status rather
  than claiming final readiness. Jeremy owns obtaining the organizers' key.

## Planning and scope boundaries

Create only the three planning seeds now: requirements/design, DAG plan, fan-out.
The first is in Backlog; the other two are Blocked with explicit blocker relations.
Symphony's human-reviewed plan owns implementation decomposition and rollout.
Use the existing DAG tooling, direct edges and branch/PR policies. Include
cross-repository ownership and order shared workflow/credential changes explicitly.
All implementation frontier tickets start in Backlog; dependent work is Blocked.

This request brings Codex review, App migration and the selected daemon/CI support
into scope despite earlier deferral. Automatic Misc routing, Google Docs,
dashboard authentication, public refresh, optional AMI automation, general
multi-provider support and unrelated product work remain outside this project.
Keep Markdown sources and Route 53. The project is setup work, not hackathon
feature implementation. Creating this project does not activate its tickets or
alter the currently working server.

## Sources and design inputs

- Jeremy's September 9 request and follow-up about hard-coded wake options:
  authoritative scope, preserved above.
- `MIGRATION.md`, `WORKFLOW.md`, and
  `scripts/symphony/runtime-bundle/workflow/WORKFLOW.md`: current deployment and
  execution contract; read during setup.
- `.github/workflows/cadence-ai-review-trigger.yml`, Cadence event/handoff and
  Symphony CI/wakeup workflows: current implementation; inspected during setup.
- `docs/engineering/symphony/project-workflow.md` and `docs/symphony-plans/`:
  existing planning and state conventions.
- `1000lines/symphony` at `e4d3f6a05b0a00201c9d04d3ceca02b206e22de5`:
  `daemon_wake.ex` and `config/schema.ex` verify supported intervals and
  state-based daemon eligibility.
- [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action): official
  API-key-backed Codex execution/review option; fetched during setup. Design must
  choose and pin the actual integration rather than copy an example uncritically.
- [GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
  and [check runs](https://docs.github.com/en/rest/checks/runs): official design
  inputs, fetched during setup; check publication needs the appropriate Checks
  write permission.
- [Setup rehearsal PR #1](https://github.com/1000lines/symphony-example/pull/1):
  baseline proof of the existing PAT/Anthropic loop, not proof of the new flow.

No external design document or Google Doc is required. App registration inventory,
final permission choices, exact CI waiting mechanism and check-result semantics
are explicit requirements/design work, not missing project-creation inputs.
