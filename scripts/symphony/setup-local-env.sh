#!/usr/bin/env bash
# Source this before running local Symphony so agent work uses bot-owned
# credentials instead of the operator's personal GitHub/Linear/Google identity.
#
# Usage:
#   source scripts/symphony/setup-local-env.sh
#
# Required AWS access:
#   aws login --profile example
#
# Required AWS Secrets Manager entries:
#   symphony-google-service-account-json  raw Google service-account JSON
#   symphony/keys
#     JSON map of Symphony environment variables

set +x
if [[ "${BASH_SOURCE[0]}" == "$0" && "${1:-}" != "--identity-preflight" ]]; then
  echo "Source this script so it can export variables into your current shell:" >&2
  echo "  source scripts/symphony/setup-local-env.sh" >&2
  exit 2
fi

symphony_log() {
  printf '[symphony-setup] %s\n' "$*" >&2
}

symphony_redact() {
  local message="$*"
  local secret

  for secret in \
    "${GITHUB_TOKEN:-}" \
    "${GH_TOKEN:-}" \
    "${LINEAR_API_TOKEN:-}" \
    "${LINEAR_API_KEY:-}" \
    "${OPENAI_API_KEY:-}"; do
    if [[ -n "${secret}" ]]; then
      message="${message//${secret}/[redacted]}"
    fi
  done

  printf '%s' "${message}"
}

symphony_die() {
  printf '[symphony-setup] ERROR: %s\n' "$(symphony_redact "$*")" >&2
  return 1
}

symphony_require_command() {
  command -v "$1" >/dev/null 2>&1 || symphony_die "Missing required command: $1"
}

symphony_secret_string() {
  local secret_id="$1"

  aws secretsmanager get-secret-value \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}" \
    --secret-id "${secret_id}" \
    --query SecretString \
    --output text
}

symphony_load_secret_env_map() {
  local secret_id="$1"
  local exports

  symphony_log "Loading environment from Secrets Manager secret ${secret_id}"

  if ! exports="$(
    symphony_secret_string "${secret_id}" |
      node -e '
        const fs = require("fs");
        try {
          const values = JSON.parse(fs.readFileSync(0, "utf8"));
          if (!values || Array.isArray(values) || typeof values !== "object") process.exit(1);

          const quote = String.fromCharCode(39);
          for (const [name, value] of Object.entries(values)) {
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || typeof value !== "string") process.exit(1);
            const escaped = value.replaceAll(quote, quote + "\\" + quote + quote);
            process.stdout.write(`export ${name}=${quote}${escaped}${quote}\n`);
          }
        } catch {
          process.exit(1);
        }
      '
  )"; then
    symphony_die "Unable to load environment from ${secret_id}"
    return 1
  fi

  eval "${exports}"
}

symphony_json_field() {
  local file="$1"
  local field="$2"

  node -e '
    const fs = require("fs");
    const [file, field] = process.argv.slice(1);
    const value = JSON.parse(fs.readFileSync(file, "utf8"))[field];
    if (typeof value !== "string" || value.length === 0) process.exit(1);
    process.stdout.write(value);
  ' "${file}" "${field}"
}

