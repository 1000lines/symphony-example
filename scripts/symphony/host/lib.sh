#!/usr/bin/env bash
# Shared configuration and helpers for the Symphony host installer.
#
# Sourced by install-runtime.sh (the step runner) and by every install.d/ step.
# Steps are executable standalone, so every default has to be derivable here
# rather than passed down from the runner.
#
# This file must stay free of side effects: sourcing it defines variables and
# functions and reads the install-state file, nothing more.

[[ -n "${SYMPHONY_LIB_SOURCED:-}" ]] && return 0
SYMPHONY_LIB_SOURCED=1

host_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$host_dir/../../.." && pwd)"

templates_dir="${SYMPHONY_TEMPLATES_DIR:-$host_dir/templates}"
steps_dir="${SYMPHONY_STEPS_DIR:-$host_dir/install.d}"
hooks_dir="${SYMPHONY_HOOKS_DIR:-$host_dir/hooks.d}"
init_workspace_script="${SYMPHONY_INIT_WORKSPACE_SCRIPT:-$repo_root/infra/static/modules/symphony-host/files/init-workspace-volume.sh}"

github_api_url="${SYMPHONY_GITHUB_API_URL:-https://api.github.com}"
github_base_url="${SYMPHONY_GITHUB_BASE_URL:-https://github.com}"
bootstrap_repo="${SYMPHONY_BOOTSTRAP_REPO:-example-org/example-repo}"
runtime_repo="${SYMPHONY_RUNTIME_REPO:-example-org/symphony}"

runtime_user="${SYMPHONY_RUNTIME_USER:-symphony}"
runtime_group="${SYMPHONY_RUNTIME_GROUP:-symphony}"

opt_root="${SYMPHONY_OPT_ROOT:-/opt/symphony}"
releases_dir="${SYMPHONY_RELEASES_DIR:-$opt_root/releases}"
current_link="${SYMPHONY_CURRENT_LINK:-$opt_root/current}"
bootstrap_bin_dir="${SYMPHONY_BOOTSTRAP_BIN_DIR:-$opt_root/bootstrap}"
src_root="${SYMPHONY_SRC_ROOT:-$opt_root/src}"
tools_root="${SYMPHONY_TOOLS_ROOT:-$opt_root/tools}"
config_dir="${SYMPHONY_CONFIG_DIR:-/etc/symphony}"
systemd_dir="${SYMPHONY_SYSTEMD_DIR:-/etc/systemd/system}"

# Bootstrap state lives beside the workspace root, never under it: the workspace
# volume mounts over /var/lib/symphony, which would both shadow anything written
# here first and put root-only credentials on the disposable volume.
state_dir="${SYMPHONY_BOOTSTRAP_STATE_DIR:-/var/lib/symphony-bootstrap}"
markers_dir="$state_dir/markers"
install_state_file="$state_dir/install-state.env"
provenance_path="$state_dir/provenance.json"

workspace_root="${SYMPHONY_WORKSPACE_ROOT:-/var/lib/symphony}"
logs_root="${SYMPHONY_LOGS_ROOT:-/var/log/symphony}"
bootstrap_log_dir="${SYMPHONY_BOOTSTRAP_LOG_DIR:-/var/log/symphony-bootstrap}"

mise_bin="${SYMPHONY_MISE_BIN:-$tools_root/bin/mise}"
erlang_version="${SYMPHONY_ERLANG_VERSION:-28.5.0.5}"
elixir_version="${SYMPHONY_ELIXIR_VERSION:-1.19.5-otp-28}"
escript_name="${SYMPHONY_RUNTIME_ESCRIPT_NAME:-symphony}"

service_port="${SYMPHONY_SERVICE_PORT:-4000}"
worker_slots="${SYMPHONY_WORKER_SLOTS:-6}"
default_runtime_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

