# Symphony Host Operations

Use this runbook to recover the singleton Symphony Host in the static
non-production AWS account. Cold restore is the recovery path that matters for
the first delivery. Warm EBS reattachment is only a convenience path.

The recovery boundary is GitHub, Linear, Terraform state/configuration, and
required AWS Secrets Manager values. A successful cold restore does not depend
on the old EC2 instance, root volume, workspace EBS volume, daemon memory,
workspace directories, sessions, caches, artifacts, active Codex turns, or
unpushed work.

## Operator Gates

Example Lead is the gate executor for any destructive cold-restore drill step.
Do not run destructive commands until Example has approved the exact target:

- AWS account and region.
- Terraform backend, state key, checkout ref, and local plan file.
- Existing Symphony Host EC2 instance ID and workspace EBS volume ID, if they
  still exist.
- ALB, target group, and GoDaddy DNS record that will be changed or observed.
- Rollback plan and stop condition.
- Whether the old workspace EBS volume is ignored, detached for warm recovery,
  or explicitly deleted.

Without that approval, only run read-only discovery and validation commands.
The following operations require the gate:

- `terraform apply`, `terraform destroy`, or any saved Terraform plan that
  creates, replaces, detaches, deletes, or mutates resources.
- AWS EC2 start/stop/reboot/terminate, EBS detach/delete, tag mutation, security
  group mutation, and SSM `send-command`.
- GoDaddy DNS writes.
- Management CLI commands with `--yes` that mutate the host or its tags.

## Recovery Action Boundaries

Use the narrowest approved recovery action:

- `reconcile --yes` reruns host reconciliation. It restarts
  `symphony-reconcile.service`, which is a persistent one-shot unit, so a plain
  `systemctl start` can be accepted without rerunning `ExecStart`. The CLI waits
  for the SSM command invocation to finish and prints reconciliation
  provenance, runtime bundle freshness, and Symphony service and HTTP readiness
  evidence before reporting completion. Use this when bootstrap or
  reconciliation failed after the unit exists, when refs changed, or after an
  approved warm volume attach.
- `restart-service --yes` restarts only `symphony.service`. It does not rerun
  bootstrap, reinstall the runtime, mount or reconcile the workspace volume, or
  rewrite provenance. Use it only when the installed runtime is already known
  good and the application process itself needs a restart.
- Host replacement is the Terraform cold-restore path below. It replaces the
  disposable EC2 instance, and sometimes the workspace volume, when the host or
  storage is untrusted. It is not the same operation as rerunning reconciliation
  or restarting the application service.

Do not recover a failed initial reconciliation with an ad hoc SSM shell command
when the management CLI can discover the current target and rerun the
reconciliation unit.

## Preconditions

- The operator is in a clean checkout of `example-org/example-repo` at the approved
  restore ref.
- The approved base branch is `main` unless a later handoff records a different
  ref.
- Terraform static state is available at the configured backend:
  `s3://example-symphony-tfstate/symphony/terraform.tfstate` in
  `us-west-2`.
- AWS credentials target account `000000000000` and region `us-west-2`.
- The static Terraform directory is `infra/static`.
- Required providers are available: AWS and `veksh/godaddy-dns`.
- Required Secrets Manager values exist and have valid shapes:
  - `symphony/keys`: JSON containing runtime GitHub, Linear, OpenAI, and
    related Symphony keys.
  - `symphony-google-service-account-json`: Google service-account JSON.
  - `symphony/oidc-credentials`: Google OIDC web client JSON for ALB auth.
- GitHub and Linear are reachable from the operator workstation and from the
  replacement host after bootstrap.
- No old workspace, session, cache, artifact, or unpushed commit is treated as
  required input.

## Read-Only Discovery

Run discovery first and paste the non-secret output into the Linear handoff or
incident record.

```bash
aws sts get-caller-identity \
  --region us-west-2 \
  --query Account \
  --output text
```

Compare the output with the 12-digit AWS account ID you selected for this host
and configured as the `AWS_ACCOUNT_ID` repository variable for the AMI workflow.
Stop if it differs or that expected account has not been supplied.
`000000000000` in examples is synthetic and must not be used as an operational
allowlist value.

