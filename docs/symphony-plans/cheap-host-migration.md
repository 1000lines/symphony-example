# Cheap host migration

## Goal

Replace the current disposable Symphony deployment with a lower fixed-cost
direct-host deployment. The target retains the `t3a.large` host, reduces the
disposable workspace disk from 400 GiB to 150 GiB, and removes the NAT Gateway
and Application Load Balancer.

## Target architecture

```text
Route 53 A record -> Elastic IP -> EC2 public subnet :443 -> Caddy -> 127.0.0.1:4000
```

Only TCP 443 is publicly allowed. Caddy obtains and renews a public certificate
using ACME TLS-ALPN-01 on port 443, then reverse-proxies only `GET` and `HEAD`
requests to Symphony. The runtime port 4000 has no security-group ingress.

The host can still reach GitHub, AWS APIs, and the certificate authority through
the Internet Gateway. Systems Manager remains the administrative path.

## Disposal decision

The current workspace volume (`vol-01846aacd42350d31`) is explicitly
disposable. Delete it with the old deployment; do not take a snapshot or migrate
its 46 GiB of used data. AWS does not support reducing an EBS volume in place,
so recreation is required for the 150 GiB target.

## Execution

1. Merge this branch only when ready to recreate. Its `bootstrap_ref` must name
   the commit that contains the Caddy installer, so first boot downloads this
   configuration.
2. From `infra/static`, run `terraform init`, then create and review a normal
   `terraform plan`. Confirm it destroys the old EC2 host, 400 GiB workspace
   volume, ALB, NAT Gateway, NAT EIP, ACM certificate, and old Route 53 alias;
   it must retain the Secrets Manager containers.
3. Apply that reviewed migration plan. The dashboard will be unavailable while
   the old host is replaced.
4. Confirm the plan creates one public subnet, the `t3a.large` host, a 150 GiB
   workspace volume, one host EIP, a Route 53 A record, and a security group
   with only public TCP 443. Wait for Caddy to obtain its certificate,
   then verify `https://symphony.1000lines.dev` loads and non-GET/HEAD requests
   receive HTTP 405.
5. Confirm the new EBS volume is 150 GiB and remove any residual resources from
   the old deployment that were not Terraform-managed.

## Rollback

Rollback is a fresh apply of the prior Terraform revision. It creates a new
private host, ALB, NAT Gateway, and 400 GiB disposable workspace volume; it
does not recover the destroyed workspace data.