symphony_set_identity_defaults() {
  # HACKATHON_LEGACY_AUTH: App opt-in is durable; RETIRE removes legacy defaults.
  # The legacy identity check and Git askpass still require GITHUB_TOKEN.
  # Remove this default only after deployed App-authenticated clone/push/PR
  # and current-head CI/review evidence; a local App preflight is insufficient.
  # Host App auth does not replace the native Cadence reviewer's publishing
  # token, Claude key, or APPROVE/COMMENT signal.
  case "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" in
    app)
      export SYMPHONY_GITHUB_AUTH_MODE=app
      unset GITHUB_TOKEN GH_TOKEN SYMPHONY_GITHUB_TOKEN GIT_TRACE GIT_TRACE_CURL GIT_CURL_VERBOSE
      export SYMPHONY_GITHUB_APP_AUTH="${SYMPHONY_GITHUB_APP_AUTH:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/github-app-auth.mjs}"
      local identity
      identity="$(node --input-type=module -e 'const {loadAppConfig} = await import(process.env.SYMPHONY_GITHUB_APP_AUTH); const c = await loadAppConfig(); process.stdout.write(`${c.appId} ${c.appSlug}`);' 2>/dev/null)" || { symphony_die "Invalid private App configuration"; return 1; }
      export SYMPHONY_APP_ID="${identity%% *}" SYMPHONY_APP_SLUG="${identity#* }"
      export SYMPHONY_BOT_USER="$SYMPHONY_APP_SLUG[bot]"
      if [[ -z "${SYMPHONY_GIT_AUTHOR_EMAIL:-}" || -z "${SYMPHONY_HUMAN_LOGIN:-}" || -z "${CADENCE_APP_ID:-}" || -z "${CADENCE_APP_SLUG:-}" ]]; then
        symphony_die "App mode requires explicit bot author email, human login and Cadence App ID/slug"
        return 1
      fi
      export CADENCE_REVIEWER="$CADENCE_APP_SLUG[bot]"
      ;;
    legacy) ;;
    *) symphony_die "Invalid SYMPHONY_GITHUB_AUTH_MODE"; return 1 ;;
  esac
  export SYMPHONY_BOT_USER="${SYMPHONY_BOT_USER:-1000-symphony-bot}"
  export CADENCE_REVIEWER="${CADENCE_REVIEWER:-1000-cadence-bot}"
  export SYMPHONY_EXPECTED_GOOGLE_CLIENT_EMAIL="${SYMPHONY_EXPECTED_GOOGLE_CLIENT_EMAIL:-example-doc-reader@example-project.iam.gserviceaccount.com}"
  export SYMPHONY_EXPECTED_GITHUB_LOGIN="${SYMPHONY_BOT_USER}"
  export SYMPHONY_EXPECTED_LINEAR_EMAIL="${SYMPHONY_EXPECTED_LINEAR_EMAIL:-jjc1729@gmail.com}"

  export SYMPHONY_GIT_AUTHOR_NAME="${SYMPHONY_BOT_USER}"
  export SYMPHONY_GIT_AUTHOR_EMAIL="${SYMPHONY_GIT_AUTHOR_EMAIL:-327018241+1000-symphony-bot@users.noreply.github.com}"
}

symphony_prepare_google_credentials() {
  local temp_credentials

  mkdir -p "${SYMPHONY_RUNTIME_DIR}" || return 1
  chmod 700 "${SYMPHONY_RUNTIME_DIR}" || return 1

  export GOOGLE_APPLICATION_CREDENTIALS="${SYMPHONY_RUNTIME_DIR}/google-sa.json"
  temp_credentials="${GOOGLE_APPLICATION_CREDENTIALS}.$$"

  symphony_log "Loading Google service account JSON from ${SYMPHONY_GOOGLE_SA_SECRET_ID}"
  if ! symphony_secret_string "${SYMPHONY_GOOGLE_SA_SECRET_ID}" >"${temp_credentials}"; then
    rm -f "${temp_credentials}"
    symphony_die "Unable to load ${SYMPHONY_GOOGLE_SA_SECRET_ID}. Create/populate it in AWS Secrets Manager."
    return 1
  fi

  chmod 600 "${temp_credentials}" || {
    rm -f "${temp_credentials}"
    return 1
  }
  mv "${temp_credentials}" "${GOOGLE_APPLICATION_CREDENTIALS}" || return 1
}

symphony_verify_google_identity() {
  local client_email
  local project_id

  if ! client_email="$(symphony_json_field "${GOOGLE_APPLICATION_CREDENTIALS}" client_email)"; then
    symphony_die "Google credentials are missing client_email"
    return 1
  fi

  if ! project_id="$(symphony_json_field "${GOOGLE_APPLICATION_CREDENTIALS}" project_id)"; then
    symphony_die "Google credentials are missing project_id"
    return 1
  fi

  if [[ "${client_email}" != "${SYMPHONY_EXPECTED_GOOGLE_CLIENT_EMAIL}" ]]; then
    symphony_die "Google identity mismatch: got ${client_email}, expected ${SYMPHONY_EXPECTED_GOOGLE_CLIENT_EMAIL}"
    return 1
  fi

  SYMPHONY_GOOGLE_CLIENT_EMAIL_ACTUAL="${client_email}"
  SYMPHONY_GOOGLE_PROJECT_ID_ACTUAL="${project_id}"
  symphony_log "Google identity: ${client_email} (${project_id})"
}

