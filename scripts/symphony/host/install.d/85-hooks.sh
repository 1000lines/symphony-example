#!/usr/bin/env bash
# Bootstrap extension point.
#
# Executable files in hooks.d/ run in lexicographic order after the core install
# steps and before provenance is written, so a failing hook fails bootstrap
# closed. Operator-owned hooks can add installation steps here.
set -euo pipefail

SYMPHONY_STEP_NAME="85-hooks"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

run_hooks() {
  local dir="${1:-$hooks_dir}"
  local hook

  [[ -d "$dir" ]] || return 0

  while IFS= read -r hook; do
    [[ -n "$hook" ]] || continue
    [[ -x "$hook" ]] || continue
    log "running hook $hook"
    "$hook"
  done < <(find "$dir" -maxdepth 1 -type f | LC_ALL=C sort)
}

main() {
  require_root
  run_hooks
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
