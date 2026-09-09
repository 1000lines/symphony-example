# 1000lines Symphony migration log

We are manually adapting the extracted example on `main` for
`https://symphony.1000lines.dev`. This log records top-level decisions and actual
deployment progress. Configuration changes are not proof of a working deployment.

## Decisions — 2026-09-09

| Change | Decision | Status |
| --- | --- | --- |
| No dashboard authentication | Remove Google OIDC; anyone can view the dashboard and its operational data. No replacement sign-in service. | Terraform updated; not deployed. |
| No public refresh | Public ingress accepts GET/HEAD only. `POST /api/v1/refresh` stays inaccessible through the public load balancer; automatic polling continues. The runtime endpoint itself is unchanged. | Terraform updated; not deployed. |
| Route 53 instead of GoDaddy | Use the existing `1000lines.dev` public hosted zone and an alias record to the load balancer. Remove the GoDaddy provider. | Terraform updated; not deployed. |
| Dedicated VPC | Add the missing VPC, two public ALB subnets, a private host subnet, and outbound NAT. Reuse the extracted host, disk, IAM and ALB module. | Deployed; host still pending. |
| Personal AWS account | Deploy to account `350353785278`, region `us-west-2`, using operator `arn:aws:iam::350353785278:user/jeremy`. The host uses its own instance role. | CLI identity verified. |
| Work directly on main | Manually migrate this repository on `main`. Keep the original README content below the current status note and point readers to Orchestra-Bio's Symphony fork. | Local changes; not pushed. |

| Runtime credentials | Use AWS Secrets Manager `symphony/keys`, a JSON object of environment-variable names and values. Reuse the local Orchestra OpenAI API key temporarily; replace it with the event key before Saturday, 2026-09-12. | Secret populated and verified with GitHub, 1000lines Linear and the temporary OpenAI key. |

| Markdown plans | Keep plans and designs in repository Markdown. No Google service account or Google Docs integration for this deployment. | Host and workflow updated. |
| Choose the simplest working path | Get the planned tickets running. Defer all optional features, integrations and automation until after the hackathon. | Applies throughout setup. |

| Numeric Linear team | Accept the existing `100-…` ticket identifiers in branch, DAG and PR-label helpers. | Updated locally. |

## Deployment progress

- Checked out `1000lines/symphony-example` and `1000lines/symphony`.
- Verified GitHub operator `jeremycarroll` and personal AWS CLI profile `1000lines`.
- Verified the existing Route 53 hosted zone for `1000lines.dev`.
- Confirmed GitHub Actions are disabled during migration.
- Populated and read back `symphony/keys`; key values are outside Terraform state.
- Configured Linear states Active, Inactive and Blocked; Backlog stays outside the execution queue.
- Created the private Terraform state bucket and DynamoDB lock table.
- Applied the network foundation, ACM certificate and DNS validation (18 resources).
- The EC2 host, public load balancer and dashboard DNS alias are still pending.

## Before Saturday

- [x] Populate the host's GitHub, 1000lines Linear, and initial OpenAI credentials.
- Replace the temporary Orchestra OpenAI API key with the event key and reload the host credentials before Saturday. Never put key values in this repository or log.
- Provision and verify the host, HTTPS, public dashboard, and blocked public refresh.
- Rehearse ticket execution and dependency progression in a separate test project.
- Leave the hackathon DAG frontier in Backlog until the start; downstream work
  remains dependency-gated.

## Validation

- Terraform configuration validates.
- Tooling builds successfully; locked dependencies install with `npm ci`.
- Credential installation passes without any Google secret or credentials file.
- The full host test suite initially had seven failures on this Mac, including
  missing Linux `flock` and a Codex-version expectation. Host verification is
  still required; these results are not a claim that the full suite passes.
