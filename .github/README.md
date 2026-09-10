# Controller CI

[`workflows/ci.yml`](workflows/ci.yml) runs the tooling build, lint, test and
changed-Markdown checks on every push and on opened, synchronized and reopened
pull requests. Drafts and documentation changes use the same jobs. There are no
branch, path or draft filters. Duplicate events for the same repository, head
and event type replace the earlier run; push and PR runs remain separate.

## Tested commit and credentials

PR jobs explicitly check out `github.event.pull_request.head.sha`; push jobs
check out `github.sha`. Each executing job verifies and records its checkout
SHA. The aggregate records the tested SHA, event, event base SHA and workflow
ref. A PR's event/merge ref is therefore distinct from the commit tested by CI.

The caller passes the required `tested-ref` input and `tooling-directory: .` to
[`symphony-build`](workflows/symphony-build.yml),
[`symphony-lint`](workflows/symphony-lint.yml) and
[`symphony-test`](workflows/symphony-test.yml). Other adopters must also pass an
exact commit SHA; `tooling-directory` remains optional and defaults to `.`.
These workflows execute against the caller repository, including when the
tooling lives in a subdirectory.

All checkouts disable persisted credentials. The only token permission is
`contents: read`; no secrets are inherited, no privileged environment is used,
and no provider, App signing or Linear credentials are supplied. This workflow
uses `pull_request`, not the privileged review workflow's event. App-authored
pushes/PRs must be confirmed by actual runs during the App rollout; bootstrap
runs use the existing implementation identity.

## Commands and required result

Jobs use Ubuntu 24.04, Node from `.nvmrc`, npm 11.13.0 and `npm ci` with the
committed tooling-root `package-lock.json`. npm caches are keyed by that lock.
This caller and the reusable jobs enforce the frozen lock; the root README's
original extraction example predates this setup.

| Caller job                    | Validation                                 | Timeout    |
| ----------------------------- | ------------------------------------------ | ---------- |
| `build`                       | `npm run build`                            | 20 minutes |
| `lint`                        | `npm run lint`                             | 20 minutes |
| `test`                        | `npm test`                                 | 20 minutes |
| `markdown` / Changed Markdown | Locked Prettier on changed Markdown        | 20 minutes |
| `required` / CI Required      | Every expected child must report `success` | 5 minutes  |

Markdown uses the PR merge base, or the push's before SHA. A new branch/tag
compares against its merge base with the default branch. If comparison history
is unavailable for a push, all tracked Markdown is checked. Added, modified,
copied and renamed `.md`, `.mdx` and `.markdown` files are checked, including
paths containing spaces; deleted files are excluded. Repository ignore rules
do not hide changed Markdown from this check. A comparison with no Markdown
still completes the job successfully and records a zero count.

`CI Required` uses `always()` and explicitly requires `build`, `lint`, `test`
and `markdown`. Missing, failed, canceled or skipped children fail the aggregate.
The run summary reports each actual child result. Baseline failures remain
visible; do not add `continue-on-error` or suppress a suite to obtain green CI.

The configured end-to-end run budget is 120 minutes for the consuming
reconciler, including queue and dependency waits. GitHub does not provide a
workflow-level timeout here; the five-minute aggregate timeout starts when its
job executes after its dependencies finish.

## Validation and evidence handoff

Run local checks before publication:

```bash
npm ci
npm run build
npm run lint
npm test
npx prettier --check .github/workflows/ci.yml .github/README.md
```

If checks pass locally, record `Docker: skipped — passed locally`. Use Docker
only for unavailable local tooling/services. Always inspect repository CI on
the published head; local success does not replace it.

```bash
head_sha=$(git rev-parse HEAD)
gh run list --repo 1000lines/symphony-example --commit "$head_sha"
gh api "repos/1000lines/symphony-example/commits/$head_sha/check-runs" \
  --paginate --jq '.check_runs[] | {id, name, head_sha, status, conclusion, app_id: .app.id, details_url}'
```

For each observed CI run, read `gh run view RUN_ID --repo
1000lines/symphony-example --json headSha,event,workflowName,jobs,url` and
`gh api repos/1000lines/symphony-example/actions/runs/RUN_ID`. Substitute the
actual run ID from the list. Retain the run/attempt URL, tested SHA from the
checkout summaries, workflow path/ref, child job IDs/results and aggregate
result in the issue workpad and PR evidence.

The intended required check is `CI Required`, from GitHub Actions (expected
App ID `15368`) and `.github/workflows/ci.yml`, on `push` or `pull_request` at
the exact head. Verify that emitted name and App ID from the first real run.
App ID alone does not establish workflow provenance. A missing, stale or
non-successful check cannot satisfy the requirement; review/router checks
are separate from this allowlist.

Keep the initial PR draft and the issue Inactive while CI or review is pending.
After human acceptance/merge, record another exact-SHA run on `main`.
DEPLOY owns required-check settings and App-authored docs/code rehearsal;
this ticket does not change branch rules or workflow enablement. The bootstrap
branch push run is evidence for its creating PR; a future default-branch
dispatch is not.