symphony_verify_github_identity() {
  local login

  if [[ "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" == app ]]; then
    node "$SYMPHONY_GITHUB_APP_AUTH" preflight || return 1
    SYMPHONY_GITHUB_LOGIN_ACTUAL="$SYMPHONY_BOT_USER"
    return
  fi

  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    symphony_die "GITHUB_TOKEN is unset"
    return 1
  fi

  if ! login="$(GITHUB_TOKEN="${GITHUB_TOKEN}" gh api user --jq .login)"; then
    symphony_die "Unable to verify GitHub token with gh api user"
    return 1
  fi

  if [[ "${login}" != "${SYMPHONY_EXPECTED_GITHUB_LOGIN}" ]]; then
    symphony_die "GitHub identity mismatch: got ${login}, expected ${SYMPHONY_EXPECTED_GITHUB_LOGIN}"
    return 1
  fi

  SYMPHONY_GITHUB_LOGIN_ACTUAL="${login}"
  symphony_log "GitHub identity: ${login}"
}

symphony_github_credential_class() {
  if [[ "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" == app ]]; then printf 'github-app-installation-token'; return; fi
  case "${GITHUB_TOKEN:-}" in
    github_pat_*) printf 'fine-grained-pat' ;;
    ghp_*) printf 'classic-pat' ;;
    ghs_*) printf 'github-app-installation-token' ;;
    ghu_*) printf 'github-app-user-token' ;;
    ghr_*) printf 'github-app-refresh-token' ;;
    gho_*) printf 'oauth-token' ;;
    "") printf 'missing' ;;
    *) printf 'unknown-token-prefix' ;;
  esac
}

symphony_prepare_git_auth() {
  local askpass

  export GIT_TERMINAL_PROMPT=0
  export GCM_INTERACTIVE=never

  # SSH bypasses GITHUB_TOKEN entirely and authenticates as the operator's
  # personal key, so pushes get attributed to the operator. Drop the agent
  # socket and rewrite SSH remotes to HTTPS so all GitHub traffic uses the
  # bot token via GIT_ASKPASS.
  unset SSH_AUTH_SOCK

  askpass="${SYMPHONY_RUNTIME_DIR}/git-askpass.sh"
  mkdir -p "$SYMPHONY_RUNTIME_DIR" || return 1
  chmod 700 "$SYMPHONY_RUNTIME_DIR" || return 1
  cat >"${askpass}" <<'EOF'
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
EOF
  chmod 700 "${askpass}" || return 1
  export GIT_ASKPASS="${askpass}"

  # Fixed indices (not appended after any existing GIT_CONFIG_COUNT) so
  # re-sourcing this script does not accumulate duplicate entries.
  export GIT_CONFIG_KEY_0="credential.helper"
  export GIT_CONFIG_VALUE_0=""
  export GIT_CONFIG_KEY_1="url.https://github.com/.insteadOf"
  export GIT_CONFIG_VALUE_1="git@github.com:"
  export GIT_CONFIG_COUNT=2

  if [[ "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" == app ]]; then
    export GIT_CONFIG_KEY_2="credential.useHttpPath" GIT_CONFIG_VALUE_2=true GIT_CONFIG_COUNT=3
    export SYMPHONY_GH_BIN="${SYMPHONY_GH_BIN:-$(command -v gh)}"
    [[ "$SYMPHONY_GH_BIN" != "$SYMPHONY_RUNTIME_DIR/bin/gh" ]] || { symphony_die "Real gh binary required"; return 1; }
    mkdir -p "$SYMPHONY_RUNTIME_DIR/bin" || return 1
    cp "$(dirname "$SYMPHONY_GITHUB_APP_AUTH")/github-app-exec.sh" "$SYMPHONY_RUNTIME_DIR/bin/gh" || return 1
    chmod 700 "$SYMPHONY_RUNTIME_DIR/bin/gh" || return 1
    export PATH="$SYMPHONY_RUNTIME_DIR/bin:$PATH"
    symphony_log "GitHub transport: renewable App askpass and gh wrapper"
    return
  fi

  symphony_log "GitHub git transport: SSH agent disabled; SSH remotes rewritten to HTTPS using bot GITHUB_TOKEN through GIT_ASKPASS"
}

