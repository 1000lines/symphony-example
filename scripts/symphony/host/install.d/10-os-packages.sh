#!/usr/bin/env bash
# Distro packages: the base tools every later step assumes, plus the toolchain
# build dependencies the BEAM step needs when it falls back to a source build.
# All dnf traffic lives here so there is one place to look when a package breaks.
set -euo pipefail

SYMPHONY_STEP_NAME="10-os-packages"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

install_host_dependencies() {
  if [[ "${SYMPHONY_SKIP_PACKAGES:-0}" == "1" ]]; then
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    # Never name curl: AL2023 ships curl-minimal, which conflicts with it, and
    # dnf refuses the whole transaction.
    dnf install -y awscli jq git tar gzip xz shadow-utils xfsprogs docker
    return
  fi

  local command_name
  for command_name in aws jq gzip; do
    require_command "$command_name"
  done
}

install_runtime_tool_dependencies() {
  if [[ "${SYMPHONY_SKIP_PACKAGES:-0}" == "1" ]]; then
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    dnf install -y unzip gcc gcc-c++ make autoconf ncurses-devel openssl-devel
  fi
}

main() {
  require_root
  install_host_dependencies
  install_runtime_tool_dependencies
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
