#!/usr/bin/env bash
# Activate the units.
#
# The restart is --no-block on purpose: on the boot path this step runs inside
# symphony-reconcile.service, which symphony.service is ordered after, and a
# blocking `systemctl restart` from there deadlocks on systemd's job ordering.
# Non-blocking is also correct for the on-demand SSM path, where systemd simply
# queues the restart after this unit exits.
set -euo pipefail

SYMPHONY_STEP_NAME="99-systemd"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

activate_systemd() {
  if [[ "${SYMPHONY_SKIP_SYSTEMD:-0}" == "1" ]]; then
    return
  fi

  [[ -s "$provenance_path" ]] || die "refusing to start services without provenance"

  systemctl daemon-reload
  systemctl enable symphony-reconcile.service
  systemctl enable symphony.service
  systemctl restart --no-block symphony.service
}

main() {
  require_root
  activate_systemd
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
