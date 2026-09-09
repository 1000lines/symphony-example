#!/usr/bin/env bash
# Terraform passes this script as EC2 user data; cloud-init executes it on first boot.
#
# Keep this file as small and as stable as possible: it is the only file under
# user_data_replace_on_change, so editing it replaces the running instance.
# Anything that can live in bootstrap.sh instead belongs there.
set -euo pipefail

log_dir="/var/log/symphony-bootstrap"
bootstrap_dir="/opt/symphony/bootstrap"
github_api_url="https://api.github.com"
bootstrap_repo="1000lines/symphony-example"
bootstrap_max_attempts=3
bootstrap_retry_backoff_seconds=10

# Side effects live here rather than at file scope so this file can be sourced
# by tests.
start_logging() {
  mkdir -p "$log_dir" "$bootstrap_dir"
  # tee only: piping to logger would detach this script's output from the
  # descriptors cloud-init captures, and cloud-init's record is the only place
  # a first-boot failure is visible.
  exec > >(tee -a "$log_dir/user-data.log") 2>&1
}

log() {
  printf 'symphony-user-data: %s\n' "$*"
}

die() {
  printf 'symphony-user-data: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required"
}

install_base_tools() {
  dnf install -y awscli jq tar gzip ca-certificates
}

imds_get() {
  local path="$1"
  local token

  token="$(
    curl -fsS -X PUT \
      -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" \
      "http://169.254.169.254/latest/api/token"
  )" || die "failed to acquire IMDSv2 token"

  curl -fsS \
    -H "X-aws-ec2-metadata-token: $token" \
    "http://169.254.169.254/${path#/}"
}

metadata_tag() {
  imds_get "latest/meta-data/tags/instance/$1"
}

metadata_region() {
  imds_get "latest/dynamic/instance-identity/document" | jq -er '.region'
}

aws_secret_string() {
  local secret_id="$1"
  local region="$2"

  aws secretsmanager get-secret-value \
    --secret-id "$secret_id" \
    --region "$region" \
    --query SecretString \
    --output text
}

github_token_from_secret() {
  local region="$1"
  local secret_id="symphony/keys"
  local secret

  secret="$(aws_secret_string "$secret_id" "$region")" ||
    die "failed to read required secret: $secret_id"
  printf '%s' "$secret" | jq -er '.GITHUB_TOKEN // empty' ||
    die "$secret_id is missing GITHUB_TOKEN"
}

urlencode() {
  jq -nr --arg value "$1" '$value | @uri'
}

resolve_github_ref() {
  local repo="$1"
  local ref="$2"
  local token="$3"
  local encoded_ref
  local sha

  [[ -n "$ref" ]] || die "missing GitHub ref"
  encoded_ref="$(urlencode "$ref")"
  sha="$(
    curl -fsSL \
      -H "Authorization: Bearer $token" \
      -H "Accept: application/vnd.github+json" \
      "$github_api_url/repos/$repo/commits/$encoded_ref" |
      jq -er '.sha'
  )" || die "failed to resolve $repo ref $ref"

  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "$repo ref $ref resolved to invalid SHA: $sha"
  printf '%s\n' "$sha"
}

download_bootstrap() {
  local sha="$1"
  local token="$2"
  local output="$bootstrap_dir/bootstrap.sh"
  local tmp="$output.tmp"

  curl -fsSL \
    -H "Authorization: Bearer $token" \
    -H "Accept: application/vnd.github.raw" \
    -o "$tmp" \
    "$github_api_url/repos/$bootstrap_repo/contents/scripts/symphony/host/bootstrap.sh?ref=$sha"
  install -m 0700 "$tmp" "$output"
  rm -f "$tmp"
}

run_bootstrap_with_retries() {
  local region="$1"
  local bootstrap_ref="$2"
  local bootstrap_sha="$3"
  local runtime_ref="$4"
  local github_token="$5"
  local attempt=1
  local status=0

  while ((attempt <= bootstrap_max_attempts)); do
    log \
      "starting root bootstrap attempt $attempt/$bootstrap_max_attempts from $bootstrap_repo@$bootstrap_sha"
    if SYMPHONY_AWS_REGION="$region" \
      SYMPHONY_BOOTSTRAP_REF="$bootstrap_ref" \
      SYMPHONY_BOOTSTRAP_SHA="$bootstrap_sha" \
      SYMPHONY_RUNTIME_REF="$runtime_ref" \
      SYMPHONY_GITHUB_TOKEN="$github_token" \
      "$bootstrap_dir/bootstrap.sh"; then
      log "root bootstrap attempt $attempt/$bootstrap_max_attempts completed"
      return 0
    else
      status=$?
    fi

    log "root bootstrap attempt $attempt/$bootstrap_max_attempts failed with exit status $status"
    if ((attempt == bootstrap_max_attempts)); then
      log "root bootstrap exhausted $bootstrap_max_attempts attempts; preserving exit status $status"
      return "$status"
    fi

    log "sleeping ${bootstrap_retry_backoff_seconds}s before retrying root bootstrap"
    sleep "$bootstrap_retry_backoff_seconds"
    attempt=$((attempt + 1))
  done
}

main() {
  local region
  local bootstrap_ref
  local runtime_ref
  local github_token
  local bootstrap_sha

  start_logging
  install_base_tools
  require_command aws
  require_command curl
  require_command jq

  region="$(metadata_region)"
  bootstrap_ref="$(metadata_tag "symphony:bootstrap-ref" || true)"
  runtime_ref="$(metadata_tag "symphony:runtime-ref" || true)"
  [[ -n "$bootstrap_ref" ]] || die "missing symphony:bootstrap-ref"
  [[ -n "$runtime_ref" ]] || die "missing symphony:runtime-ref"

  github_token="$(github_token_from_secret "$region")"
  bootstrap_sha="$(resolve_github_ref "$bootstrap_repo" "$bootstrap_ref" "$github_token")"
  download_bootstrap "$bootstrap_sha" "$github_token"

  run_bootstrap_with_retries \
    "$region" \
    "$bootstrap_ref" \
    "$bootstrap_sha" \
    "$runtime_ref" \
    "$github_token"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