symphony_prepare_codex() {
  local auth_file

  # Fresh CODEX_HOME isolated from ~/.codex: Symphony's Codex runs use the
  # bot API key and have no GitHub connector plugin, so their GitHub actions
  # must go through gh/git in this shell (bot token) instead of the
  # operator's personal ChatGPT OAuth grant.
  export CODEX_HOME="${SYMPHONY_RUNTIME_DIR}/codex-home"
  mkdir -p "${CODEX_HOME}" || return 1
  chmod 700 "${CODEX_HOME}" || return 1

  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    symphony_die "OPENAI_API_KEY is unset. Add it to ${SYMPHONY_KEYS_SECRET_ID}."
    return 1
  fi

  if ! curl -fsS -o /dev/null \
    -H "Authorization: Bearer ${OPENAI_API_KEY}" \
    https://api.openai.com/v1/models; then
    symphony_die "OPENAI_API_KEY failed verification against api.openai.com"
    return 1
  fi

  auth_file="${CODEX_HOME}/auth.json"
  node -e '
    const fs = require("fs");
    fs.writeFileSync(process.argv[1], JSON.stringify({ OPENAI_API_KEY: process.env.OPENAI_API_KEY }) + "\n", { mode: 0o600 });
  ' "${auth_file}" || return 1

  if [[ ! -f "${CODEX_HOME}/config.toml" ]]; then
    printf 'preferred_auth_method = "apikey"\n' >"${CODEX_HOME}/config.toml"
  fi

  symphony_log "Codex: CODEX_HOME=${CODEX_HOME} (Symphony OPENAI_API_KEY, no GitHub connector plugin)"
}

symphony_verify_linear_identity() {
  local response
  local viewer
  local email

  if [[ -z "${LINEAR_API_TOKEN:-}" ]]; then
    symphony_die "LINEAR_API_TOKEN is unset"
    return 1
  fi

  if ! response="$(
    curl -fsS \
      -H "content-type: application/json" \
      -H "authorization: ${LINEAR_API_TOKEN}" \
      --data '{"query":"query SymphonyViewer { viewer { id name email } }"}' \
      https://api.linear.app/graphql
  )"; then
    symphony_die "Unable to verify Linear token with viewer query"
    return 1
  fi

  if ! viewer="$(
    RESPONSE="${response}" node -e '
      const payload = JSON.parse(process.env.RESPONSE);
      if (payload.errors?.length) {
        console.error(payload.errors.map((e) => e.message).join("; "));
        process.exit(1);
      }
      const viewer = payload.data?.viewer;
      if (!viewer?.id) process.exit(1);
      process.stdout.write(JSON.stringify(viewer));
    '
  )"; then
    symphony_die "Linear viewer response did not contain a viewer"
    return 1
  fi

  email="$(
    VIEWER="${viewer}" node -e '
      const viewer = JSON.parse(process.env.VIEWER);
      process.stdout.write(viewer.email || "");
    '
  )"

  if [[ "${email}" != "${SYMPHONY_EXPECTED_LINEAR_EMAIL}" ]]; then
    symphony_die "Linear identity mismatch: got ${email:-<no email>}, expected ${SYMPHONY_EXPECTED_LINEAR_EMAIL}"
    return 1
  fi

  SYMPHONY_LINEAR_VIEWER_ACTUAL="${viewer}"
  SYMPHONY_LINEAR_VIEWER_EMAIL_ACTUAL="${email}"
  symphony_log "Linear identity: ${viewer}"
}

