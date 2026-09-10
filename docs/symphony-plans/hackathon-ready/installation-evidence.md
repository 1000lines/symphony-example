# App installations and secret destinations

INSTALL / [100-16](https://linear.app/1000lines/issue/100-16/prepare-and-verify-both-app-installations-and-secret-destinations).
Observed September 10, 2026, 18:26–18:28 UTC. Setup is **incomplete**:
Symphony's controller credential works with its existing grants; the accepted
permission delta, personal-owner installation, Cadence verification and protected
Environment require Jeremy's operator actions below. This is not cutover proof.

## References and custody

Selected branch and PR base: `main`. The merged consumer inspected and executed
is `23bbf8e88e04bdb3ae82b44b0dafa2c56e3ef465` (APP / PR #7); secret infrastructure
and the [population recipe](../../../infra/static/README.md#github-app-keys)
from 100-25 / PR #8 are also on that base. No predecessor code was copied.

Requirements: [accepted design](https://github.com/1000lines/symphony-example/blob/dc71026c35b7fc97f58e54cd03ce7fe513621e1f/docs/symphony-plans/hackathon-ready-design.md#github-apps-and-credential-contract)
R03/R04/D02/O01, [INSTALL item](https://github.com/1000lines/symphony-example/blob/8f4eafe3999040f67cd68e696e29bcb27eb44149/docs/symphony-plans/hackathon-ready/delivery-items.md#install),
and [execution contract](https://github.com/1000lines/symphony-example/blob/8f4eafe3999040f67cd68e696e29bcb27eb44149/docs/symphony-plans/hackathon-ready/execution-contract.md).
The current human activation direction supersedes old parked wording.

INSTALL owns setup verification. DEPLOY / 100-19 receives verified metadata and
owns mapping completion/enablement, branch-rule changes, host install/reload,
review cutover and live lifecycle rehearsal. The working host/reviewer remains
selected. No App registration, installation, Environment, IAM or stored secret
was changed in this observation. Only temporary App tokens were minted/revoked;
the workspace signing copy and private token cache were removed.

## Observed identities and access

| Resource                | Verified metadata                                                                                                                        | Limitation                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Symphony registration   | `4866508`, `1000lines-symphony`, owner `1000lines` (organization `325443473`)                                                            | Anonymous `GET /apps/1000lines-symphony` HTTP 200; authenticated `GET /app` confirms signing-key identity. Public-installability setting still needs operator readback.               |
| Cadence registration    | `4866513`, `1000lines-cadence`, same owner                                                                                               | Anonymous `GET /apps/1000lines-cadence` HTTP 200; no accessible Cadence signing key for App-authenticated verification.                                                               |
| Controller              | `1000lines/symphony-example`, repository `1362180215`, public, default `main`                                                            | `GET /repos/1000lines/symphony-example/branches/main` reports `protected: true`; detailed protection endpoint HTTP 404 for worker.                                                    |
| Personal target         | `jeremycarroll/venn-search-rs`, repository `1076114173`, public, default `main`                                                          | README, Cargo.toml and CI inspected at `99528c2e4da241ec2c9961d0a155357611f16a76`; no target mutation.                                                                                |
| Bootstrap GitHub caller | `1000-symphony-bot`, user `327018241`; controller push/triage, no admin; target read only                                                | Used for repository metadata and task publication, not installation proof. No Jeremy/customer PAT borrowed; migration away from the existing bot credential belongs to DEPLOY/RETIRE. |
| Target collaborators    | `GET /repos/jeremycarroll/venn-search-rs/collaborators?per_page=100` HTTP 403: “Must have push access to view repository collaborators.” | Neither bot's absence is verified. Jeremy checks the complete list.                                                                                                                   |

Anonymous App metadata has no visibility field and is insufficient to establish
public installability. Jeremy records the actual registration setting and both
owner installations; see [GitHub visibility documentation](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/making-a-github-app-public-or-private).

| App                | Installation owner | Installation ID | Selection / suspension / result                                                                                                                                                                                         |
| ------------------ | ------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Symphony `4866508` | `1000lines`        | `160626742`     | App-authenticated repository lookup HTTP 200; `selected`, `suspended_at: null`. Complete metadata-only installation-token enumeration returns only `1362180215`, `1000lines/symphony-example`. Token revoked, HTTP 204. |
| Symphony `4866508` | `jeremycarroll`    | None observed   | App-authenticated target lookup HTTP 404; complete `GET /app/installations` enumeration returns only the controller installation. Target installation is missing at observation.                                        |
| Cadence `4866513`  | `1000lines`        | Unverified      | Cadence signing key unavailable; bootstrap `GET /orgs/1000lines/installations` HTTP 404, requires unavailable organization administration.                                                                              |
| Cadence `4866513`  | `jeremycarroll`    | Unverified      | Requires Cadence App-authenticated discovery or Jeremy's installation settings readback. Never substitute `160626742`.                                                                                                  |

## Required grants

Both registration responses still have Actions read and omit Commit statuses.
Symphony installation `160626742` has the same old grants. Approve **Actions
read/write and Commit statuses read** on both registrations and each installation.
Token renewal cannot supply missing grants. Keep these complete ceilings:

| Repository permission        | Symphony | Cadence |
| ---------------------------- | -------- | ------- |
| Actions                      | write    | write   |
| Checks                       | read     | write   |
| Contents                     | write    | read    |
| Issues                       | write    | write   |
| Metadata                     | read     | read    |
| Pull requests                | write    | write   |
| Commit statuses (`statuses`) | read     | read    |
| Workflows                    | write    | none    |

No organization/account permissions, Administration, Secrets, Members, extra
webhook events or OAuth user-token flow. Both observed event lists are empty.
These are installation ceilings; operation tokens request only necessary grants.

## Secret and protection evidence

AWS caller: `arn:aws:sts::350353785278:assumed-role/symphony-instance/i-00e9329be67c4bc0c`;
account `350353785278`, region `us-west-2`, verified with STS before secret access.

| Destination / check              | Actual result                                                                                                                                                                                                                                  | Remaining action                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `symphony/github-apps/symphony`  | DescribeSecret and GetSecretValue succeed. ARN `arn:aws:secretsmanager:us-west-2:350353785278:secret:symphony/github-apps/symphony-xmjUL6`; version `f309e6b7-e4c5-4e7b-bb68-f720a0b96557`, `AWSCURRENT`, changed `2026-09-10T14:25:36.396Z`.  | Keep the working key. Correct operation grants only after owner approval; record replacement version metadata.                                            |
| Stored payload compatibility     | Merged `validateAppConfig` accepts camelCase `appId`, `appSlug`, `installationId`, `repositoryId`, `repository`, `permissions`, `privateKey`; stored binding matches the controller row above. Successful App authentication verifies the key. | Payload currently requests old grants, so compatibility does not establish matrix readiness.                                                              |
| Narrow host IAM                  | Merged Terraform `runtime-access` permits DescribeSecret/GetSecretValue for `symphony/keys-??????` and `symphony/github-apps/symphony-??????` in this account/region. Actual named-secret reads work.                                          | `iam:GetRolePolicy` is AccessDenied; Jeremy reads deployed policy to verify exact scope. Source inspection alone cannot prove no broader deployed grants. |
| `cadence-controller` Environment | Environment, branch-policy, secret-name and variable-list endpoints each return HTTP 404 to worker.                                                                                                                                            | Existence, exact-main restriction and contents unverified; inspect/reuse or create with administrator access. A 404 is not proof of absence.              |
| Environment secrets              | `CADENCE_APP_PRIVATE_KEY`, `CADENCE_OPENAI_API_KEY`, `CADENCE_LINEAR_API_TOKEN` all unverified.                                                                                                                                                | Populate/confirm names after protecting the Environment. Never copy them to the target repository.                                                        |
| Environment variables            | `CADENCE_APP_ID=4866513`, `CADENCE_CONTROLLER_INSTALLATION_ID=<observed Cadence controller ID>` required.                                                                                                                                      | Discover the actual Cadence ID, then set and read back both variables.                                                                                    |

## Jeremy operator actions

Perform these as the existing App owner/repository administrator on your own
machine or in GitHub settings. Administrative credentials stay with you; do not
grant the Apps administration or place a human PAT on the worker.

1. Open the existing [Symphony registration](https://github.com/organizations/1000lines/settings/apps/1000lines-symphony)
   and [Cadence registration](https://github.com/organizations/1000lines/settings/apps/1000lines-cadence).
   Verify IDs/owner above. Record public visibility; if private, use **Advanced →
   Make public** before cross-owner installation. Under **Permissions & events**,
   apply only the matrix delta and save. [GitHub's registration steps](https://docs.github.com/en/apps/maintaining-github-apps/modifying-a-github-app-registration)
   require installation owners to approve increased grants.
2. Reuse Symphony's controller installation and any existing Cadence installation.
   Use each registration's **Install App** page (or [Symphony](https://github.com/apps/1000lines-symphony/installations/new)
   / [Cadence](https://github.com/apps/1000lines-cadence/installations/new)).
   On `1000lines`, select only `symphony-example`; on `jeremycarroll`, select only
   `venn-search-rs`. Approve pending permission changes on each installation.
   Record all four App/owner/installation IDs, complete selected repositories,
   effective permissions and suspension status. Do not create another App.
3. Inspect the target's **Settings → Collaborators** and record absence of
   `1000-symphony-bot` and `1000-cadence-bot`. This readback may also be obtained
   with `gh api repos/jeremycarroll/venn-search-rs/collaborators --paginate --jq '.[].login'`
   using your local admin session. If either bot is present, report it for a
   coordinated removal; never invite a bot to make preflight work.
4. Open controller [Settings → Environments](https://github.com/1000lines/symphony-example/settings/environments).
   Inspect/reuse `cadence-controller` or create it if absent. Set **Deployment
   branches and tags → Selected branches and tags**, with exactly one **branch**
   rule named `main`, no wildcard or tag rule. Preserve unrelated protection
   settings. Verify main remains protected; DEPLOY owns any branch-rule changes.
   This corresponds to `custom_branch_policies: true`, `protected_branches: false`
   plus `{name: "main", type: "branch"}`. The Environment's flag selects the
   matching mode; main's repository protection is checked separately.
   See [Environment policy API](https://docs.github.com/en/rest/deployments/environments#create-or-update-an-environment)
   and [branch policy API](https://docs.github.com/en/rest/deployments/branch-policies#create-a-deployment-branch-policy).
5. After that restriction is confirmed, populate the Environment secrets below
   from your secure local files. Reuse the current Symphony OpenAI key for the
   initial provider copy and the existing Cadence Linear credential. GitHub
   cannot export an existing secret value; use its original authorized source.
   Keep legacy review secrets until RETIRE and do not change `symphony/keys`.

```bash
set +x +v
gh secret set CADENCE_APP_PRIVATE_KEY --repo 1000lines/symphony-example --env cadence-controller < /secure/1000lines-cadence.pem
gh secret set CADENCE_OPENAI_API_KEY --repo 1000lines/symphony-example --env cadence-controller < /secure/current-openai-key
gh secret set CADENCE_LINEAR_API_TOKEN --repo 1000lines/symphony-example --env cadence-controller < /secure/cadence-linear-token
gh variable set CADENCE_APP_ID --body 4866513 --repo 1000lines/symphony-example --env cadence-controller
```

Set `CADENCE_CONTROLLER_INSTALLATION_ID` with the same `gh variable set` command
and the actual Cadence controller ID from step 2. Do not use Symphony's ID.
Read back nonsecret metadata:

```bash
gh api repos/1000lines/symphony-example/environments/cadence-controller --jq '{name,protection_rules,deployment_branch_policy}'
gh api repos/1000lines/symphony-example/environments/cadence-controller/deployment-branch-policies --paginate --jq '.branch_policies[] | {id,name,type}'
gh api repos/1000lines/symphony-example/branches/main --jq '{name,protected}'
gh secret list --repo 1000lines/symphony-example --env cadence-controller --json name,updatedAt
gh variable list --repo 1000lines/symphony-example --env cadence-controller --json name,value --jq '.[] | select(.name == "CADENCE_APP_ID" or .name == "CADENCE_CONTROLLER_INSTALLATION_ID")'
aws iam get-role-policy --profile 1000lines --role-name symphony-instance --policy-name runtime-access --query PolicyDocument --output json --no-cli-pager
```

For AWS, first verify `aws sts get-caller-identity --profile 1000lines --region
us-west-2` selects account `350353785278`. Inspect attached/other inline policies
if present to confirm the host has no broader Secrets Manager access.

6. After approvals, use this nonsecret controller target with the existing
   Symphony PEM in the accepted [population recipe](../../../infra/static/README.md#populate-symphony).
   The recipe checks the account and pipes the key privately to the same AWS
   destination; return only ARN/version/stage metadata. No Terraform apply or
   host materializer/restart is needed for this correction.

```json
{
  "appId": 4866508,
  "appSlug": "1000lines-symphony",
  "installationId": 160626742,
  "repositoryId": 1362180215,
  "repository": "1000lines/symphony-example",
  "permissions": {
    "actions": "write",
    "checks": "read",
    "contents": "write",
    "issues": "write",
    "metadata": "read",
    "pull_requests": "write",
    "statuses": "read",
    "workflows": "write"
  }
}
```

## Preflight and resume

The declared CLI validates one private target configuration at a time; changing
`--repository` does not select a different installation. For each of four rows,
prepare a private JSON file with the camelCase fields above, that row's observed
App/installation/repository binding, the matching local PEM as `privateKey`, and
that App's matrix permissions. Cadence omits `workflows`, uses Checks write and
Contents read. Its signing files stay on the operator machine, never the host.
Use a directory mode 0700, file mode 0600, and a separate private token cache.
No unobserved ID or key placeholder is a valid configuration.

From the accepted checkout, with tracing disabled and existing GH tokens unset
in this temporary shell, set `SYMPHONY_GITHUB_APP_CONFIG` to the prepared row and
`SYMPHONY_GITHUB_APP_CACHE` to its private cache. Execute the matching command,
once for Symphony and once for Cadence on each repository:

```bash
node scripts/symphony/github-app-auth.mjs --preflight --repository 1000lines/symphony-example
node scripts/symphony/github-app-auth.mjs --preflight --repository jeremycarroll/venn-search-rs
```

After each successful preflight, revoke that cached token without printing it:

```bash
node --input-type=module <<'NODE'
import {loadAppConfig, getInstallationToken, revokeInstallationToken} from './scripts/symphony/github-app-auth.mjs';
try {
  const options = {config: await loadAppConfig(), cacheDir: process.env.SYMPHONY_GITHUB_APP_CACHE};
  await revokeInstallationToken(options, await getInstallationToken(options));
  console.log('Preflight token revoked');
} catch { console.error('Token cleanup failed; retain the private cache for operator recovery'); process.exitCode = 1; }
NODE
```

Return only preflight metadata/exit result, token revocation result, installation
selection, visibility, secret names/version metadata and protection readbacks.
Remove temporary private configuration/cache copies after successful cleanup.
Then return 100-16 to Active for independent readback. Missing access keeps this
ticket Inactive; independent code tickets continue. No human key is requested
in a PR or Linear comment.

## Validation record and handoff

For live rows below, target consumer is `main@23bbf8e88e04bdb3ae82b44b0dafa2c56e3ef465`.
This document is the durable redacted observation; task-head formatting and CI
links/results are recorded in the PR's Tested section and pinned Codex workpad.

| Command / environment                                                                                                  | Criterion                                | Actual result                                                                                                                           | Limitation / next handoff                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| App-authenticated `/app`, `/app/installations`, controller `/installation`, metadata-only `/installation/repositories` | R03/D02/O01 identity/selection           | Pass for Symphony controller; target absent. Inventory token expiry `2026-09-10T19:27:07Z`, then DELETE `/installation/token` HTTP 204. | Cadence/target/public setting: Jeremy steps 1–2.                                                                             |
| Controller declared preflight with privately fetched stored AWS payload                                                | R04 existing credential                  | Exit 0; exact repository scope, old grants, expiry `2026-09-10T19:27:08Z`; token revoked.                                               | Existing grants only; does not pass accepted matrix.                                                                         |
| Controller preflight with matrix grants added only in temporary configuration                                          | R04 grant denial                         | Exit 1: `installation denied actions:write; owner approval required`.                                                                   | Expected fail-closed result, readiness blocked; steps 1–2 and 6.                                                             |
| Target declared preflight with stored controller configuration                                                         | R04 target binding                       | Exit 1: `preflight requires --repository to match the configured target`.                                                               | No target config exists; this is configuration rejection, not target installation success. Steps 1–2 and four-row preflight. |
| AWS STS, DescribeSecret/GetSecretValue, merged `validateAppConfig`                                                     | R04 secret destination                   | Account, version, payload compatibility and usable Symphony key verified above; no values published.                                    | Deployed IAM scope read denied; Jeremy policy readback.                                                                      |
| Environment/variable/secret-name reads; target collaborator read                                                       | R03/R04 secret isolation and bot absence | Blocked: HTTP 404 / HTTP 403 as recorded above.                                                                                         | Jeremy steps 3–5. Branch-secret denial smoke belongs to DEPLOY.                                                              |

Run `npx prettier --check docs/symphony-plans/hackathon-ready/installation-evidence.md`
and `git diff --check` before publication. Docker is unnecessary when these
checks run locally; it cannot supply missing GitHub administrative authority.
Every published checkpoint requires its own `.github/workflows/ci.yml` run,
all four children and `CI Required`; older APP/infra CI is not this task's CI.

INSTALL remains incomplete until all four bindings/grants, public settings,
selected repositories, protected destinations and bot-absence readbacks close.
DEPLOY then consumes verified IDs without changing this inventory into an
enabled mapping implicitly. Real expiry renewal, revoked/suspended/unselected
and denied-grant cases, write-retry readback, branch-secret denial and App-authored
push/CI/review/handoff remain DEPLOY rehearsal obligations. They were not run
here, and temporary token revocation is not installation-revocation proof.
