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