symphony_verify_git_identity() {
  if [[ -z "${GIT_ASKPASS:-}" ]]; then
    symphony_die "GIT_ASKPASS is unset"
    return 1
  fi

  if [[ ! -x "${GIT_ASKPASS}" ]]; then
    symphony_die "GIT_ASKPASS is not executable: ${GIT_ASKPASS}"
    return 1
  fi

  if [[ -n "${SSH_AUTH_SOCK:-}" ]]; then
    symphony_die "SSH_AUTH_SOCK is set; unset it so GitHub git transport cannot use an SSH agent"
    return 1
  fi

  if [[ "${GIT_AUTHOR_NAME:-}" != "${SYMPHONY_GIT_AUTHOR_NAME}" ]]; then
    symphony_die "Git author name mismatch: got ${GIT_AUTHOR_NAME:-<unset>}, expected ${SYMPHONY_GIT_AUTHOR_NAME}"
    return 1
  fi

  if [[ "${GIT_AUTHOR_EMAIL:-}" != "${SYMPHONY_GIT_AUTHOR_EMAIL}" ]]; then
    symphony_die "Git author email mismatch: got ${GIT_AUTHOR_EMAIL:-<unset>}, expected ${SYMPHONY_GIT_AUTHOR_EMAIL}"
    return 1
  fi

  if [[ "${GIT_COMMITTER_NAME:-}" != "${SYMPHONY_GIT_AUTHOR_NAME}" ]]; then
    symphony_die "Git committer name mismatch: got ${GIT_COMMITTER_NAME:-<unset>}, expected ${SYMPHONY_GIT_AUTHOR_NAME}"
    return 1
  fi

  if [[ "${GIT_COMMITTER_EMAIL:-}" != "${SYMPHONY_GIT_AUTHOR_EMAIL}" ]]; then
    symphony_die "Git committer email mismatch: got ${GIT_COMMITTER_EMAIL:-<unset>}, expected ${SYMPHONY_GIT_AUTHOR_EMAIL}"
    return 1
  fi

  symphony_log "Git author env: ${GIT_AUTHOR_NAME} <${GIT_AUTHOR_EMAIL}>"
  symphony_log "GitHub git transport: GIT_ASKPASS executable; SSH agent disabled"
}

symphony_verify_codex_identity() {
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    symphony_die "OPENAI_API_KEY is unset"
    return 1
  fi

  if [[ -z "${CODEX_HOME:-}" ]]; then
    symphony_die "CODEX_HOME is unset"
    return 1
  fi

  if [[ ! -d "${CODEX_HOME}" ]]; then
    symphony_die "CODEX_HOME does not exist: ${CODEX_HOME}"
    return 1
  fi

  symphony_log "Codex credential source: OPENAI_API_KEY in isolated CODEX_HOME ${CODEX_HOME}"
}

symphony_identity_record() {
  printf '%s=%s\n' "$1" "$(symphony_redact "$2")"
}

symphony_identity_preflight() {
  symphony_set_identity_defaults || return 1

  symphony_require_command curl || return 1
  symphony_require_command gh || return 1
  symphony_require_command node || return 1

  symphony_verify_github_identity || return 1
  symphony_verify_linear_identity || return 1
  symphony_verify_git_identity || return 1
  symphony_verify_codex_identity || return 1

  symphony_identity_record "github.actor" "${SYMPHONY_GITHUB_LOGIN_ACTUAL}"
  if [[ "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" == app ]]; then
    symphony_identity_record "github.credential_source" "renewable-app-broker"
  else
    symphony_identity_record "github.credential_source" "env:GITHUB_TOKEN"
  fi
  symphony_identity_record "github.credential_class" "$(symphony_github_credential_class)"
  symphony_identity_record "linear.viewer_email" "${SYMPHONY_LINEAR_VIEWER_EMAIL_ACTUAL}"
  symphony_identity_record "linear.credential_source" "env:LINEAR_API_TOKEN"
  symphony_identity_record "git.author" "${GIT_AUTHOR_NAME} <${GIT_AUTHOR_EMAIL}>"
  symphony_identity_record "git.committer" "${GIT_COMMITTER_NAME} <${GIT_COMMITTER_EMAIL}>"
  symphony_identity_record "git.askpass" "executable"
  symphony_identity_record "git.ssh_auth_sock" "unset"
  symphony_identity_record "git.credential_source" "env:GIT_AUTHOR_*/GIT_COMMITTER_* plus env:GIT_ASKPASS"
  symphony_identity_record "codex.credential_source" "env:OPENAI_API_KEY plus CODEX_HOME"
}

