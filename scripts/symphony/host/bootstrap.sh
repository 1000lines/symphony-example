#!/usr/bin/env bash
# Stage 2 of host bootstrap: obtain the example-repo checkout and hand off to the
# install.d runner inside it.
#
# Downloaded as a single standalone file by user data, so it sources nothing and
# depends on nothing it did not bring with it. It does the minimum a clone
# needs — region, bot token, askpass, git — and nothing else. Tags, refs, worker
# slots, instance identity and provenance are all read by the steps that consume
# them, where they can be re-run in isolation.
#
# Keep this file boring: it is downloaded at a pinned SHA and is awkward to
# debug, so logic belongs in install.d/ where a step can be re-run on its own.
set -euo pipefail

github_base_url="${SYMPHONY_GITHUB_BASE_URL:-https://github.com}"
bootstrap_repo="${SYMPHONY_BOOTSTRAP_REPO:-1000lines/symphony-example}"
opt_root="${SYMPHONY_OPT_ROOT:-/opt/symphony}"
src_root="${SYMPHONY_SRC_ROOT:-$opt_root/src}"
config_dir="${SYMPHONY_CONFIG_DIR:-/etc/symphony}"
state_dir="${SYMPHONY_BOOTSTRAP_STATE_DIR:-/var/lib/symphony-bootstrap}"
log_dir="${SYMPHONY_BOOTSTRAP_LOG_DIR:-/var/log/symphony-bootstrap}"
bootstrap_source_checkout="$src_root/example-repo"
git_askpass_path="$config_dir/git-askpass.sh"

log() {
  printf 'symphony-bootstrap: %s\n' "$*"
}

die() {
  printf 'symphony-bootstrap: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required"
}

imds_get() {
  local path="$1"
  local base="${SYMPHONY_IMDS_BASE_URL:-http://169.254.169.254}"
  local token

  token="$(
    curl -fsS -X PUT \
      -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" \
      "$base/latest/api/token"
  )" || die "failed to acquire IMDSv2 token"

  curl -fsS -H "X-aws-ec2-metadata-token: $token" "$base/${path#/}"
}

# Needed only to address Secrets Manager for the bot token.
metadata_region() {
  if [[ -n "${SYMPHONY_AWS_REGION:-}" ]]; then
    printf '%s\n' "$SYMPHONY_AWS_REGION"
    return
  fi

  imds_get "latest/dynamic/instance-identity/document" | jq -er '.region'
}

github_token_from_secret() {
  local region="$1"
  local secret_id="${SYMPHONY_KEYS_SECRET_ID:-symphony/keys}"
  local secret

  if [[ -n "${SYMPHONY_SECRETS_DIR:-}" ]]; then
    secret="$(cat "$SYMPHONY_SECRETS_DIR/$secret_id")" ||
      die "missing required secret: $secret_id"
  else
    secret="$(
      aws secretsmanager get-secret-value \
        --secret-id "$secret_id" \
        --region "$region" \
        --query SecretString \
        --output text
    )" || die "failed to read required secret: $secret_id"
  fi

  printf '%s' "$secret" | jq -er '.GITHUB_TOKEN // empty' ||
    die "$secret_id is missing GITHUB_TOKEN"
}

install_git() {
  command -v git >/dev/null 2>&1 && return 0

  if command -v dnf >/dev/null 2>&1; then
    dnf install -y git
    return
  fi

  die "git is required and no dnf is available to install it"
}

# Supplies the bot token to git without it ever reaching .git/config or a
# process argument. Mirrors scripts/symphony/setup-local-env.sh.
write_git_askpass() {
  local token="$1"
  local tmp

  install -d -m 0755 "$config_dir"
  tmp="$(mktemp)"
  cat >"$tmp" <<'ASKPASS'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' "x-access-token" ;;
  *Password*) printf '%s\n' "${GITHUB_TOKEN}" ;;
  *) printf '\n' ;;
esac
ASKPASS
  install -m 0750 "$tmp" "$git_askpass_path"
  rm -f "$tmp"

  export GIT_ASKPASS="$git_askpass_path"
  export GIT_TERMINAL_PROMPT=0
  export GCM_INTERACTIVE=never
  export GITHUB_TOKEN="$token"
}

# Default branch only. Landing on the requested ref is 05-source's job, because
# that needs the never-clobber policy and this file must not carry a second copy
# of it.
ensure_bootstrap_source_clone() {
  [[ -d "$bootstrap_source_checkout/.git" ]] && return 0

  install -d -m 0755 "$src_root"
  git -c credential.helper= clone "$github_base_url/$bootstrap_repo.git" "$bootstrap_source_checkout" ||
    die "failed to clone $bootstrap_repo into $bootstrap_source_checkout"
}

main() {
  local mode="${1:-bootstrap}"
  local region
  local github_token
  local installer_path

  require_command curl
  require_command jq
  install_git

  if [[ -z "${SYMPHONY_GITHUB_TOKEN:-}" && -z "${SYMPHONY_SECRETS_DIR:-}" ]]; then
    require_command aws
  fi

  region="$(metadata_region)"
  github_token="${SYMPHONY_GITHUB_TOKEN:-$(github_token_from_secret "$region")}"

  install -d -m 0700 "$state_dir"
  install -d -m 0755 "$log_dir"

  write_git_askpass "$github_token"
  ensure_bootstrap_source_clone

  installer_path="$bootstrap_source_checkout/scripts/symphony/host/install-runtime.sh"
  [[ -x "$installer_path" ]] || die "installer is missing or not executable: $installer_path"

  export SYMPHONY_AWS_REGION="$region"
  export SYMPHONY_GITHUB_TOKEN="$github_token"
  export SYMPHONY_BOOTSTRAP_MODE="$mode"

  log "running installer from $bootstrap_source_checkout"
  "$installer_path"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
