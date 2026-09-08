#!/usr/bin/env bash
# Materialize runtime credentials from Secrets Manager into /etc/symphony.
#
# Everything written here is root-owned and group-readable by the runtime user,
# and lands on the root volume — never on the disposable workspace volume.
set -euo pipefail

SYMPHONY_STEP_NAME="40-credentials"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

write_json_secret_file() {
  local secret_id="$1"
  local dest="$2"
  local secret
  local tmp

  secret="$(require_secret "$secret_id")"
  printf '%s' "$secret" | jq -e . >/dev/null ||
    die "$secret_id must contain JSON"

  tmp="$(mktemp "$state_dir/secret.XXXXXX")"
  printf '%s\n' "$secret" >"$tmp"
  install_secret_file "$tmp" "$dest"
  rm -f "$tmp"
}

json_bool() {
  if "$@"; then
    printf true
  else
    printf false
  fi
}

file_nonempty() {
  [[ -s "$1" ]]
}

dir_present() {
  [[ -d "$1" ]]
}

file_executable() {
  [[ -x "$1" ]]
}

runtime_env_key_present() {
  local key="$1"

  [[ -f "$runtime_env_path" ]] || return 1
  (
    set +u
    source "$runtime_env_path"
    [[ -n "${!key:-}" ]]
  )
}

write_credential_presence_report() {
  local output="${1:-${SYMPHONY_CREDENTIAL_PRESENCE_PATH:-$state_dir/credential-presence.json}}"
  local codex_home
  local tmp
  local recorded_at

  codex_home="$(runtime_codex_home)"
  recorded_at="${SYMPHONY_CREDENTIAL_PRESENCE_RECORDED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

  install_dir 0700 "$state_dir"
  install_dir 0700 "$(dirname "$output")"
  tmp="$(mktemp "$state_dir/credential-presence.XXXXXX")"
  jq -n \
    --arg recorded_at "$recorded_at" \
    --arg runtime_env_path "$runtime_env_path" \
    --arg git_askpass_path "$git_askpass_path" \
    --arg google_credentials_path "$google_credentials_path" \
    --arg codex_home "$codex_home" \
    --arg codex_auth_path "$codex_home/auth.json" \
    --arg codex_config_path "$codex_home/config.toml" \
    --argjson runtime_env_present "$(json_bool file_nonempty "$runtime_env_path")" \
    --argjson git_askpass_present "$(json_bool file_nonempty "$git_askpass_path")" \
    --argjson git_askpass_executable "$(json_bool file_executable "$git_askpass_path")" \
    --argjson google_credentials_present "$(json_bool file_nonempty "$google_credentials_path")" \
    --argjson codex_home_present "$(json_bool dir_present "$codex_home")" \
    --argjson codex_auth_present "$(json_bool file_nonempty "$codex_home/auth.json")" \
    --argjson codex_config_present "$(json_bool file_nonempty "$codex_home/config.toml")" \
    --argjson github_token_present "$(json_bool runtime_env_key_present GITHUB_TOKEN)" \
    --argjson linear_token_present "$(json_bool runtime_env_key_present LINEAR_API_TOKEN)" \
    --argjson openai_key_present "$(json_bool runtime_env_key_present OPENAI_API_KEY)" \
    --argjson google_credentials_env_present "$(json_bool runtime_env_key_present GOOGLE_APPLICATION_CREDENTIALS)" \
    --argjson git_askpass_env_present "$(json_bool runtime_env_key_present GIT_ASKPASS)" \
    --argjson codex_home_env_present "$(json_bool runtime_env_key_present CODEX_HOME)" \
    '{
      schemaVersion: "symphony-host-credential-presence/v1",
      recordedAt: $recorded_at,
      files: {
        runtime_env: {
          path: $runtime_env_path,
          present: $runtime_env_present
        },
        git_askpass: {
          path: $git_askpass_path,
          present: $git_askpass_present,
          executable: $git_askpass_executable
        },
        google_credentials: {
          path: $google_credentials_path,
          present: $google_credentials_present
        }
      },
      codex: {
        home: {
          path: $codex_home,
          present: $codex_home_present
        },
        auth_json: {
          path: $codex_auth_path,
          present: $codex_auth_present
        },
        config_toml: {
          path: $codex_config_path,
          present: $codex_config_present
        }
      },
      runtime_env_keys: {
        GITHUB_TOKEN: $github_token_present,
        LINEAR_API_TOKEN: $linear_token_present,
        OPENAI_API_KEY: $openai_key_present,
        GOOGLE_APPLICATION_CREDENTIALS: $google_credentials_env_present,
        GIT_ASKPASS: $git_askpass_env_present,
        CODEX_HOME: $codex_home_env_present
      }
    }' >"$tmp"

  jq -e '
    .schemaVersion == "symphony-host-credential-presence/v1" and
    .files.runtime_env.present == true and
    .files.git_askpass.present == true and
    .files.git_askpass.executable == true and
    .files.google_credentials.present == true and
    .codex.home.present == true and
    .codex.auth_json.present == true and
    .codex.config_toml.present == true and
    all(.runtime_env_keys[]; . == true)
  ' "$tmp" >/dev/null || die "credential presence check failed"

  install -m 0644 "$tmp" "$output"
  rm -f "$tmp"

  if is_root; then
    chown "root:$runtime_group" "$output"
  fi
}

write_runtime_git_askpass() {
  local tmp

  tmp="$(mktemp "$state_dir/git-askpass.XXXXXX")"
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

  if is_root; then
    chown "root:$runtime_group" "$git_askpass_path"
  fi
}