workflow_path="$config_dir/WORKFLOW.md"
runtime_env_path="$config_dir/runtime.env"
git_askpass_path="$config_dir/git-askpass.sh"
google_credentials_path="$config_dir/google-drive-reader-sa.json"
runtime_bin="$current_link/bin/$escript_name"
runtime_bundle_source_dir="${SYMPHONY_RUNTIME_BUNDLE_SOURCE_DIR:-$repo_root/scripts/symphony/runtime-bundle}"
runtime_bundle_cache_dir="${SYMPHONY_RUNTIME_BUNDLE_CACHE_DIR:-$workspace_root/cache/runtime-bundle}"
runtime_bundle_releases_dir="${SYMPHONY_RUNTIME_BUNDLE_RELEASES_DIR:-$runtime_bundle_cache_dir/releases}"
runtime_bundle_current_link="${SYMPHONY_RUNTIME_BUNDLE_CURRENT_LINK:-$runtime_bundle_cache_dir/current}"
runtime_bundle_lock_path="${SYMPHONY_RUNTIME_BUNDLE_LOCK_PATH:-$runtime_bundle_cache_dir/runtime-bundle.lock}"

bootstrap_source_checkout="$src_root/example-repo"
symphony_checkout="$src_root/symphony"

log() {
  printf 'symphony-install[%s]: %s\n' "${SYMPHONY_STEP_NAME:-lib}" "$*"
}

warn() {
  printf 'symphony-install[%s]: WARNING: %s\n' "${SYMPHONY_STEP_NAME:-lib}" "$*" >&2
}

die() {
  printf 'symphony-install[%s]: %s\n' "${SYMPHONY_STEP_NAME:-lib}" "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required"
}

is_root() {
  [[ "$(id -u)" == "0" ]]
}

require_root() {
  if ! is_root && [[ "${SYMPHONY_ALLOW_NON_ROOT_INSTALL:-0}" != "1" ]]; then
    die "run as root or set SYMPHONY_ALLOW_NON_ROOT_INSTALL=1 for local fixtures"
  fi
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
    return
  fi

  shasum -a 256 "$1" | awk '{print $1}'
}

sha256_tree() {
  local dir="$1"

  [[ -d "$dir" ]] || die "checksum source is missing: $dir"

  (
    cd "$dir"
    while IFS= read -r -d '' file; do
      cat "$file"
    done < <(find . -type f -print0 | LC_ALL=C sort -z)
  ) | if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  else
    shasum -a 256 | awk '{print $1}'
  fi
}

shell_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

escape_sed() {
  printf '%s' "$1" | sed -e 's/[\/&|]/\\&/g'
}

install_dir() {
  local mode="$1"
  local path="$2"

  install -d -m "$mode" "$path"
}

install_runtime_dir() {
  local mode="$1"
  local path="$2"

  install_dir "$mode" "$path"

  if is_root; then
    chown "$runtime_user:$runtime_group" "$path"
  fi
}

install_root_group_dir() {
  local mode="$1"
  local path="$2"

  install_dir "$mode" "$path"

  if is_root; then
    chown "root:$runtime_group" "$path"
  fi
}

install_secret_file() {
  local source="$1"
  local dest="$2"

  install -m 0640 "$source" "$dest"
  if is_root; then
    chown "root:$runtime_group" "$dest"
  fi
}

runtime_env_value() {
  local key="$1"

  [[ -f "$runtime_env_path" ]] ||
    die "$runtime_env_path is missing; run 40-credentials before this step"

  (
    set +u
    source "$runtime_env_path"
    printf '%s' "${!key:-}"
  )
}

prepend_runtime_path() {
  local prepend="$1"
  local existing_path
  local tmp

  [[ -n "$prepend" ]] || die "no runtime path to record"
  existing_path="$(runtime_env_value PATH)"
  if [[ -z "$existing_path" ]]; then
    existing_path="$default_runtime_path"
  fi

  tmp="$(mktemp "$state_dir/runtime-env.XXXXXX")"
  grep -v '^PATH=' "$runtime_env_path" >"$tmp" || true
  {
    printf 'PATH='
    shell_quote "$prepend:$existing_path"
    printf '\n'
  } >>"$tmp"
  install_secret_file "$tmp" "$runtime_env_path"
  rm -f "$tmp"
}

