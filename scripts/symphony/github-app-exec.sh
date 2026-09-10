#!/usr/bin/env bash
# Install as bin/gh to renew on every gh invocation, or call with COMMAND ARGS.
set +x
set -euo pipefail
unset GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN GITHUB_ENTERPRISE_TOKEN
unset GH_DEBUG GIT_TRACE GIT_TRACE_CURL GIT_CURL_VERBOSE SSH_AUTH_SOCK
auth="${SYMPHONY_GITHUB_APP_AUTH:-$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/github-app-auth.mjs}"
if [[ "$(basename "$0")" == gh ]]; then
  exec node "$auth" exec "${SYMPHONY_GH_BIN:?real gh binary is required}" "$@"
fi
exec node "$auth" exec "$@"
