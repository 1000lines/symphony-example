# Hackathon startup checklist

Use this checklist with the [migration log](MIGRATION.md) and the
[hosted workflow](scripts/symphony/runtime-bundle/workflow/WORKFLOW.md).
The dashboard is verified; the complete implementation/review loop still needs
proof from the setup rehearsal.

## Before Saturday, September 12, 2026

- [ ] Replace both borrowed Orchestra provider keys with event keys: the host's
  OpenAI key and GitHub Actions' Cadence Anthropic key. Reload host credentials
  and verify provider authentication. Keep all key values out of the repository
  and logs.
- [ ] Open the [Symphony dashboard](https://symphony.1000lines.dev) and confirm
  host health and Linear polling. The dashboard is public and updates
  automatically; public refresh is disabled.
- [ ] Confirm host authentication and commits use `1000-symphony-bot`, and
  Cadence reviews use `1000-cadence-bot`. Check the repository variables
  `SYMPHONY_BOT_USER` and `CADENCE_REVIEWER` match. Jeremy Carroll
  (`jeremycarroll`) is the human lead.
- [ ] Confirm each project's `project-code`, `project-color`, `base-branch`
  (default `main`), and `human-lead`; ensure the repository already has both
  `symphony` and the project's color label. The setup rehearsal uses
  `setup-rehearsal`, `teal`, and `main`.
- [ ] Leave the hackathon DAG's ready frontier in `Backlog` until the starter
  gun. Keep downstream issues `Blocked`, with explicit Linear dependencies
  pointing from each prerequisite to the issue it blocks.

## At the starter gun

- [ ] Move the first ready frontier ticket to `Active` after confirming its
  prerequisites are satisfied. Watch the dashboard for Symphony to pick it up.
  Only `Active` is dispatched; leave other tickets parked until ready to start.

## Follow the first PR through review

- [ ] Confirm the draft PR identifies its Linear ticket, targets the project's
  base branch, carries `symphony` and the project color label, and is assigned
  to `jeremycarroll`. Watch checks and the review request to `1000-cadence-bot`.
- [ ] Verify the review workflows are enabled and Cadence authenticates and
  reviews the current PR head. Request Jeremy's review after Symphony/Cadence
  closure or the configured review-loop cap, with any remaining question stated.
- [ ] Keep the issue `Inactive` while checks, review, or missing input are pending;
  return actionable rework to `Active`. Jeremy monitors stalled runs, PR feedback,
  and dependency progression and follows up manually while automation remains
  incomplete. Daemon monitoring is deferred. Record actual rehearsal outcomes
  in the migration log; human acceptance owns completion.
