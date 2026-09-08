#!/usr/bin/env bash
# Put the example-repo checkout on symphony:bootstrap-ref.
#
# bootstrap.sh only guarantees that a clone exists; landing it on the requested
# ref happens here, so the never-clobber policy has exactly one implementation
# (lib.sh) serving both checkouts.
#
# Because the runner was launched from this checkout, moving it changes the code
# that is mid-flight. If HEAD actually moves, the runner re-execs so every later
# step — and the step list itself — comes from the version we just installed.
set -euo pipefail

SYMPHONY_STEP_NAME="05-source"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

main() {
  require_root

  local ref
  local before=""
  local after

  ref="$(resolve_bootstrap_ref)"

  if [[ -d "$bootstrap_source_checkout/.git" ]]; then
    before="$(checkout_head "$bootstrap_source_checkout")"
  else
    clone_if_absent "$bootstrap_source_checkout" "$bootstrap_repo"
  fi

  sync_checkout "$bootstrap_source_checkout" "$ref" SYMPHONY_BOOTSTRAP
  after="$(checkout_head "$bootstrap_source_checkout")"

  [[ "$before" == "$after" ]] && return 0

  # Steps are subprocesses, so this cannot re-exec the runner itself; it leaves
  # a request and the runner acts on it. Ignored when the runner has already
  # restarted once, so a HEAD that somehow keeps moving cannot loop.
  [[ "${SYMPHONY_SOURCE_REEXEC:-0}" == "1" ]] && return 0

  log "source moved ${before:-<new clone>} -> $after; runner will restart on the new code"
  install_dir 0700 "$state_dir"
  : >"$state_dir/reexec-requested"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
