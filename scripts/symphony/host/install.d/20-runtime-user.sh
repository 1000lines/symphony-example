#!/usr/bin/env bash
# The unprivileged runtime identity and the root-volume directory skeleton.
#
# Creates the workspace mount point but deliberately nothing inside it: the
# workspace volume mounts over it in the next step, and anything written here
# first would be shadowed.
set -euo pipefail

SYMPHONY_STEP_NAME="20-runtime-user"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

ensure_runtime_user() {
  if [[ "${SYMPHONY_SKIP_USERADD:-0}" == "1" ]]; then
    return
  fi

  if ! getent group "$runtime_group" >/dev/null 2>&1; then
    groupadd --system "$runtime_group"
  fi

  if ! id -u "$runtime_user" >/dev/null 2>&1; then
    useradd \
      --system \
      --gid "$runtime_group" \
      --home-dir "$workspace_root" \
      --shell /sbin/nologin \
      "$runtime_user"
  fi
}

prepare_directories() {
  install_dir 0755 "$opt_root"
  install_dir 0755 "$releases_dir"
  install_dir 0755 "$bootstrap_bin_dir"
  install_dir 0755 "$src_root"
  install_dir 0755 "$tools_root"
  install_dir 0755 "$config_dir"
  install_dir 0755 "$systemd_dir"
  install_dir 0700 "$state_dir"
  install_dir 0755 "$bootstrap_log_dir"
  install_dir 0755 "$(dirname "$logs_root")"
  install_runtime_dir 0750 "$workspace_root"
}

main() {
  require_root
  ensure_runtime_user
  prepare_directories
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
