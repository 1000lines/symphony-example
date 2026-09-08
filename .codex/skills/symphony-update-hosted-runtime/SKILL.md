---
name: symphony-update-hosted-runtime
description: Human-operated Symphony host maintenance workflow for updating hosted Symphony to current bootstrap/runtime refs, refreshing a stale hosted runtime bundle, or rerunning host reconciliation outside ordinary ticket work. Use only when a human explicitly asks for hosted runtime update or host reconciliation; do not use for unattended ticket-agent implementation.
---

# Symphony Update Hosted Runtime

Use this skill from a human-controlled local checkout to update the shared
hosted Symphony runtime through the host-management CLI. This skill must stay
outside the hosted runtime bundle and must not be installed into the default
unattended Symphony agent profile.

## Boundaries

- Confirm explicit human approval for the target account, region, host name, and
  desired bootstrap/runtime refs before any mutating command.
- Do not run from ordinary hosted ticket work. A random ticket agent must not
  mutate the shared `CODEX_HOME`, runtime bundle, or host refs.
- Do not edit the installed runtime bundle or `CODEX_HOME` directly.
- Do not use an ad hoc SSM shell command to recover reconciliation when the
  host-management CLI can discover the target and run `reconcile --yes`.
- Stop and ask for the missing handoff when AWS credentials, GitHub access,
  Linear access, target refs, or human approval are absent.

## Workflow

1. Read `docs/operations/symphony-host.md`, then confirm the approved AWS
   account, region, host name, and target refs.
2. Build the management CLI:

   ```sh
   npm run build -w @example/symphony-host
   ```

3. Inspect the current target before mutation:

   ```sh
   node tools/symphony-host/dist/cli.js status \
     --region us-west-2 \
     --name symphony
   ```

4. If tags must change, update the approved refs with the CLI. When both refs
   change, set both tags first and run one reconciliation:

   ```sh
   node tools/symphony-host/dist/cli.js set-ref bootstrap <approved-bootstrap-ref> \
     --region us-west-2 \
     --name symphony \
     --yes
   node tools/symphony-host/dist/cli.js set-ref runtime <approved-runtime-ref> \
     --region us-west-2 \
     --name symphony \
     --yes
   node tools/symphony-host/dist/cli.js reconcile \
     --region us-west-2 \
     --name symphony \
     --yes
   ```

   If only one ref changes, `set-ref <kind> <ref> --reconcile --yes` is
   acceptable. If the refs are already correct but the installed runtime bundle
   is stale, run `reconcile --yes`.

5. Wait for the CLI to finish. The reconcile command waits for the submitted
   SSM invocation and must print terminal `SSM status: Success` before another
   reconcile attempt is launched.
6. Verify and record the reconcile evidence:
   `Reconciliation provenance:`,
   `Runtime bundle freshness: installed bundle matches current source`,
   `Symphony service readiness: symphony.service active`,
   `Symphony HTTP readiness: ok`, and
   `Completed: run Symphony reconciliation`.
7. Run `status` again and record the final refs, latest provenance, SSM status,
   target health, and any limitation or follow-up.
