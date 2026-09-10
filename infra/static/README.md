# 1000lines deployment

The current deployment uses personal AWS account `350353785278` in `us-west-2`.
It provisions its own network and ACM certificate, reuses the existing Route 53
zone, and exposes a public HTTPS dashboard with GET/HEAD only.

Credentials are the JSON environment map in Secrets Manager `symphony/keys`:
`GITHUB_TOKEN`, `LINEAR_API_TOKEN`, and `OPENAI_API_KEY`. No Google credentials
are needed. Secret values are populated separately from Terraform.

Authenticate profile `1000lines` as IAM user `jeremy`. Terraform uses profile
`1000lines-terraform`, whose credential process is:
`aws configure export-credentials --profile 1000lines --format process`.

From the repository root:

```sh
terraform -chdir=infra/static init
terraform -chdir=infra/static plan -out=deploy.tfplan
terraform -chdir=infra/static apply deploy.tfplan
```

The host defaults to enabled. `bootstrap_ref` pins the verified installer commit; update it explicitly with
`-var=bootstrap_ref=<sha>` in the plan when deploying a new installer revision.
The runtime fork is pinned in `variables.tf`. The state backend was created by
`infra/state`; its local bootstrap state is ignored by Git.

## GitHub App keys: Jeremy's setup handoff