symphony_setup_main() {
  symphony_require_command aws || return 1
  symphony_require_command curl || return 1
  symphony_require_command gh || return 1
  symphony_require_command node || return 1

  export AWS_PROFILE="1000lines"
  export AWS_REGION="us-west-2"
  export AWS_DEFAULT_REGION="us-west-2"

  export SYMPHONY_GOOGLE_SA_SECRET_ID="symphony-google-service-account-json"
  export SYMPHONY_KEYS_SECRET_ID="symphony/keys"
  export SYMPHONY_RUNTIME_DIR="${SYMPHONY_RUNTIME_DIR:-/tmp/symphony}"

  # Retain legacy precedence: defaults first, then secret-map overrides.
  local initial_author_email="${SYMPHONY_GIT_AUTHOR_EMAIL:-}"
  if [[ "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" == legacy ]]; then
    symphony_set_identity_defaults || return 1
    export GIT_AUTHOR_NAME="${SYMPHONY_GIT_AUTHOR_NAME}" GIT_AUTHOR_EMAIL="${SYMPHONY_GIT_AUTHOR_EMAIL}"
    export GIT_COMMITTER_NAME="${SYMPHONY_GIT_AUTHOR_NAME}" GIT_COMMITTER_EMAIL="${SYMPHONY_GIT_AUTHOR_EMAIL}"
  fi

  if ! aws sts get-caller-identity \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}" \
    --query '{Account:Account,Arn:Arn}' \
    --output json >/dev/null; then
    symphony_die "AWS profile ${AWS_PROFILE} is not authenticated"
    return 1
  fi

  unset GH_TOKEN LINEAR_API_KEY
  symphony_load_secret_env_map "${SYMPHONY_KEYS_SECRET_ID}" || return 1
  if [[ "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" == app ]]; then
    # A mode selected by the secret map must not inherit a legacy email default.
    if [[ -z "$initial_author_email" && "${SYMPHONY_GIT_AUTHOR_EMAIL:-}" == 327018241+1000-symphony-bot@users.noreply.github.com ]]; then
      unset SYMPHONY_GIT_AUTHOR_EMAIL
    fi
    unset GITHUB_TOKEN GH_TOKEN SYMPHONY_GITHUB_TOKEN
    mkdir -p "$SYMPHONY_RUNTIME_DIR" || return 1
    chmod 700 "$SYMPHONY_RUNTIME_DIR" || return 1
    export SYMPHONY_GITHUB_APP_CONFIG="$SYMPHONY_RUNTIME_DIR/github-app.json"
    export SYMPHONY_GITHUB_APP_CACHE="$SYMPHONY_RUNTIME_DIR/github-app-cache"
    local app_tmp
    app_tmp="$(mktemp "$SYMPHONY_RUNTIME_DIR/app.XXXXXX")" || return 1
    if ! symphony_secret_string "${SYMPHONY_GITHUB_APP_SECRET_ID:-symphony/github-apps/symphony}" >"$app_tmp"; then
      rm -f "$app_tmp"
      symphony_die "Unable to load App signing configuration"
      return 1
    fi
    mv "$app_tmp" "$SYMPHONY_GITHUB_APP_CONFIG" || return 1
    symphony_set_identity_defaults || return 1
    export GIT_AUTHOR_NAME="${SYMPHONY_GIT_AUTHOR_NAME}" GIT_AUTHOR_EMAIL="${SYMPHONY_GIT_AUTHOR_EMAIL}"
    export GIT_COMMITTER_NAME="${SYMPHONY_GIT_AUTHOR_NAME}" GIT_COMMITTER_EMAIL="${SYMPHONY_GIT_AUTHOR_EMAIL}"
  fi
  case "${SYMPHONY_GITHUB_AUTH_MODE:-legacy}" in app|legacy) ;; *) symphony_die "Invalid SYMPHONY_GITHUB_AUTH_MODE"; return 1 ;; esac
  symphony_verify_github_identity || return 1
  symphony_prepare_git_auth || return 1

  symphony_verify_linear_identity || return 1

  symphony_prepare_codex || return 1

  symphony_log "Git author env: ${GIT_AUTHOR_NAME} <${GIT_AUTHOR_EMAIL}>"

  symphony_log "Environment ready. Start Symphony from this shell."
}

if [[ "${1:-}" == "--identity-preflight" ]]; then
  shift
  symphony_identity_preflight "$@"
  __symphony_setup_rc=$?
else
  symphony_setup_main "$@"
  __symphony_setup_rc=$?
fi

__symphony_setup_return_rc="${__symphony_setup_rc}"
unset __symphony_setup_rc
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  exit "${__symphony_setup_return_rc}"
fi
return "${__symphony_setup_return_rc}"
