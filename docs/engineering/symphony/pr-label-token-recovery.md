# PR-label token permissions and recovery

When the installed PR-label helper reports `Add missing PR labels: HTTP 403`,
compare its token permissions with the existing task-bound Symphony App before
concluding that the installation lacks access. This guide covers the verification
and recovery commissioned by [100-86](https://linear.app/1000lines/issue/100-86).
It does not change the helper, installation grants, or review/wakeup policy.

## What to compare

The installed `ensure-pr-labels.mjs` constructs an App client with
`pull_requests:read` and `issues:write`, overriding the worker configuration's
permissions. The broker adds `metadata:read`, requests a single-repository
installation token, validates the returned permissions, and reads back the
repository selection. A successful worker preflight therefore does not establish
that the helper's separately narrowed token can write PR labels.

Both paths use `POST /repos/OWNER/REPO/issues/PR_NUMBER/labels`; recovery changes
the token used for that request, not the endpoint. The hosted `gh` wrapper uses
the existing task-bound App configuration. Setting `GH_TOKEN` for the helper
does not override its App client when App mode/configuration is present.

[GitHub's label endpoint documentation](https://docs.github.com/en/rest/issues/labels#add-labels-to-an-issue)
lists Issues write or Pull requests write and describes POST as adding to existing
labels. Keep that documented contract separate from the observed permission
combination: a 403 under the helper and success under the task token establishes
a token-dependent failure, not a universal rule about every installation.

## Supported recovery

Use the issue's verified repository, uniquely associated open PR, current owning
Linear project's `project-color`, and recorded task-bound App configuration.
Check the PR's title, branch, base repository and issue attachment where present;
do not guess the PR number or infer the color from the branch or issue labels.
Conflicting metadata, ambiguous association, and `no-open-pr` when publication
was expected must be resolved before recovery.

1. Reuse the task's existing binding and verify it. The example below is for
   100-86; substitute the actual recorded task configuration for other issues.
   The preflight prints identity, repository selection and permissions, not
   credentials. Never print the configuration file, token cache or auth headers.

   ```bash
   export SYMPHONY_GITHUB_APP_CONFIG="$SYMPHONY_GITHUB_APP_CACHE/targets/100-86/github-app.json"
   node "$SYMPHONY_GITHUB_APP_AUTH" --preflight --repository 1000lines/symphony-example
   ```

2. Record the current PR labels, then confirm **all** required label definitions
   exist before any write. Set `pr` to the verified open PR number. Here the
   owning Misc project specifies `blue`; additional required labels must also
   be checked and included. URL-encode label names used in paths.

   ```bash
   gh api "repos/1000lines/symphony-example/issues/$pr/labels" \
     --paginate --jq '.[].name'
   gh api repos/1000lines/symphony-example/labels/symphony --jq .name
   gh api repos/1000lines/symphony-example/labels/blue --jq .name
   ```

   Stop on an error. A missing label needs the applicable authorized repository
   setup path; this recovery does not create labels or change their definitions.

3. Through the hosted App-backed `gh`, add the required labels using the narrow
   REST endpoint and existing grants. This additive request can safely include
   a required label that is already present. Preserve every unrelated label.
   Do not use PUT to replace the set, remove/re-add labels, or use
   `gh pr edit --add-label`, which can require broader organization queries.

   ```bash
   gh api --method POST "repos/1000lines/symphony-example/issues/$pr/labels" \
     -f 'labels[]=symphony' -f 'labels[]=blue' --jq '.[].name'
   ```

4. Rerun the installed helper with the same issue/repository, then independently
   read back the actual labels. Require both `symphony` and the current project
   color, every additional required label, and all previously unrelated labels.
   Compare sets rather than response order.

   ```bash
   node "$SYMPHONY_TOOLING_ROOT/scripts/symphony/ensure-pr-labels.mjs" \
     --issue 100-86 --repo 1000lines/symphony-example
   gh api "repos/1000lines/symphony-example/issues/$pr/labels" \
     --paginate --jq '.[].name'
   ```

   After REST recovery, the helper should report `already-correct`, `added: []`,
   and verified `symphony`/project-color labels. This verifies its read path;
   it does **not** prove its narrowed token can now add missing labels. A 200
   POST, an intended command, or a best-effort hook alone is insufficient proof.

## Distinguish other failures

| Observation                                                                                       | Meaning and next action                                                                                                                                               |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Helper POST fails; task App POST succeeds; helper and independent readbacks pass                  | Supported recovery for the observed token-narrowing case. Record both permission sets and results.                                                                    |
| App binding/preflight rejects repository selection, a suspended installation, or a required grant | Installation/setup access is unavailable. Stop dependent writes and identify the repository, App, exact denial, owner action and required readback.                   |
| Task App POST also returns 403                                                                    | Recovery is unverified; do not classify the cause solely from the status. Record the denied operation and verified permissions for the operator.                      |
| Required label GET returns 404                                                                    | Establish repository access before diagnosing an absent definition; 404 can conceal unavailable resources. Use authorized label setup only when absence is confirmed. |
| Helper or independent readback is incomplete, missing labels, or denied                           | Publication remains unverified. Record the actual failure and follow existing blocker handling.                                                                       |

Renewing a token cannot add installation grants. GitHub's
[installation-token API](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app)
limits tokens to repositories and permissions already granted to the App. Do
not edit the App manifest, expand the installation, borrow a PAT/another App,
or change workflow permissions to make this recovery pass. A denied operation
needs its own operator handoff; successful label recovery does not prove CI,
Cadence execution, host reload, or event delivery.

## Live evidence: 100-86

Reproduced on 2026-09-12, 02:54–02:55 UTC, on the App-authored draft
[symphony-example PR #56](https://github.com/1000lines/symphony-example/pull/56),
head `ee635b44adde9a397912d8a686def9fb3d70b9c5`, based on
`main@e4cab13e238fed6095906c9b009e891b1670a9e4`. The PR initially had only
`documentation`, an existing repository label added for this preservation check.
Both required definitions existed; neither required PR label was removed to
produce the failure.

Installed tooling ref: `a3b7428a9e0298592e119a57923854b75a9b61a0`.
The installed and selected-base helper/broker files had matching SHA-256 hashes:

- `ensure-pr-labels.mjs`:
  `5ae761a503e6c8050f0c98668d9576302e7d2f0034ac4bb8553adf08984c36af`.
- `github-app-auth.mjs` (including the hosted `gh` broker):
  `0a161a52acc105b8f6c2b4c59d989f2f7faf80b92c2f03e249e4938b1acfbc2b`.

The same App (`1000lines-symphony`, ID `4866508`), installation `160626742`,
and repository ID `1362180215` were used throughout. A local observer delegated
to the installed broker/helper and real fetch, logging only allowlisted request
and response fields. Fresh token requests returned HTTP 201 with exactly the
permissions below; both `/installation/repositories` readbacks returned one
repository, `1000lines/symphony-example`. No installation grants were changed.

| Token                   | Requested and returned permissions                                                                                         | Label POST result                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Helper                  | `metadata:read`, `issues:write`, `pull_requests:read`                                                                      | HTTP 403, `Resource not accessible by integration`   |
| Existing task-bound App | `metadata:read`, `actions:read`, `checks:read`, `contents:write`, `issues:write`, `pull_requests:write`, `workflows:write` | HTTP 200; labels `documentation`, `symphony`, `blue` |

The ordinary installed helper CLI exited 1 with
`Symphony PR label repair: Add missing PR labels: HTTP 403.` A second invocation
through the observer, after refreshing the same narrowed permissions, confirmed
that the failed operation was the label POST, following successful PR lookup,
label read and definition checks. Its request body was
`{"labels":["symphony","blue"]}`. GitHub request ID:
`E8A1:237E50:17E2204:1909C69:6AA4BF01`.

The supported `gh api --method POST` recovery sent the same two labels to the
same `/repos/1000lines/symphony-example/issues/56/labels` endpoint. GitHub returned
HTTP 200 at 02:55:06 UTC (request ID
`88D7:12AE18:1892F67:19BA85F:6AA4BF09`, selected API version `2022-11-28`).
Both POST responses advertised `issues=write; pull_requests=write` in
`X-Accepted-GitHub-Permissions`. The task token has several additional grants;
this comparison does not independently isolate each grant's effect or establish
GitHub's internal permission-selection behavior.

The helper then exited 0 twice with:

```json
{
  "issue": "100-86",
  "repository": "1000lines/symphony-example",
  "pr": 56,
  "result": "already-correct",
  "added": [],
  "verified": ["symphony", "blue"]
}
```

Between those invocations, an independent paginated `gh api` GET returned
`["documentation","symphony","blue"]`. The failed helper attempt, additive
recovery and repeated readback preserved `documentation`. These are successful
recovery/readback results; the helper's missing-label write remains defective
at the recorded revision. The pinned
[100-86 workpad](https://linear.app/1000lines/issue/100-86#comment-46cbe672)
holds the validation and current PR handoff record.

## Relationship to 100-69 and regression expectations

[100-69](https://linear.app/1000lines/issue/100-69) originally owned new-PR/startup
labeling verification. Its current state is **Canceled** (read 2026-09-12).
Its older workpad describes an Inactive wait for missing `blue` definitions in
other repositories; that historical workpad is not the current issue state or
proof of this 403 case. Leave 100-69 canceled and carry this follow-up in 100-86.
No startup/restart, replacement-PR, project-move or event-ordering acceptance is
inherited as completed by this narrower recovery.

For each live reproduction retain UTC time, repository/PR/head, installed helper
and broker revisions/hashes, App and installation IDs, requested and returned
permission sets, single-repository readback, sanitized HTTP results, labels
before/after, helper output and independent GET result. Never retain tokens,
private keys, complete token responses or request authorization headers.

Regression expectations for a future commissioned helper change:

- Exercise a fresh single-repository App token with the helper's actual
  requested permissions and a PR missing both required labels. Generic mocked
  label-write success does not establish live GitHub permission behavior.
- Preserve an unrelated label through failed repair, additive recovery and
  repeated helper/readback. Cover one missing label and already-correct repeats.
- Keep missing repository access/grants, missing definitions, ambiguous project
  metadata/PR association, and incomplete readback as explicit failures.
- After REST recovery, distinguish read-only `already-correct` success from a
  successful missing-label write. Any later permission fix needs a new live
  missing-label reproduction; do not remove labels from unrelated PRs to test it.
- Treat first publication after startup/restart, resumed workspaces, replacement
  PRs, current project changes and label-event consumer ordering as separate
  scenarios from 100-69, requiring their own evidence if recommissioned.

The existing `scripts/symphony/host/ensure-pr-labels.test.mjs` suite covers
additive repair, idempotence, metadata/association checks and failure readback.
Its fixtures complement the live permission comparison; this documentation
change adds no tooling implementation or test-only permission workaround.
