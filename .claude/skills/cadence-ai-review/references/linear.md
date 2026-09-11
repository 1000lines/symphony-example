# Cadence Linear Workpad

Cadence uses Linear in two distinct ways:

- **Acquisition:** read the linked issue context with
  `scripts/fetch-linear-issue.mjs`.
- **Workpad:** write detailed review state to one Linear issue comment headed
  `## Cadence Workpad` with `scripts/cadence-linear-workpad.mjs`.

The workpad helper is the primary Cadence Linear write path. Do not create ad hoc
comments as a substitute for review-state workpad updates, edit
`## Codex Workpad`, or mutate issue state, labels, assignees, relations, or
project metadata.

These CLI write steps belong to the legacy Claude runner. Check-mode Codex
assessment returns structured output without Linear credentials; trusted
publication validates and persists its `reviewContract` before publishing a
successful `Cadence Review`. Both fresh `ci_passes` and `ai_accepts`, closed
mandatory feedback and a ready PR are required for normal handoff. Preserve
generation, attempt, stable finding IDs and mandatory classifications across
writes; generated bookkeeping cannot reset the generation or findings cap.
A denied write or mismatched readback is an operational failure, never AI
acceptance. Do not substitute a PR approval or another workpad.

## Happy Path

1. Read the Linear issue during acquisition:

   ```sh
   node scripts/fetch-linear-issue.mjs DEMO-114
   ```

2. After synthesis, build a workpad JSON payload. Prefer the incremental
   `reviewUpdate` shape from
   `docs/engineering/review/cadence-linear-workpad.md` so the helper can read
   the prior `## Cadence Workpad`, assign the next review identifier, and append
   per-item history.

   Include status, trigger source, review state, disposition, last-reviewed SHA
   and timestamp, pending trigger or comment state, the GitHub-visible
   assessment summary, detailed findings, skipped or ignored events,
   prior/pending rerun state, human feedback, requirement updates, finding
   updates, learn-from-human items, and AI-to-AI coordination.

3. Write the workpad through the helper:

   ```sh
   node scripts/cadence-linear-workpad.mjs DEMO-114 workpad.json
   ```

   Use `-` instead of a file path to read JSON from stdin.

4. Read back the saved head and review state, then post the legacy runner's
   concise GitHub PR review assessment. The GitHub body should not
   duplicate the full workpad detail.

If the helper or Linear credentials fail, do not bypass this by writing the
Cadence workpad through another path. Report the configuration failure so the
workflow can stop or request human input.