```bash
terraform -chdir=infra/static init -input=false
terraform -chdir=infra/static state list
terraform -chdir=infra/static validate
```

Expected output:

- `init` initializes the S3 backend and providers.
- `state list` includes the `module.symphony_host` resources when the host has
  been created before.
- `validate` reports `Success! The configuration is valid.`

```bash
aws ec2 describe-instances \
  --region us-west-2 \
  --filters "Name=tag:Name,Values=symphony" \
    "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query 'Reservations[].Instances[].{InstanceId:InstanceId,State:State.Name,PrivateIp:PrivateIpAddress,PublicIp:PublicIpAddress,Metadata:MetadataOptions,SubnetId:SubnetId,SecurityGroups:SecurityGroups[].GroupId,Tags:Tags}' \
  --output json
```

Expected output: zero or one Symphony instance. A healthy target has no public
IP address and has IMDSv2 required with hop limit `1`.

```bash
aws ec2 describe-volumes \
  --region us-west-2 \
  --filters "Name=tag:Name,Values=symphony" \
  --query 'Volumes[].{VolumeId:VolumeId,State:State,Encrypted:Encrypted,Size:Size,Attachments:Attachments}' \
  --output json
```

Expected output: zero or one Terraform-managed workspace volume for the cold
path. The restored volume must be encrypted. Existing old volumes are not
required for cold restore.

```bash
aws secretsmanager describe-secret --region us-west-2 --secret-id symphony/keys
aws secretsmanager describe-secret --region us-west-2 --secret-id symphony-google-service-account-json
aws secretsmanager describe-secret --region us-west-2 --secret-id symphony/oidc-credentials
```

Expected output: each command returns metadata for an active secret. Do not print
`SecretString` values into terminals that will be copied to Linear, GitHub, or
logs.

```bash
LINEAR_API_TOKEN=<read-only-token> \
  node scripts/fetch-linear-issue.mjs DEMO-426 > /tmp/DEMO-426.linear.md
```

Expected output: `/tmp/DEMO-426.linear.md` contains the issue title, state,
description, project metadata, and comments. Repeat for any active incident,
handoff, or project issues needed to resume work. This is read-only.

```bash
git fetch origin main
git rev-parse origin/main
git status --short --branch
```

Expected output: `origin/main` resolves to the approved restore SHA and the
worktree is clean except for intentional incident notes.

## Deliberate AMI Roll

The Symphony host AMI is pinned in
`infra/static/modules/symphony-host/instance.tf`, and updates are managed by the
weekly/manual `.github/workflows/update-symphony-host-ami.yml` workflow, which
opens a draft PR when AWS publishes a newer AL2023 x86_64 AMI instead of letting
unrelated `infra/static/**` applies replace the host.
Review that PR's static Terraform plan, schedule downtime for the singleton
host, and after merge record the new instance ID, workflow run URL, and elapsed
time from `RunInstances` to ALB `healthy`; keep
`user_data_replace_on_change = true` so deliberate user-data edits still replace
the disposable host.

## Cold Restore

Cold restore ignores the old host and workspace durability. It reconstructs the
host from Terraform state/configuration, Secrets Manager, GitHub, and Linear.

### 1. Confirm Target And Approval

Record the target identifiers before mutation:

```bash
aws sts get-caller-identity --region us-west-2 --output json
terraform -chdir=infra/static state show module.symphony_host.aws_instance.symphony
terraform -chdir=infra/static state show module.symphony_host.aws_ebs_volume.workspace
```

Expected output: the account is `000000000000`; Terraform state shows the
current singleton instance and workspace volume when they exist.

Approval gate: Example Lead must approve the target account, state, existing
instance ID, existing workspace volume ID, and the decision to proceed without
old workspace data.

Rollback before apply: stop. No cloud resources have changed.

### 2. Plan A Fresh Host And Empty Workspace Volume

Use a saved plan and force replacement of both the disposable host and the
workspace volume when the intent is a cold restore drill:

