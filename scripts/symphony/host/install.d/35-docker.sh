#!/usr/bin/env bash
# Container toolchains for issue workspaces, backed by the workspace EBS volume.
set -euo pipefail

SYMPHONY_STEP_NAME="35-docker"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

configure_docker() {
  local docker_config_dir="${SYMPHONY_DOCKER_CONFIG_DIR:-/etc/docker}"
  local docker_config="$docker_config_dir/daemon.json"
  local docker_data_root="$workspace_root/docker"
  local docker_unit_dir="$systemd_dir/docker.service.d"
  local docker_socket_dir="$systemd_dir/docker.socket.d"

  install_dir 0755 "$docker_config_dir"
  if [[ -f "$docker_config" ]]; then
    # Never silently relocate existing images or overwrite operator settings.
    jq -e --arg root "$docker_data_root" --arg group "$runtime_group" \
      '.["data-root"] == $root and .group == $group' "$docker_config" >/dev/null ||
      die "existing Docker configuration differs; reconcile data-root and socket group before continuing"
  else
    if [[ -d /var/lib/docker ]] && [[ -n "$(ls -A /var/lib/docker)" ]]; then
      die "existing /var/lib/docker data requires explicit migration"
    fi
    install_dir 0710 "$docker_data_root"
    jq -n --arg root "$docker_data_root" --arg group "$runtime_group" \
      '{"data-root": $root, "group": $group, "log-driver": "local"}' >"$docker_config"
    chmod 0644 "$docker_config"
  fi

  dockerd --validate --config-file "$docker_config"
  install_dir 0755 "$docker_unit_dir"
  printf '[Unit]\nRequiresMountsFor="%s"\n' "$workspace_root" >"$docker_unit_dir/workspace.conf"
  # AL2023 uses socket activation; systemd, not dockerd, owns this socket.
  install_dir 0755 "$docker_socket_dir"
  printf '[Socket]\nSocketGroup=%s\n' "$runtime_group" >"$docker_socket_dir/runtime-group.conf"
  systemctl daemon-reload
  systemctl enable --now docker.service
  # Apply the same ownership to a socket already opened during package install,
  # without restarting Docker or interrupting existing worker containers.
  if [[ -S /run/docker.sock ]]; then
    chgrp "$runtime_group" /run/docker.sock
  fi
}

main() {
  require_root
  if [[ "${SYMPHONY_SKIP_PACKAGES:-0}" == "1" ]]; then
    log "skipping Docker setup with host packages"
    return
  fi
  require_command docker
  require_command dockerd
  configure_docker
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
