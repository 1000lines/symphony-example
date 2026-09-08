#!/usr/bin/env bash
set -euo pipefail

bootstrap_script="${SYMPHONY_BOOTSTRAP_SCRIPT:-/opt/symphony/bootstrap/bootstrap.sh}"
installer_script="${SYMPHONY_INSTALLER_SCRIPT:-/opt/symphony/src/example-repo/scripts/symphony/host/install-runtime.sh}"

die() {
  printf 'symphony-reconcile: %s\n' "$*" >&2
  exit 1
}

main() {
  case "${1:-}" in
    --runtime-bundle-refresh)
      [[ -x "$installer_script" ]] || die "installer is missing or not executable: $installer_script"
      exec "$installer_script" --runtime-bundle-refresh
      ;;
    --check-runtime-bundle-fresh)
      shift
      [[ -x "$installer_script" ]] || die "installer is missing or not executable: $installer_script"
      exec "$installer_script" --check-runtime-bundle-fresh "$@"
      ;;
  esac

  [[ -x "$bootstrap_script" ]] || die "bootstrap script is missing or not executable: $bootstrap_script"
  exec "$bootstrap_script" reconcile
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