write_codex_home() {
  local openai_key="$1"
  local codex_home="${SYMPHONY_CODEX_HOME:-$workspace_root/cache/codex-home}"
  local auth_tmp
  local config_tmp

  install_runtime_dir 0700 "$codex_home"

  auth_tmp="$(mktemp "$state_dir/codex-auth.XXXXXX")"
  jq -n --arg key "$openai_key" '{OPENAI_API_KEY: $key}' >"$auth_tmp"
  install -m 0600 "$auth_tmp" "$codex_home/auth.json"
  rm -f "$auth_tmp"

  config_tmp="$(mktemp "$state_dir/codex-config.XXXXXX")"
  printf 'preferred_auth_method = "apikey"\n' >"$config_tmp"
  install -m 0600 "$config_tmp" "$codex_home/config.toml"
  rm -f "$config_tmp"

  if is_root; then
    chown "$runtime_user:$runtime_group" "$codex_home/auth.json" "$codex_home/config.toml"
  fi
}

write_runtime_credentials() {
  local keys_secret="${SYMPHONY_KEYS_SECRET_ID:-symphony/runtime-credentials}"
  local keys_json
  local github_token
  local linear_token
  local openai_key
  local tmp

  keys_json="$(require_secret "$keys_secret")"
  github_token="$(json_value "$keys_json" GITHUB_TOKEN)" ||
    die "$keys_secret is missing GITHUB_TOKEN"
  linear_token="$(json_value "$keys_json" LINEAR_API_TOKEN)" ||
    die "$keys_secret is missing LINEAR_API_TOKEN"
  openai_key="$(json_value "$keys_json" OPENAI_API_KEY)" ||
    die "$keys_secret is missing OPENAI_API_KEY"

  write_json_secret_file "${SYMPHONY_GOOGLE_SECRET_ID:-symphony-google-service-account-json}" "$google_credentials_path"
  write_runtime_git_askpass
  write_codex_home "$openai_key"
  install_runtime_dir 0700 "$workspace_root/cache/npm"

  tmp="$(mktemp "$state_dir/runtime-env.XXXXXX")"
  {
    printf 'HOME='
    shell_quote "$workspace_root"
    printf '\nGITHUB_TOKEN='
    shell_quote "$github_token"
    printf '\nLINEAR_API_TOKEN='
    shell_quote "$linear_token"
    printf '\nOPENAI_API_KEY='
    shell_quote "$openai_key"
    printf '\nGOOGLE_APPLICATION_CREDENTIALS='
    shell_quote "$google_credentials_path"
    printf '\nGIT_ASKPASS='
    shell_quote "$git_askpass_path"
    printf '\nGIT_TERMINAL_PROMPT='
    shell_quote "0"
    printf '\nGCM_INTERACTIVE='
    shell_quote "never"
    printf '\nGIT_CONFIG_KEY_0='
    shell_quote "credential.helper"
    printf '\nGIT_CONFIG_VALUE_0='
    shell_quote ""
    printf '\nGIT_CONFIG_KEY_1='
    shell_quote "url.https://github.com/.insteadOf"
    printf '\nGIT_CONFIG_VALUE_1='
    shell_quote "git@github.com:"
    printf '\nGIT_CONFIG_COUNT='
    shell_quote "2"
    printf '\nSYMPHONY_BOT_USER='
    shell_quote "${SYMPHONY_BOT_USER:-example-symphony-bot}"
    printf '\nCADENCE_REVIEWER='
    shell_quote "${CADENCE_REVIEWER:-example-cadence-bot}"
    printf '\nSYMPHONY_REPOSITORY_OWNER='
    shell_quote "${SYMPHONY_REPOSITORY_OWNER:-example-org}"
    printf '\nSYMPHONY_GIT_AUTHOR_EMAIL='
    shell_quote "${SYMPHONY_GIT_AUTHOR_EMAIL:-symphony@example.invalid}"
    printf '\nSYMPHONY_EXPECTED_LINEAR_EMAIL='
    shell_quote "${SYMPHONY_EXPECTED_LINEAR_EMAIL:-linear-bot@example.invalid}"
    printf '\nGIT_AUTHOR_NAME='
    shell_quote "${SYMPHONY_BOT_USER:-example-symphony-bot}"
    printf '\nGIT_AUTHOR_EMAIL='
    shell_quote "${SYMPHONY_GIT_AUTHOR_EMAIL:-symphony@example.invalid}"
    printf '\nGIT_COMMITTER_NAME='
    shell_quote "${SYMPHONY_BOT_USER:-example-symphony-bot}"
    printf '\nGIT_COMMITTER_EMAIL='
    shell_quote "${SYMPHONY_GIT_AUTHOR_EMAIL:-symphony@example.invalid}"
    printf '\nCODEX_HOME='
    shell_quote "${SYMPHONY_CODEX_HOME:-$workspace_root/cache/codex-home}"
    printf '\nNPM_CONFIG_CACHE='
    shell_quote "$workspace_root/cache/npm"
    printf '\nSYMPHONY_WORKSPACE_ROOT='
    shell_quote "$workspace_root"
    printf '\nSYMPHONY_LOGS_ROOT='
    shell_quote "$logs_root"
    printf '\nSYMPHONY_WORKER_SLOTS='
    shell_quote "$worker_slots"
    printf '\nPATH='
    shell_quote "$default_runtime_path"
    printf '\n'
  } >"$tmp"
  install_secret_file "$tmp" "$runtime_env_path"
  rm -f "$tmp"
  write_credential_presence_report

  if [[ -z "${SYMPHONY_GITHUB_TOKEN:-}" ]]; then
    export SYMPHONY_GITHUB_TOKEN="$github_token"
  fi
}

main() {
  require_root
  worker_slots="$(resolve_worker_slots)"
  write_runtime_credentials
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