# Steps run as separate processes, so anything one step discovers and a later
# step needs travels through this file rather than through shell variables.
# Plain `KEY=value` lines, safe to cat when debugging on the host.
state_set() {
  local key="$1"
  local value="$2"
  local tmp

  install_dir 0700 "$state_dir"
  tmp="$(mktemp "$state_dir/install-state.XXXXXX")"

  if [[ -f "$install_state_file" ]]; then
    grep -v "^$key=" "$install_state_file" >"$tmp" || true
  fi

  {
    printf '%s=' "$key"
    shell_quote "$value"
    printf '\n'
  } >>"$tmp"

  install -m 0600 "$tmp" "$install_state_file"
  rm -f "$tmp"
  export "$key=$value"
}

state_load() {
  [[ -f "$install_state_file" ]] || return 0

  local key
  local value

  while IFS= read -r line; do
    [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    # Only adopt values the caller has not already set explicitly.
    [[ -n "${!key:-}" ]] && continue
    if ! eval "export $key=$value" 2>/dev/null; then
      warn "ignoring malformed install-state line for $key"
    fi
  done <"$install_state_file"
}

marker_path() {
  printf '%s/%s\n' "$markers_dir" "$1"
}

marker_present() {
  [[ -f "$(marker_path "$1")" ]]
}

marker_record() {
  install_dir 0700 "$markers_dir"
  : >"$(marker_path "$1")"
}

# Instance metadata. Read on demand rather than at source time, so sourcing
# lib.sh stays free of network calls.
imds_get() {
  local path="$1"
  local base="${SYMPHONY_IMDS_BASE_URL:-http://169.254.169.254}"
  local token="${SYMPHONY_IMDS_TOKEN:-}"

  if [[ -n "${SYMPHONY_METADATA_DIR:-}" ]]; then
    local file="$SYMPHONY_METADATA_DIR/${path#/}"
    [[ -f "$file" ]] || die "missing metadata fixture: $path"
    cat "$file"
    return
  fi

  # Short timeouts: off an EC2 instance this address black-holes rather than
  # refusing, so without them a stray metadata read hangs for minutes.
  if [[ -z "$token" ]]; then
    token="$(
      curl -fsS -X PUT --connect-timeout 2 --max-time 5 \
        -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" \
        "$base/latest/api/token"
    )" || die "failed to acquire IMDSv2 token"
  fi

  curl -fsS --connect-timeout 2 --max-time 5 \
    -H "X-aws-ec2-metadata-token: $token" "$base/${path#/}"
}

metadata_tag() {
  imds_get "latest/meta-data/tags/instance/$1"
}

metadata_region() {
  if [[ -n "${SYMPHONY_AWS_REGION:-}" ]]; then
    printf '%s\n' "$SYMPHONY_AWS_REGION"
    return
  fi

  imds_get "latest/dynamic/instance-identity/document" | jq -er '.region'
}

metadata_instance_id() {
  if [[ -n "${SYMPHONY_INSTANCE_ID:-}" ]]; then
    printf '%s\n' "$SYMPHONY_INSTANCE_ID"
    return
  fi

  imds_get "latest/meta-data/instance-id"
}

metadata_ami_id() {
  if [[ -n "${SYMPHONY_AMI_ID:-}" ]]; then
    printf '%s\n' "$SYMPHONY_AMI_ID"
    return
  fi

  imds_get "latest/meta-data/ami-id"
}