[INSTALL (100-16)](https://linear.app/1000lines/issue/100-16/prepare-and-verify-both-app-installations-and-secret-destinations)
owns live setup. Jeremy reviews and applies the Terraform plan, then uploads his
keys. Terraform manages the empty `symphony/github-apps/symphony`
container and host `DescribeSecret`/`GetSecretValue` access to that name and
`symphony/keys` only, in account `350353785278`, region `us-west-2`. Values stay
outside Terraform inputs, plans and state.

### Apply the container and host read grant

From the repository root, verify both callers are the intended Jeremy identity
in account `350353785278`; a profile name alone does not establish identity:

```bash
aws sts get-caller-identity --profile 1000lines --region us-west-2 --query '{Account:Account,Arn:Arn}' --output json --no-cli-pager
aws sts get-caller-identity --profile 1000lines-terraform --region us-west-2 --query '{Account:Account,Arn:Arn}' --output json --no-cli-pager
aws secretsmanager describe-secret --profile 1000lines --region us-west-2 --secret-id symphony/github-apps/symphony --query '{ARN:ARN,VersionIdsToStages:VersionIdsToStages}' --output json --no-cli-pager
terraform -chdir=infra/static init
```

If the container exists and is not already at
`aws_secretsmanager_secret.symphony_github_app` in this stack's state, import
its returned ARN before planning:

```bash
terraform -chdir=infra/static import aws_secretsmanager_secret.symphony_github_app '<ARN returned by describe-secret>'
```

Only `ResourceNotFoundException` establishes absence; access denial requires
INSTALL to resolve read access. Plan normally, review for only this container
and `module.symphony_host[0].aws_iam_role_policy.symphony_runtime`, then apply the
reviewed plan. Stop if it changes anything else, including host bootstrap refs.

```bash
terraform -chdir=infra/static plan -out=app-secret.tfplan
terraform -chdir=infra/static apply app-secret.tfplan
```

### Populate Symphony

Use a reviewed nonsecret target JSON file and the local Symphony App PEM at the
quoted `target` and `pem` paths below, both outside the checkout.

The single-target secret contract requires the camelCase fields below. The target
file contains every field except `privateKey`, which `jq --rawfile` adds from the
PEM without changing its newlines:

| Field            | Required value                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appId`          | Integer `4866508`                                                                                                                                                                      |
| `appSlug`        | `1000lines-symphony`                                                                                                                                                                   |
| `installationId` | Observed positive integer for this App and the selected repository owner; never reuse another owner's installation                                                                     |
| `repositoryId`   | Observed positive integer matching `repository`; controller ID `1362180215` read back on 2026-09-10                                                                                    |
| `repository`     | Matching `owner/name`, e.g. `1000lines/symphony-example`                                                                                                                               |
| `permissions`    | Exact nonempty operation permission object from the reviewed trusted target configuration and [accepted matrix](../../docs/symphony-plans/hackathon-ready-design.md#permission-matrix) |
| `privateKey`     | Local Symphony App RSA private key; added only during upload                                                                                                                           |

No merged consumer reads `symphony/github-apps/symphony` yet; provisioning and
population alone do not enable App authentication. INSTALL must verify the
owner/installation/repository binding and approve the exact operation grants
before upload. The validator caps grants at the matrix; it does not discover
installations or prove live grants.

Run this Bash block after apply, with Bash, jq 1.6 or newer, OpenSSL and AWS CLI available.
It disables shell tracing, checks the AWS account, validates the RSA PEM and
complete target before starting upload, and prints upload metadata only:

```bash
(
  set +x +v
  set -euo pipefail
  target='/secure/symphony-target.json'
  pem='/secure/1000lines-symphony.pem'
  aws sts get-caller-identity --profile 1000lines --region us-west-2 --output json --no-cli-pager |
    jq -e '.Account == "350353785278"' >/dev/null
  openssl rsa -in "$pem" -passin pass: -check -noout >/dev/null 2>&1 || { echo 'Invalid RSA PEM' >&2; exit 1; }
  unset app_payload
  app_payload=$(jq -cse --rawfile privateKey "$pem" '
    {actions:"write", checks:"read", contents:"write", issues:"write",
     metadata:"read", pull_requests:"write", statuses:"read", workflows:"write"} as $max
    | if length != 1 then error("one target required") else .[0] end
    | if type == "object" and
        keys == ["appId","appSlug","installationId","permissions","repository","repositoryId"] and
        .appId == 4866508 and .appSlug == "1000lines-symphony" and
        all(.installationId, .repositoryId; type == "number" and . > 0 and . <= 9007199254740991 and floor == .) and
        (.repository | type == "string" and test("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$") and
          (split("/") | all(. != "." and . != ".."))) and
        (.repository != "1000lines/symphony-example" or .repositoryId == 1362180215) and
        (.permissions | type == "object" and length > 0 and all(to_entries[];
          (.value == "read" and $max[.key] != null) or (.value == "write" and $max[.key] == "write")))
      then . + {privateKey:$privateKey} else error("invalid target") end
  ' "$target" 2>/dev/null) || { echo 'Invalid target JSON or PEM' >&2; exit 1; }
  printf '%s\n' "$app_payload" |
    aws secretsmanager put-secret-value --profile 1000lines --region us-west-2 --secret-id symphony/github-apps/symphony --secret-string file:///dev/stdin --query '{ARN:ARN,VersionId:VersionId,VersionStages:VersionStages}' --output json --no-cli-pager
)
```

Keep xtrace and AWS debug logging off. The payload stays in shell memory and
stdin; no key value enters command arguments, Terraform, or a generated file.
[AWS CLI reference](https://docs.aws.amazon.com/cli/latest/reference/secretsmanager/put-secret-value.html).
Read back only container/version metadata:

```bash
aws secretsmanager describe-secret --profile 1000lines --region us-west-2 --secret-id symphony/github-apps/symphony --query '{ARN:ARN,VersionIdsToStages:VersionIdsToStages}' --output json --no-cli-pager
```

### Populate Cadence and hand off

After INSTALL creates and protects `cadence-controller` for protected `main`,
upload the distinct Cadence App `4866513` PEM with
[`gh secret set`](https://cli.github.com/manual/gh_secret_set) and read back only
the secret name:

```bash
set +x +v
gh secret set CADENCE_APP_PRIVATE_KEY --repo 1000lines/symphony-example --env cadence-controller < /secure/1000lines-cadence.pem
gh secret list --repo 1000lines/symphony-example --env cadence-controller --json name --jq '.[] | select(.name == "CADENCE_APP_PRIVATE_KEY") | .name'
```

Cadence's key stays in that Environment; no second AWS copy or host access is
needed. Return only the Symphony ARN/version metadata and Cadence secret-name
presence to INSTALL, never a key in Linear or GitHub. INSTALL owns Environment
protection, App/installation variables, provider/Linear secrets and actual
installation/grant/token-preflight evidence. [DEPLOY (100-19)](https://linear.app/1000lines/issue/100-19/deploy-and-rehearse-apps-codex-ci-and-15-minute-recovery)
owns host reload and live activation. This setup leaves `symphony/keys`, App
registrations/installations, host processes and the selected reviewer unchanged.

See [MIGRATION.md](../../MIGRATION.md) for decisions and verified progress.
Original extraction notes are preserved below and describe the earlier setup.

---

# Symphony host infrastructure snapshot

This directory identifies the Terraform selected for export: the Symphony EC2
host, workspace disk, IAM role, HTTPS ALB with Google OIDC, GoDaddy DNS record
and OIDC secret declaration. The network and certificate infrastructure are
excluded and represented by four root inputs.

This is a redacted source snapshot. Actual export and making the exported code
operate in another repository are later work. The notes below explain the
remaining values and known gaps; they are not a tested deployment procedure.

## Root inputs

For later setup, put root values in an adopter-owned file outside the checkout,
such as `/secure/symphony.tfvars`, and select it with Terraform's `-var-file`
option. Repository Actions settings do not automatically set local Terraform
variables. All names below are declared in `variables.tf`.

| Input                | Purpose and shape                                                                   | Required/default                                      |
| -------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `vpc_id`             | Existing AWS VPC ID, string                                                         | Required; no default                                  |
| `private_subnet_ids` | List of private subnet IDs in that VPC; first subnet selects the host and disk zone | Required; at least one; no default                    |
| `public_subnet_ids`  | List of public ALB subnet IDs in that VPC, in at least two availability zones       | Required; no default                                  |
| `certificate_arn`    | ACM certificate ARN in the host region covering the hostname                        | Required; no default                                  |
| `domain_name`        | Root DNS domain, string                                                             | Required for use; synthetic default `example.invalid` |
| `deployment_stage`   | Legacy string still passed to the module; the retained module does not use it       | Required by the copied interface; no default          |
| `aws_region`         | AWS region name, string                                                             | Optional; `us-west-2`                                 |

Synthetic input-shape example (these resource IDs are not usable resources):

```hcl
vpc_id             = "vpc-0123456789abcdef0"
private_subnet_ids = ["subnet-0123456789abcdef0"]
public_subnet_ids = [
  "subnet-1123456789abcdef0",
  "subnet-2123456789abcdef0",
]
certificate_arn  = "arn:aws:acm:us-west-2:000000000000:certificate/00000000-0000-0000-0000-000000000000"
domain_name      = "example.com"
deployment_stage = "adopter"
```

## Backend and credentials

The copied S3 backend keeps a synthetic bucket and a dedicated state key. A
private backend file, selected with `-backend-config` during later initialization,
can override `bucket`, `key` and `region` without editing `backend.tf`:

```hcl
bucket = "adopter-state-bucket"
key    = "symphony/terraform.tfstate"
region = "us-west-2"
```

The bucket is required; the copied key and region are defaults. Backend settings
are separate from root variables. State storage and locking need review during
later setup; state can contain OIDC credentials and must remain private.

AWS and GoDaddy DNS provider declarations and the provider lock are retained.
They need adopter credentials through their existing authentication mechanisms.
`secrets.tf` declares the Google OIDC container; it does not populate secret
values. OIDC expects JSON containing `client_id` and `client_secret`.

## Known setup gaps and retained assumptions

- `modules/symphony-host/instance.tf` has an intentionally nonexistent image pin.
  Its replacement requires a suitable regional image. The copied instance type,
  disk sizes, worker count and bootstrap/runtime refs remain fixed source values.
- DNS and the Google hosted-domain hint are distinct settings. The latter remains
  a placeholder in `modules/symphony-host/main.tf`; it is not an access policy.
- The OIDC container is created and its current version read in the same root.
  An empty container has no version to read; later setup must resolve population
  and Terraform state/import ordering. This snapshot preserves that lifecycle.
- The bootstrap repository placeholder and secret locator in
  `modules/symphony-host/files/user-data.sh` must be reconciled with the installer
  and the allowlist in `modules/symphony-host/iam.tf` during later setup.
- Private-subnet outbound access, public ALB routing, certificate coverage, DNS
  credentials and external service access are assumptions, not verified resources.

The [setup reference](../../README.md) records the individual redacted values
and their locations. No new host outputs or bootstrap configuration layer are
introduced here.

Nothing in this extraction has been verified by execution; no extraction round
trip was performed.
