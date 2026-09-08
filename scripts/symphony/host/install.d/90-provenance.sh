#!/usr/bin/env bash
# Record what this host is actually running.
#
# Every field is required: a host that cannot say what it installed is a host
# nobody can debug, so a missing value fails bootstrap closed rather than
# producing a partial record. 99-systemd refuses to start services without it.
set -euo pipefail

SYMPHONY_STEP_NAME="90-provenance"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

checkout_head_or_fallback() {
  local checkout="$1"
  local fallback="$2"

  if [[ -d "$checkout/.git" ]]; then
    checkout_head "$checkout"
    return
  fi

  printf '%s' "$fallback"
}

# Reuse the credential step reporter so full bootstraps and bundle refreshes
# record identical non-secret checks.
source "$host_dir/install.d/40-credentials.sh"
SYMPHONY_STEP_NAME="90-provenance"

write_provenance() {
  local output="${1:-$provenance_path}"
  local tmp
  local timestamp
  local slots
  local workspace_state
  local required_value
  local installer_path
  local installer_checksum
  local bootstrap_ref
  local bootstrap_sha
  local runtime_ref
  local runtime_sha
  local region
  local instance_id
  local ami_id
  local codex_home
  local codex_config_path
  local codex_version
  local runtime_bundle_installed_manifest
  local runtime_bundle_installed_manifest_checksum
  local runtime_bundle_repo_sha_value
  local runtime_bundle_sha
  local runtime_bundle_manifest_sha
  local runtime_bundle_workflow_sha
  local runtime_bundle_manifest_path
  local runtime_bundle_release_path
  local runtime_bundle_current_target
  local credential_presence_manifest
  local credential_presence_manifest_checksum

  timestamp="${SYMPHONY_BOOTSTRAP_TIMESTAMP:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
  slots="$(resolve_worker_slots)"
  workspace_state="${SYMPHONY_WORKSPACE_STATE:-unknown}"

  installer_path="${SYMPHONY_INSTALLER_PATH:-$host_dir/install-runtime.sh}"
  installer_checksum="${SYMPHONY_INSTALLER_CHECKSUM:-$(sha256_file "$installer_path")}"

  # Read from the checkouts the earlier steps converged, so this records what is
  # on disk rather than a stale value inherited across runner re-exec.
  bootstrap_ref="$(resolve_bootstrap_ref)"
  bootstrap_sha="$(checkout_head_or_fallback "$bootstrap_source_checkout" "${SYMPHONY_BOOTSTRAP_HEAD:-${SYMPHONY_BOOTSTRAP_SHA:-}}")"
  runtime_ref="$(resolve_runtime_ref)"
  runtime_sha="$(checkout_head_or_fallback "$symphony_checkout" "${SYMPHONY_RUNTIME_HEAD:-${SYMPHONY_RUNTIME_SHA:-}}")"

  region="$(metadata_region)"
  instance_id="$(metadata_instance_id)"
  ami_id="$(metadata_ami_id)"

  codex_home="$(runtime_codex_home)"
  codex_config_path="$codex_home/config.toml"
  codex_version="$(runtime_codex_version)"
  runtime_bundle_installed_manifest="$codex_home/runtime-bundle-manifest.json"
  [[ -s "$runtime_bundle_installed_manifest" ]] ||
    die "missing runtime bundle manifest: $runtime_bundle_installed_manifest"

  runtime_bundle_installed_manifest_checksum="$(sha256_file "$runtime_bundle_installed_manifest")"
  runtime_bundle_repo_sha_value="$(jq -er '.repo.sha // empty' "$runtime_bundle_installed_manifest")"
  runtime_bundle_sha="$(jq -er '.bundle.sha256 // empty' "$runtime_bundle_installed_manifest")"
  runtime_bundle_manifest_sha="$(jq -er '.bundle.manifestSha256 // empty' "$runtime_bundle_installed_manifest")"
  runtime_bundle_workflow_sha="$(jq -er '.bundle.workflowSourceSha256 // empty' "$runtime_bundle_installed_manifest")"
  runtime_bundle_manifest_path="$runtime_bundle_current_link/manifest.json"
  [[ -s "$runtime_bundle_manifest_path" ]] ||
    die "missing runtime bundle source manifest: $runtime_bundle_manifest_path"
  runtime_bundle_release_path="$(jq -er '.bundle.releasePath // empty' "$runtime_bundle_installed_manifest")"
  runtime_bundle_current_target="$(readlink "$runtime_bundle_current_link")"
  credential_presence_manifest="${SYMPHONY_CREDENTIAL_PRESENCE_PATH:-$state_dir/credential-presence.json}"
  write_credential_presence_report "$credential_presence_manifest"
  credential_presence_manifest_checksum="$(sha256_file "$credential_presence_manifest")"

  for required_value in \
    "$installer_path" \
    "$installer_checksum" \
    "$ami_id" \
    "$instance_id" \
    "$region" \
    "$bootstrap_ref" \
    "$bootstrap_sha" \
    "$runtime_ref" \
    "$runtime_sha" \
    "$workspace_state" \
    "$codex_home" \
    "$codex_config_path" \
    "$codex_version" \
    "$runtime_bundle_installed_manifest" \
    "$runtime_bundle_installed_manifest_checksum" \
    "$runtime_bundle_repo_sha_value" \
    "$runtime_bundle_sha" \
    "$runtime_bundle_manifest_sha" \
    "$runtime_bundle_workflow_sha" \
    "$runtime_bundle_manifest_path" \
    "$runtime_bundle_release_path" \
    "$runtime_bundle_current_link" \
    "$runtime_bundle_current_target" \
    "$credential_presence_manifest" \
    "$credential_presence_manifest_checksum"; do
    [[ -n "$required_value" ]] || die "missing required provenance field"
  done

  [[ "$runtime_bundle_repo_sha_value" == "$bootstrap_sha" ]] ||
    die "runtime bundle repo SHA $runtime_bundle_repo_sha_value does not match bootstrap SHA $bootstrap_sha"

  install_dir 0700 "$state_dir"
  tmp="$(mktemp "$state_dir/provenance.XXXXXX")"
  jq -n \
    --arg timestamp "$timestamp" \
    --arg mode "${SYMPHONY_BOOTSTRAP_MODE:-bootstrap}" \
    --arg installer_url "${SYMPHONY_INSTALLER_URL:-$github_base_url/$bootstrap_repo/tree/$bootstrap_sha}" \
    --arg installer_path "$installer_path" \
    --arg installer_checksum "$installer_checksum" \
    --arg ami_id "$ami_id" \
    --arg instance_id "$instance_id" \
    --arg region "$region" \
    --arg bootstrap_repo "$bootstrap_repo" \
    --arg bootstrap_ref "$bootstrap_ref" \
    --arg bootstrap_sha "$bootstrap_sha" \
    --arg bootstrap_checkout "$bootstrap_source_checkout" \
    --argjson bootstrap_stashed "$([[ "${SYMPHONY_BOOTSTRAP_STASHED:-0}" == "1" ]] && printf true || printf false)" \
    --arg bootstrap_backup "${SYMPHONY_BOOTSTRAP_BACKUP_BRANCH:-}" \
    --arg runtime_repo "$runtime_repo" \
    --arg runtime_ref "$runtime_ref" \
    --arg runtime_sha "$runtime_sha" \
    --arg runtime_checkout "$symphony_checkout" \
    --argjson runtime_stashed "$([[ "${SYMPHONY_RUNTIME_STASHED:-0}" == "1" ]] && printf true || printf false)" \
    --arg runtime_backup "${SYMPHONY_RUNTIME_BACKUP_BRANCH:-}" \
    --arg workspace_state "$workspace_state" \
    --arg codex_home "$codex_home" \
    --arg codex_config_path "$codex_config_path" \
    --arg codex_version "$codex_version" \
    --arg runtime_bundle_installed_manifest "$runtime_bundle_installed_manifest" \
    --arg runtime_bundle_installed_manifest_checksum "$runtime_bundle_installed_manifest_checksum" \
    --arg runtime_bundle_repo_sha "$runtime_bundle_repo_sha_value" \
    --arg runtime_bundle_sha "$runtime_bundle_sha" \
    --arg runtime_bundle_manifest_sha "$runtime_bundle_manifest_sha" \
    --arg runtime_bundle_workflow_sha "$runtime_bundle_workflow_sha" \
    --arg runtime_bundle_manifest_path "$runtime_bundle_manifest_path" \
    --arg runtime_bundle_release_path "$runtime_bundle_release_path" \
    --arg runtime_bundle_current_link "$runtime_bundle_current_link" \
    --arg runtime_bundle_current_target "$runtime_bundle_current_target" \
    --slurpfile runtime_bundle_install "$runtime_bundle_installed_manifest" \
    --arg credential_presence_manifest "$credential_presence_manifest" \
    --arg credential_presence_manifest_checksum "$credential_presence_manifest_checksum" \
    --slurpfile credential_presence "$credential_presence_manifest" \
    --argjson worker_slots "$slots" \
    '{
      timestamp: $timestamp,
      mode: $mode,
      installer: {
        url: $installer_url,
        path: $installer_path,
        checksum_sha256: $installer_checksum
      },
      instance: {
        ami_id: $ami_id,
        instance_id: $instance_id,
        region: $region
      },
      refs: {
        bootstrap: {
          repo: $bootstrap_repo,
          desired_ref: $bootstrap_ref,
          resolved_sha: $bootstrap_sha,
          checkout: $bootstrap_checkout,
          stashed: $bootstrap_stashed,
          backup_branch: (if $bootstrap_backup == "" then null else $bootstrap_backup end)
        },
        runtime: {
          repo: $runtime_repo,
          desired_ref: $runtime_ref,
          resolved_sha: $runtime_sha,
          checkout: $runtime_checkout,
          stashed: $runtime_stashed,
          backup_branch: (if $runtime_backup == "" then null else $runtime_backup end)
        }
      },
      worker_slots: $worker_slots,
      workspace: {
        state: $workspace_state
      },
      codex: {
        version: $codex_version,
        config_path: $codex_config_path,
        home: $codex_home
      },
      runtime_bundle: {
        repo_sha: $runtime_bundle_repo_sha,
        bundle_sha256: $runtime_bundle_sha,
        manifest_path: $runtime_bundle_manifest_path,
        manifest_sha256: $runtime_bundle_manifest_sha,
        workflow_source_sha256: $runtime_bundle_workflow_sha,
        release_path: $runtime_bundle_release_path,
        current_link: $runtime_bundle_current_link,
        current_target: $runtime_bundle_current_target,
        installed_manifest_path: $runtime_bundle_installed_manifest,
        installed_manifest_sha256: $runtime_bundle_installed_manifest_checksum,
        installed_skills: $runtime_bundle_install[0].skills
      },
      credentials: {
        presence_manifest_path: $credential_presence_manifest,
        presence_manifest_sha256: $credential_presence_manifest_checksum,
        checks: $credential_presence[0]
      }
    }' >"$tmp"

  install -m 0644 "$tmp" "$output"
  rm -f "$tmp"
  [[ -s "$output" ]] || die "provenance was not written"
}

main() {
  require_root
  write_provenance "$@"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