# Resolution order for every ref/slot setting: explicit env (fixtures and
# overrides), then the instance tag, then the documented default.
resolve_tag_setting() {
  local env_value="$1"
  local tag="$2"
  local fallback="${3:-}"
  local value

  if [[ -n "$env_value" ]]; then
    printf '%s\n' "$env_value"
    return
  fi

  value="$(metadata_tag "$tag" 2>/dev/null || true)"
  if [[ -n "$value" ]]; then
    printf '%s\n' "$value"
    return
  fi

  printf '%s\n' "$fallback"
}

parse_worker_slots() {
  local raw="${1:-}"
  local value

  if [[ -z "$raw" ]]; then
    raw="6"
  fi

  [[ "$raw" =~ ^[0-9]+$ ]] || die "invalid symphony:worker-slots tag: $raw"
  value=$((10#$raw))
  ((value >= 1 && value <= 64)) || die "symphony:worker-slots must be between 1 and 64: $raw"

  printf '%s\n' "$value"
}

resolve_worker_slots() {
  parse_worker_slots "$(resolve_tag_setting "${SYMPHONY_WORKER_SLOTS:-}" "symphony:worker-slots")"
}

resolve_bootstrap_ref() {
  local ref
  ref="$(resolve_tag_setting "${SYMPHONY_BOOTSTRAP_REF:-}" "symphony:bootstrap-ref")"
  [[ -n "$ref" ]] || die "missing symphony:bootstrap-ref"
  printf '%s\n' "$ref"
}

resolve_runtime_ref() {
  local ref
  ref="$(resolve_tag_setting "${SYMPHONY_RUNTIME_REF:-}" "symphony:runtime-ref")"
  [[ -n "$ref" ]] || die "missing symphony:runtime-ref"
  printf '%s\n' "$ref"
}

aws_secret_string() {
  local secret_id="$1"

  if [[ -n "${SYMPHONY_SECRETS_DIR:-}" ]]; then
    local file="$SYMPHONY_SECRETS_DIR/$secret_id"
    [[ -f "$file" ]] || die "missing required secret: $secret_id"
    cat "$file"
    return
  fi

  aws secretsmanager get-secret-value \
    --secret-id "$secret_id" \
    --region "${SYMPHONY_AWS_REGION:?SYMPHONY_AWS_REGION is required}" \
    --query SecretString \
    --output text
}

require_secret() {
  local secret_id="$1"

  aws_secret_string "$secret_id" || die "failed to read required secret: $secret_id"
}

json_value() {
  local json="$1"
  local key="$2"

  printf '%s' "$json" | jq -er --arg key "$key" '.[$key] // empty'
}

# Runs git with the bootstrap credential helper disabled and the askpass script
# supplying the bot token, so no token is ever written into .git/config.
symphony_git() {
  GIT_TERMINAL_PROMPT=0 \
    GCM_INTERACTIVE=never \
    GIT_ASKPASS="${GIT_ASKPASS:-$git_askpass_path}" \
    GITHUB_TOKEN="${SYMPHONY_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}" \
    git -c credential.helper= "$@"
}

checkout_is_dirty() {
  local dir="$1"

  [[ -n "$(symphony_git -C "$dir" status --porcelain 2>/dev/null)" ]]
}

checkout_head() {
  symphony_git -C "$1" rev-parse HEAD
}

runtime_bundle_repo_sha() {
  local fallback="${SYMPHONY_BOOTSTRAP_HEAD:-${SYMPHONY_BOOTSTRAP_SHA:-}}"

  if [[ -n "${SYMPHONY_RUNTIME_BUNDLE_REPO_SHA:-}" ]]; then
    printf '%s\n' "$SYMPHONY_RUNTIME_BUNDLE_REPO_SHA"
    return
  fi

  if [[ -d "$bootstrap_source_checkout/.git" ]]; then
    checkout_head "$bootstrap_source_checkout"
    return
  fi

  [[ -n "$fallback" ]] || die "missing runtime bundle repo SHA"
  printf '%s\n' "$fallback"
}

runtime_codex_home() {
  if [[ -n "${SYMPHONY_CODEX_HOME:-}" ]]; then
    printf '%s\n' "$SYMPHONY_CODEX_HOME"
    return
  fi

  if [[ -f "$runtime_env_path" ]]; then
    runtime_env_value CODEX_HOME
    return
  fi

  printf '%s\n' "$workspace_root/cache/codex-home"
}

runtime_codex_wrapper_path() {
  printf '%s\n' "$(runtime_codex_home)/runtime/bin/codex-with-runtime-bundle.sh"
}

runtime_bundle_workflow_source() {
  if [[ -f "$runtime_bundle_current_link/workflow/WORKFLOW.md" ]]; then
    printf '%s\n' "$runtime_bundle_current_link/workflow/WORKFLOW.md"
    return
  fi

  printf '%s\n' "$runtime_bundle_source_dir/workflow/WORKFLOW.md"
}

runtime_bundle_prepare_lock() {
  local lock_dir
  lock_dir="$(dirname "$runtime_bundle_lock_path")"

  if [[ ! -d "$lock_dir" ]]; then
    install_root_group_dir 0755 "$lock_dir"
  fi

  if [[ ! -e "$runtime_bundle_lock_path" ]]; then
    : >"$runtime_bundle_lock_path"
  fi

  if is_root; then
    chown "root:$runtime_group" "$runtime_bundle_lock_path"
    chmod 0664 "$runtime_bundle_lock_path"
  fi
}

with_runtime_bundle_lock() {
  require_command flock
  runtime_bundle_prepare_lock

  (
    flock 9
    "$@"
  ) 9>"$runtime_bundle_lock_path"
}

runtime_bundle_installed_repo_sha() {
  local codex_home="${1:-$(runtime_codex_home)}"
  local manifest="$codex_home/runtime-bundle-manifest.json"

  [[ -f "$manifest" ]] || return 1
  jq -er '.repo.sha // empty' "$manifest"
}

runtime_bundle_source_sha() {
  sha256_tree "$runtime_bundle_source_dir"
}

runtime_bundle_installed_bundle_sha() {
  local codex_home="${1:-$(runtime_codex_home)}"
  local manifest="$codex_home/runtime-bundle-manifest.json"

  [[ -f "$manifest" ]] || return 1
  jq -er '.bundle.sha256 // empty' "$manifest"
}

runtime_bundle_fresh_for_bundle_sha_unlocked() {
  local expected_sha="$1"
  local installed_sha

  installed_sha="$(runtime_bundle_installed_bundle_sha)" || return 1
  [[ "$installed_sha" == "$expected_sha" ]]
}

runtime_bundle_fresh_for_bundle_sha() {
  local expected_sha="$1"

  with_runtime_bundle_lock runtime_bundle_fresh_for_bundle_sha_unlocked "$expected_sha"
}

runtime_bundle_fresh_for_source_unlocked() {
  local expected_sha="${1:-}"

  if [[ -z "$expected_sha" ]]; then
    expected_sha="$(runtime_bundle_source_sha)"
  fi

  runtime_bundle_fresh_for_bundle_sha_unlocked "$expected_sha"
}

runtime_bundle_fresh_for_source() {
  local expected_sha="${1:-}"

  with_runtime_bundle_lock runtime_bundle_fresh_for_source_unlocked "$expected_sha"
}

runtime_codex_version() {
  local version

  if command -v codex >/dev/null 2>&1; then
    if version="$(codex --version 2>/dev/null)"; then
      printf '%s\n' "$version"
      return
    fi
  fi

  printf '%s\n' "${SYMPHONY_CODEX_VERSION:-0.147.0}"
}

# Commits made on the host and not yet pushed. "Fix a bug, commit, push" is the
# whole point of running from a checkout, so a commit that has not reached the
# remote counts as local work every bit as much as an unclean tree does.
checkout_is_ahead() {
  local dir="$1"
  local ref="$2"

  symphony_git -C "$dir" show-ref --verify --quiet "refs/remotes/origin/$ref" || return 1
  [[ "$(symphony_git -C "$dir" rev-list --count "origin/$ref..HEAD" 2>/dev/null || printf '0')" != "0" ]]
}

checkout_has_local_work() {
  local dir="$1"
  local ref="$2"

  checkout_is_dirty "$dir" || checkout_is_ahead "$dir" "$ref"
}

clone_if_absent() {
  local dir="$1"
  local repo="$2"

  [[ -d "$dir/.git" ]] && return 0

  install_dir 0755 "$(dirname "$dir")"
  symphony_git clone "$github_base_url/$repo.git" "$dir" ||
    die "failed to clone $repo into $dir"
}

# Converge a checkout on the desired ref, moving any local work aside rather
# than destroying it or refusing to converge.
#
# Local work is the rare case, and refusing to move on account of it is the
# worse failure: the host would sit on stale code indefinitely, which is exactly
# the state nobody notices. So uncommitted changes are stashed, unpushed commits
# are parked on a named branch, and the requested ref always ends up installed.
# Nothing is lost; it just stops being what runs.
#
# Sets <PREFIX>_HEAD / _STASHED / _BACKUP_BRANCH for provenance.
sync_checkout() {
  local dir="$1"
  local ref="$2"
  local prefix="$3"
  local label
  local head
  local stashed=0
  local backup_branch=""
  local stamp

  label="$(basename "$dir")"

  symphony_git -C "$dir" fetch --prune --tags origin ||
    die "failed to fetch origin for $label"

  if command -v git >/dev/null 2>&1 && is_root; then
    git config --system --add safe.directory "$dir" >/dev/null 2>&1 || true
  fi

  stamp="$(date -u +%Y%m%dT%H%M%SZ)"

  # --include-untracked, not --all: ignored paths stay put, so the symphony
  # checkout keeps _build/ and deps/ and rebuilds stay incremental.
  if checkout_is_dirty "$dir"; then
    symphony_git -C "$dir" stash push --include-untracked \
      --message "symphony-bootstrap $stamp" ||
      die "failed to stash local changes in $label"
    stashed=1
    warn "$label had uncommitted changes; stashed as 'symphony-bootstrap $stamp'"
    warn "$label recover with: git -C $dir stash list"
  fi

  # checkout -B resets the branch pointer, so commits made on the host and not
  # yet pushed need a name of their own before the ref lands on top of them.
  if checkout_is_ahead "$dir" "$ref"; then
    backup_branch="host-local/$stamp"
    symphony_git -C "$dir" branch "$backup_branch" HEAD ||
      die "failed to preserve unpushed commits in $label"
    warn "$label had unpushed commits; preserved on branch $backup_branch"
  fi

  if symphony_git -C "$dir" show-ref --verify --quiet "refs/remotes/origin/$ref"; then
    # A branch: land on the branch itself, not a detached SHA, so edits made on
    # the host can be committed and pushed without further setup.
    symphony_git -C "$dir" checkout -B "$ref" --track "origin/$ref" ||
      die "failed to check out branch $ref in $label"
  else
    symphony_git -C "$dir" checkout --detach "$ref" ||
      die "failed to check out $ref in $label"
  fi

  head="$(checkout_head "$dir")"
  log "$label at $head ($ref)"
  state_set "${prefix}_HEAD" "$head"
  state_set "${prefix}_STASHED" "$stashed"
  state_set "${prefix}_BACKUP_BRANCH" "$backup_branch"
}

state_load

# The BEAM toolchain lives under mise rather than on the system PATH, so every
# step that shells out to mix needs the path the toolchain step discovered.
runtime_tool_path="${SYMPHONY_RUNTIME_TOOL_PATH:-}"
if [[ -n "$runtime_tool_path" ]]; then
  export PATH="$runtime_tool_path:$PATH"
fi