```bash
terraform -chdir=infra/static plan \
  -replace=module.symphony_host.aws_instance.symphony \
  -replace=module.symphony_host.aws_ebs_volume.workspace \
  -parallelism=1 \
  -refresh=false \
  -no-color \
  -out=/tmp/symphony-host-cold-restore.tfplan
```

Expected output:

- Terraform proposes replacing `module.symphony_host.aws_instance.symphony`.
- Terraform proposes replacing `module.symphony_host.aws_ebs_volume.workspace`.
- The workspace volume replacement is encrypted `gp3`.
- The instance remains private, has no public IP, and keeps IMDSv2 required.
- GoDaddy changes are limited to the `symphony.example.invalid` CNAME when the
  ALB DNS name changes.

Stop if the plan includes unrelated resources, broad IAM changes, public SSH,
public EC2 IPs, unexpected secrets, or destructive changes outside the
singleton Symphony Host resources.

Rollback before apply: discard `/tmp/symphony-host-cold-restore.tfplan`.

### 3. Apply The Approved Plan

Approval gate: Example Lead must approve the saved plan output immediately
before apply.

```bash
terraform -chdir=infra/static apply /tmp/symphony-host-cold-restore.tfplan
```

Expected output: `Apply complete!` and no provider, GoDaddy, or AWS credential
errors.

Rollback after a failed apply:

- Run `terraform -chdir=infra/static state list` and inspect partial resources.
- Prefer fixing the exact blocker and applying the same reviewed intent.
- Do not run `terraform destroy` as rollback unless Example approves the
  destroy target and the recovery plan.

Rollback after a bad restored ref:

```bash
npm run build -w @example/symphony-host
node tools/symphony-host/dist/cli.js rollback <known-good-sha-or-ref> \
  --region us-west-2 \
  --name symphony \
  --yes
```

Expected output: the CLI prints `Target:`, `Previous runtime ref:`, an SSM
command ID/status for reconciliation, and `Completed: rollback runtime ref to
<known-good-sha-or-ref>`.

### 4. Validate The Cloud Scaffold

```bash
aws ec2 describe-instances \
  --region us-west-2 \
  --filters "Name=tag:Name,Values=symphony" \
    "Name=instance-state-name,Values=running" \
  --query 'Reservations[].Instances[].{InstanceId:InstanceId,PublicIp:PublicIpAddress,Metadata:MetadataOptions,SubnetId:SubnetId,Tags:Tags}' \
  --output json
```

Expected output: one running instance, no public IP, and metadata options
include `HttpTokens: required` and `HttpPutResponseHopLimit: 1`.

```bash
aws ec2 describe-security-groups \
  --region us-west-2 \
  --filters "Name=tag:Name,Values=symphony" \
  --query 'SecurityGroups[].{GroupId:GroupId,GroupName:GroupName,Ingress:IpPermissions,Egress:IpPermissionsEgress}' \
  --output json
```

Expected output: the ALB security group admits HTTPS from the internet; the
instance security group admits only the Symphony service port from the ALB
security group. There is no inbound SSH rule.

```bash
aws elbv2 describe-load-balancers \
  --region us-west-2 \
  --names symphony \
  --query 'LoadBalancers[].{Arn:LoadBalancerArn,DNSName:DNSName,State:State.Code,Scheme:Scheme}' \
  --output json
```

Expected output: one internet-facing ALB with state `active`.

```bash
aws elbv2 describe-target-health \
  --region us-west-2 \
  --target-group-arn <target-group-arn> \
  --output json
```

Expected output: the restored instance target becomes `healthy`. During
bootstrap it may be `initial` or `unhealthy`; use logs before retrying apply.

### 5. Direct AWS Break-Glass Operations

Terraform and the management CLI are the normal mutation paths. Direct AWS
mutations are break-glass only and require Example approval for the exact
instance or volume ID.

Approved stop/start shapes:

```bash
aws ec2 stop-instances --region us-west-2 --instance-ids <instance-id>
aws ec2 start-instances --region us-west-2 --instance-ids <instance-id>
```

Expected output: AWS returns the requested instance ID and a state transition
such as `running` to `stopping` or `stopped` to `pending`.

