# Writing a pull request

For GitHub UI, CLI and API publishing, use the target repository's PR template.
When the target has none, use the shared
[PR template](../../../.github/pull_request_template.md)
at `$SYMPHONY_TOOLING_ROOT/.github/pull_request_template.md`.
It follows the concise Context, TL;DR, Summary,
Alternatives and Test Plan structure of the
[Symphony reference](https://github.com/1000lines/symphony/blob/main/.github/pull_request_template.md).
Remove instructions and unused optional sections; a published PR should have
finished prose, a real diagram and concrete evidence.

## Explain the value

In Context, use two or three short sentences to say what changes, name/link the
specific goal in the current project brief, and explain its user or business
benefit. A project name alone or “improves reliability” is insufficient. For
standalone work, link the commissioned issue goal instead of inventing a wider
project. TL;DR states the result in one short sentence. Start Summary with the
product outcome, followed by a few high-level change bullets. Include Alternatives
only when a choice or tradeoff helps review. Record the selected base branch.

For example, a PR adding a description template could say: “This adds a consistent PR
description that explains the change and shows linked progress. It fulfills
[100-28's goal of understandable PRs with project value and progress](https://linear.app/1000lines/issue/100-28),
so Jeremy can judge why a change matters and navigate related work without
reading the code.”

## Show the accepted plan

Link the current accepted plan revision and record the UTC time at which status
was checked. Read accepted replans and fresh human decisions too. Copy that
plan's nodes and edges; preserve IDs and dependency meaning. Do not derive edges
from branch ancestry, issue order or convenience. Use the existing
`$SYMPHONY_TOOLING_ROOT/tools/symphony-dag/` parser when checking accepted plan
topology (`SYMPHONY_TOOLING_ROOT` is the shared tooling checkout). The PR diagram
is a progress view of that plan, not a new manifest or planning authority.

Resolve each node's actual PR association from the issue/plan and GitHub. Check
the repository, issue, base branch, current head, open/draft/closed/merged state
and merge timestamp, for example:

```bash
gh pr view "$pr_url" --json url,title,body,baseRefName,headRefOid,state,isDraft,mergedAt
```

Use the current Linear issue state and acceptance evidence alongside GitHub:

| Appearance            | Evidence                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Green / Completed     | The node's work is accepted; required code PRs are merged to the selected base. For non-code work, link its explicit acceptance.           |
| Blue / In progress    | An associated PR is open (including draft/review/rework), or the workpad confirms implementation has started without a PR.                 |
| Neutral / named state | Planned, blocked, canceled, closed without merge, or unknown. An Active ticket waiting on prerequisites alone does not prove work started. |

A green CI check, approval, `mature` label or closed-but-unmerged PR is not proof
of completion. If a node spans multiple required PRs, link all of them and mark
it completed only when the whole node is accepted. If evidence conflicts or is
unavailable, label the state unknown and record the gap rather than guessing.

Keep the template's fill classes and text labels. Apply the current-node outline
with a separate `style NODE stroke:#8250df,stroke-width:4px` and include “Current
PR” in its label, so both completed and in-progress current nodes remain legible.
Use a separator such as `#123 — In progress` in labels; Mermaid interprets
`#123;` as a character escape, hiding the PR number.
Keep the small legend disconnected from the plan. Label nodes without PRs
“no PR yet”; use “no PR — not planned” for accepted no-PR work. For standalone
work, retain just the current task and legend, with no dependency arrows.

For every node with a PR, use Mermaid's supported URL form:
`click NODE href "https://github.com/OWNER/REPO/pull/NUMBER" "Open PR" _blank`.
Substitute a verified URL, never an assumed next number. For multiple PRs on one
node, use its primary PR as the click target and list all links immediately below
the diagram. Keep a short Markdown link list there as an accessible fallback.
Do not use JavaScript callbacks, HTML links in labels or custom renderer settings.

## Publish and refresh

1. Read the target repository's template (or the shared fallback above) and write
   a filled body to a local file. Remove the scaffold's separate HTML-comment
   delimiters **before** adding nodes or edges: Mermaid arrows contain `-->`,
   which would end an enclosing comment prematurely. Remove instruction comments.
   For CLI, pass it with `gh pr create --draft --base "$base" --body-file "$body_file"`;
   for API, send its exact contents as the PR `body`. Do not rely on automatic
   UI insertion, `--fill` or commit messages to populate the description.
2. Before creation, the current node may honestly say “no PR yet” and have no
   link. Capture the returned PR URL, add the actual number and Mermaid click
   link, then update using `gh pr edit "$pr_url" --body-file "$body_file"` or the
   REST pull-request update endpoint. Read back the stored body.
3. Before each publish/rework handoff, re-read the accepted plan and node statuses.
   Update Context, TL;DR, Summary, topology, labels and links together when scope
   changes. Reflect observed draft/ready, review, closed, reopened and merged
   transitions. A changed plan or status can require a body-only edit.
4. On a later status/replan event handled by the worker, refresh its linked PR
   even if there is no code change. Preserve resolved human feedback. Do not
   create a service or mutate sibling PR bodies just to keep a snapshot fresh.
   When no worker handles a later event, the PR owner performs this refresh;
   the timestamp makes that manual maintenance boundary visible.

## Verify and record evidence

Follow the [proof standard](proof-of-work.md): local, Docker only if needed,
then mandatory CI on the published head. Choose commands from the target
repository's validation guidance and package/build configuration. Run validation
from the **target issue workspace**, with paths pointing to the target's files.
For `1000lines/symphony-example`, use its [package.json](../../../package.json):
run locked `node_modules/.bin/prettier --check <changed-markdown-paths>` and
`git diff --check` for template/docs edits, relevant existing workflow tests for
guidance changes, and npm/Node tests for implementation changes. If the locked
formatter is available only in the shared tooling checkout, invoke
`"$SYMPHONY_TOOLING_ROOT/node_modules/.bin/prettier" --check <changed-markdown-paths>`
while staying in the target workspace. `git diff --check` must also inspect the
target working tree, not the tooling checkout. Other target repositories use
their own commands. Do not copy the
reference repository's Elixir command. Record commands, outcomes, tested SHA,
CI run links, material limitations and the next handoff in Test plan and the
Codex workpad. Pending or stale checks are not passes.

Open the actual PR conversation in GitHub after saving the body. Confirm that
Mermaid renders a diagram, inspect the completed/in-progress/neutral colors,
current-node outline/text and legend, and click the PR nodes to verify their
destinations. Check both a planned multi-node example and a standalone example
when changing the template. A PR that changes the template may include a clearly
labeled, dated example based on an actual planned PR, avoiding changes to the
source PR's body solely for demonstration.
Record the PR URL, body revision/time, browser, link destinations and result;
attach screenshots or walkthrough notes. Syntax validation, GitHub's Markdown
API response and local Mermaid rendering alone do not prove GitHub rendering.

See [GitHub's diagram documentation](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams)
and [Mermaid's URL-link syntax](https://mermaid.js.org/syntax/flowchart.html#interaction).
