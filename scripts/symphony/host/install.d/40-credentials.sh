#!/usr/bin/env bash
# Materialize runtime credentials from Secrets Manager into /etc/symphony.
#
# Everything written here is root-owned and group-readable by the runtime user,
# and lands on the root volume — never on the disposable workspace volume.
set +x
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
    unset "$key"
    source "$runtime_env_path"
    [[ -n "${!key:-}" ]]
  )
}

write_credential_presence_report() {
  local output="${1:-${SYMPHONY_CREDENTIAL_PRESENCE_PATH:-$state_dir/credential-presence.json}}"
  local codex_home
  local tmp
  local recorded_at
  local auth_mode
  auth_mode="$(runtime_auth_mode)" || return 1

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
    --arg auth_mode "$auth_mode" \
    --argjson app_config_present "$(json_bool file_nonempty "$config_dir/github-app.json")" \
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
    } + (if $auth_mode == "app" then {github: {mode: $auth_mode, app_config_present: $app_config_present}} else {} end)' >"$tmp"

  jq -e '
    .schemaVersion == "symphony-host-credential-presence/v1" and
    .files.runtime_env.present == true and
    .files.git_askpass.present == true and
    .files.git_askpass.executable == true and
    .codex.home.present == true and
    .codex.auth_json.present == true and
    .codex.config_toml.present == true and
    (if .github.mode == "app" then .github.app_config_present else .runtime_env_keys.GITHUB_TOKEN end) and
    all(.runtime_env_keys | del(.GOOGLE_APPLICATION_CREDENTIALS, .GITHUB_TOKEN) | .[]; . == true)
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
case "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" in
  app) exec node "${SYMPHONY_GITHUB_APP_AUTH:?}" askpass "$1" ;;
  legacy) ;;
  *) exit 1 ;;
esac
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