Approved emergency detach/attach shapes are listed in
[Warm EBS Reattachment](#warm-ebs-reattachment). Do not run
`terminate-instances`, `delete-volume`, or security group mutation commands
unless the approval explicitly names those resource IDs and explains why
Terraform cannot own the change.

Rollback:

- For a stopped instance, run the approved start shape.
- For an attached/detached volume, return it to the approved attachment target
  or abandon warm recovery and run cold restore.
- For any accidental drift, record the manual command and reconcile Terraform
  state/configuration before the next apply.

### 6. Validate GoDaddy DNS

Read the current CNAME through GoDaddy. Do not print or paste API credentials.

```bash
curl -fsS \
  -H "Authorization: sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}" \
  "https://api.godaddy.com/v1/domains/example.invalid/records/CNAME/symphony"
```

Expected output: JSON for the `symphony` CNAME with `data` equal to the restored
ALB DNS name and `ttl` `600`.

Approved write path: Terraform only. Do not manually edit the GoDaddy record
unless Example approves a break-glass DNS rollback.

Rollback: reapply the last known-good Terraform plan or, for an approved
break-glass DNS rollback only, restore the prior CNAME value and immediately
record the drift that Terraform must reconcile.

### 7. Validate SSM And Host Bootstrap

```bash
aws ssm get-connection-status \
  --region us-west-2 \
  --target <instance-id>
```

Expected output: `Status` becomes `connected`.

Read logs with the management CLI:

```bash
npm run build -w @example/symphony-host
node tools/symphony-host/dist/cli.js logs \
  --region us-west-2 \
  --name symphony \
  --lines 120
```

Expected output: `Target:` followed by `Logs:` entries for cloud-init,
reconcile, and service sources. Secrets are redacted by the CLI.

If bootstrap or reconciliation failed and Example approves host mutation, rerun
reconciliation:

```bash
node tools/symphony-host/dist/cli.js reconcile \
  --region us-west-2 \
  --name symphony \
  --yes
```

Expected output: `Target:`, an SSM command ID, final `SSM status: Success`,
reconciliation provenance from `/var/lib/symphony-bootstrap/provenance.json`,
`Runtime bundle freshness: installed bundle matches current source`, Symphony
service readiness, `Symphony HTTP readiness: ok`, recent
`symphony-reconcile.service` journal output, and
`Completed: run Symphony reconciliation`. The command waits for the submitted
SSM invocation before returning; do not launch another reconcile attempt until
this output is complete or the command has failed.

Rollback: use `rollback <sha/ref> --yes` for a bad runtime ref, or stop the host
with `node tools/symphony-host/dist/cli.js stop ... --yes` if the restored host
is unsafe to run.

### 8. Validate Management Status

```bash
node tools/symphony-host/dist/cli.js status \
  --region us-west-2 \
  --name symphony
```

Expected output includes:

- `Target:` with account `000000000000`, region `us-west-2`, one instance, one
  ALB, and one workspace volume.
- `Status:` with instance/system health, SSM status, target health,
  `bootstrap ref`, `runtime ref`, `worker slots`, and latest provenance.

```bash
node tools/symphony-host/dist/cli.js workstreams \
  --region us-west-2 \
  --name symphony
```

Expected output: `Workstreams:` with
`submitted read-only workspace inspection on the Symphony host` and an SSM
command ID. Use the command output or follow-up SSM logs to confirm that a true
cold restore has zero active historical workspaces, or only workspaces created
after restore. The absence of old workspace content is acceptable.

### 9. Validate ALB/OIDC Access

```bash
curl -I https://symphony.example.invalid
```

Expected output for an unauthenticated request: an OIDC redirect or
authentication response from the ALB, not direct unauthenticated Symphony
content. A signed-in `example.invalid` user should reach the Symphony UI after
Google OIDC.

Rollback: if ALB auth is open or misroutes traffic, stop the host and revert the
Terraform change before any further use.

### 10. Validate GitHub And Linear Reconstruction

Cold restore passes only if accepted work can be reconstructed from GitHub and
Linear.

On the restored host, use an SSM shell only after approval:

```bash
node tools/symphony-host/dist/cli.js ssm-shell \
  --region us-west-2 \
  --name symphony \
  --yes
```

Then run read-only checks inside the host session:

```bash
sudo -iu symphony bash -lc 'git -C /opt/symphony/src/example-repo rev-parse HEAD'
sudo -iu symphony bash -lc 'git -C /opt/symphony/src/symphony rev-parse HEAD'
sudo -iu symphony bash -lc 'test -d /var/lib/symphony/workspaces && find /var/lib/symphony/workspaces -mindepth 1 -maxdepth 1 -type d | head'
```

Expected output:

- Source checkouts resolve to recorded SHAs.
- The workspace root exists.
- Historical workspace directories are absent on a strict cold restore, or only
  post-restore workspaces are present.

From the operator workstation, fetch the relevant Linear issues and GitHub PRs:

```bash
LINEAR_API_TOKEN=<read-only-token> node scripts/fetch-linear-issue.mjs DEMO-426
gh pr list --repo example-org/example-repo --state open --label orange
```

Expected output: Linear and GitHub contain the reviewable state needed to resume
work. Do not rely on host-local unpushed commits, active sessions, caches, or
workspace artifacts.

## Warm EBS Reattachment

Warm recovery can save time when the old workspace EBS volume is known-good. It
is not the SLA path and is not required for cold restore success.

Preconditions:

- Example approves the exact old and replacement instance IDs, old volume ID,
  filesystem identity, and rollback plan.
- The old volume is encrypted, attached to the prior Symphony host, and safe to
  reuse.
- Cold restore remains available if the warm path fails.

Approved shape:

```bash
node tools/symphony-host/dist/cli.js stop \
  --region us-west-2 \
  --name symphony \
  --yes
aws ec2 detach-volume --region us-west-2 --volume-id <old-workspace-volume-id>
aws ec2 attach-volume \
  --region us-west-2 \
  --volume-id <old-workspace-volume-id> \
  --instance-id <replacement-instance-id> \
  --device /dev/sdf
node tools/symphony-host/dist/cli.js reconcile \
  --region us-west-2 \
  --name symphony \
  --volume-id <old-workspace-volume-id> \
  --yes
```

Expected output:

- The old volume detaches cleanly and attaches to the replacement.
- Reconciliation mounts `/var/lib/symphony`.
- `status`, `logs`, `workstreams`, SSM, and ALB/OIDC validation pass.

Rollback:

- Stop the replacement host before detaching the warm volume.
- Reattach the volume to the previous instance only if that instance is still
  the approved rollback target.
- If the volume is missing, stale, corrupt, unsafe, or ambiguous, abandon warm
  recovery and run cold restore with an empty workspace volume.

## Known Out-Of-Scope Risk

The inherited `.github/workflows/apply-static.yml` workflow is a known
credential exposure and is not fixed by this runbook. It runs on
`pull_request` for `infra/static/**`, configures long-lived
`secrets.AWS_ACCESS_KEY_ID` and `secrets.AWS_SECRET_ACCESS_KEY`, reads GoDaddy
credentials from Secrets Manager, and has no GitHub `environment:` gate. A
same-repo branch PR can run the head version of the workflow with static AWS
account `000000000000` and GoDaddy credentials.

Separate tracker: no active Linear tracker dedicated to this exposure was found
during the `DEMO-426` pass. Create or link one before treating the risk as owned.

## Completion Evidence

Record the following in the Linear issue or incident handoff:

- Approved operator and timestamp for any destructive drill step, or a clear
  note that no destructive drill was run.
- Git ref and Terraform state target used.
- `terraform init`, `validate`, `plan`, and any `apply` result.
- AWS account, instance ID, ALB DNS name, target group health, workspace volume
  ID, and SSM connection status.
- GoDaddy CNAME validation result.
- Management CLI `status`, `logs`, and `workstreams` summaries.
- Linear and GitHub reconstruction checks.
- Explicit statement that the restore did not depend on old workspaces,
  sessions, caches, unpushed work, or workspace EBS durability.