write_runtime_app_auth() {
  # HACKATHON_LEGACY_AUTH: DEPLOY opts in; RETIRE removes the legacy selector.
  write_json_secret_file "${SYMPHONY_GITHUB_APP_SECRET_ID:-symphony/github-apps/symphony}" "$config_dir/github-app.json"
  install -m 0644 "$repo_root/scripts/symphony/github-app-auth.mjs" "$config_dir/github-app-auth.mjs"
  install_root_group_dir 0750 "$config_dir/bin"
  install -m 0750 "$repo_root/scripts/symphony/github-app-exec.sh" "$config_dir/bin/gh"
  if is_root; then chown "root:$runtime_group" "$config_dir/bin/gh"; fi
  export SYMPHONY_GITHUB_APP_CONFIG="$config_dir/github-app.json"
  export SYMPHONY_GITHUB_APP_CACHE="$workspace_root/cache/github-app"
  export SYMPHONY_GITHUB_APP_AUTH="$config_dir/github-app-auth.mjs"
  install_runtime_dir 0700 "$SYMPHONY_GITHUB_APP_CACHE"
  # Node is installed later by step 55. INSTALL runs the full broker preflight.
  jq -e '
    all(.appId, .installationId, .repositoryId; type == "number" and . > 0 and . <= 9007199254740991 and floor == .) and
    (.appSlug | test("^[a-z0-9-]+$")) and
    (.repository | test("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")) and
    (.privateKey | type == "string" and contains("PRIVATE KEY")) and
    (.permissions | type == "object" and length > 0)
  ' "$SYMPHONY_GITHUB_APP_CONFIG" >/dev/null 2>&1 || die "invalid private App configuration"
  # Preserve the selected App identities during later credential-only reloads.
  if [[ -f "$runtime_env_path" ]]; then
    for key in SYMPHONY_GIT_AUTHOR_EMAIL SYMPHONY_HUMAN_LOGIN CADENCE_APP_ID CADENCE_APP_SLUG SYMPHONY_GH_BIN; do
      if [[ -z "${!key:-}" ]]; then printf -v "$key" '%s' "$(runtime_env_value "$key")"; fi
    done
  fi
  : "${SYMPHONY_GIT_AUTHOR_EMAIL:?explicit App bot author email required}"
  : "${SYMPHONY_HUMAN_LOGIN:?explicit human mapping required}"
  : "${CADENCE_APP_ID:?explicit Cadence App ID required}"
  : "${CADENCE_APP_SLUG:?explicit Cadence App slug required}"
  SYMPHONY_APP_ID="$(jq -r .appId "$SYMPHONY_GITHUB_APP_CONFIG")"
  SYMPHONY_APP_SLUG="$(jq -r .appSlug "$SYMPHONY_GITHUB_APP_CONFIG")"
  SYMPHONY_BOT_USER="$SYMPHONY_APP_SLUG[bot]"
  CADENCE_REVIEWER="$CADENCE_APP_SLUG[bot]"
  # Step 60 records its real gh binary through prepend_runtime_path. Before
  # that, an empty value makes the wrapper fail closed if invoked prematurely.
  SYMPHONY_GH_BIN="${SYMPHONY_GH_BIN:-$(command -v gh || true)}"
  [[ "$SYMPHONY_GH_BIN" != "$config_dir/bin/gh" ]] || die "real gh binary required"
  unset GITHUB_TOKEN GH_TOKEN SYMPHONY_GITHUB_TOKEN
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
  local keys_secret="${SYMPHONY_KEYS_SECRET_ID:-symphony/keys}"
  local keys_json
  local github_token=""
  local linear_token
  local openai_key
  local tmp
  local key
  local auth_mode
  auth_mode="$(runtime_auth_mode)" || return 1
  export SYMPHONY_GITHUB_AUTH_MODE="$auth_mode"

  keys_json="$(require_secret "$keys_secret")"
  # HACKATHON_LEGACY_AUTH: keep the working deployment selected until DEPLOY.
  case "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" in
    legacy) github_token="$(json_value "$keys_json" GITHUB_TOKEN)" || die "$keys_secret is missing GITHUB_TOKEN" ;;
    app) write_runtime_app_auth ;;
    *) die "invalid SYMPHONY_GITHUB_AUTH_MODE" ;;
  esac
  linear_token="$(json_value "$keys_json" LINEAR_API_TOKEN)" ||
    die "$keys_secret is missing LINEAR_API_TOKEN"
  openai_key="$(json_value "$keys_json" OPENAI_API_KEY)" ||
    die "$keys_secret is missing OPENAI_API_KEY"

  # This deployment uses repository Markdown and needs no Google service account.
  write_runtime_git_askpass
  write_codex_home "$openai_key"
  install_runtime_dir 0700 "$workspace_root/cache/npm"

  tmp="$(mktemp "$state_dir/runtime-env.XXXXXX")"
  {
    printf 'HOME='
    shell_quote "$workspace_root"
    printf '\nSYMPHONY_GITHUB_AUTH_MODE='
    shell_quote "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}"
    if [[ "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" == app ]]; then
      for key in SYMPHONY_GITHUB_APP_CONFIG SYMPHONY_GITHUB_APP_CACHE SYMPHONY_GITHUB_APP_AUTH SYMPHONY_GH_BIN SYMPHONY_APP_ID SYMPHONY_APP_SLUG CADENCE_APP_ID CADENCE_APP_SLUG SYMPHONY_HUMAN_LOGIN; do
        printf '\n%s=' "$key"
        shell_quote "${!key}"
      done
      printf '\nGIT_CONFIG_KEY_2='
      shell_quote "credential.useHttpPath"
      printf '\nGIT_CONFIG_VALUE_2='
      shell_quote "true"
    else
      printf '\nGITHUB_TOKEN='
      shell_quote "$github_token"
    fi
    printf '\nLINEAR_API_TOKEN='
    shell_quote "$linear_token"
    printf '\nOPENAI_API_KEY='
    shell_quote "$openai_key"
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
    if [[ "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" == app ]]; then shell_quote "3"; else shell_quote "2"; fi
    printf '\nSYMPHONY_BOT_USER='
    shell_quote "${SYMPHONY_BOT_USER:-1000-symphony-bot}"
    printf '\nCADENCE_REVIEWER='
    shell_quote "${CADENCE_REVIEWER:-1000-cadence-bot}"
    printf '\nSYMPHONY_REPOSITORY_OWNER='
    shell_quote "${SYMPHONY_REPOSITORY_OWNER:-1000lines}"
    printf '\nSYMPHONY_GIT_AUTHOR_EMAIL='
    shell_quote "${SYMPHONY_GIT_AUTHOR_EMAIL:-327018241+1000-symphony-bot@users.noreply.github.com}"
    printf '\nSYMPHONY_EXPECTED_LINEAR_EMAIL='
    shell_quote "${SYMPHONY_EXPECTED_LINEAR_EMAIL:-jjc1729@gmail.com}"
    printf '\nGIT_AUTHOR_NAME='
    shell_quote "${SYMPHONY_BOT_USER:-1000-symphony-bot}"
    printf '\nGIT_AUTHOR_EMAIL='
    shell_quote "${SYMPHONY_GIT_AUTHOR_EMAIL:-327018241+1000-symphony-bot@users.noreply.github.com}"
    printf '\nGIT_COMMITTER_NAME='
    shell_quote "${SYMPHONY_BOT_USER:-1000-symphony-bot}"
    printf '\nGIT_COMMITTER_EMAIL='
    shell_quote "${SYMPHONY_GIT_AUTHOR_EMAIL:-327018241+1000-symphony-bot@users.noreply.github.com}"
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
    if [[ "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" == app ]]; then shell_quote "$config_dir/bin:$default_runtime_path"; else shell_quote "$default_runtime_path"; fi
    printf '\n'
  } >"$tmp"
  install_secret_file "$tmp" "$runtime_env_path"
  rm -f "$tmp"
  write_credential_presence_report

  if [[ "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" == legacy && -z "${SYMPHONY_GITHUB_TOKEN:-}" ]]; then
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
