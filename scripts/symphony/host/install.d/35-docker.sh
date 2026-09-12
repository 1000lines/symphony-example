#!/usr/bin/env bash
# Container toolchains for issue workspaces, backed by the workspace EBS volume.
set -euo pipefail

SYMPHONY_STEP_NAME="35-docker"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

compose_version="2.39.4"

compose_as_user() {
  local user="$1"
  shift
  if [[ "$(id -un)" == "$user" ]]; then
    docker "$@"
  else
    runuser -u "$user" -- env -u DOCKER_CONFIG docker "$@"
  fi
}

install_docker_compose() (
  local arch expected plugin_dir plugin user paths path tmp_dir
  arch="$(uname -m)"
  case "$arch" in
    x86_64) expected="7af95166a730b87e172d4fc9aefea8725d3c6c7327d59149267b452114ddb7d4" ;;
    aarch64 | arm64)
      arch=aarch64
      expected="49082844b87f03cdcd5f5bbef1ba8c9c897b7a2dfb80cea18d61ec8ca6117e0c" ;;
    *) die "unsupported Compose architecture: $arch" ;;
  esac
  plugin_dir="${SYMPHONY_DOCKER_CLI_PLUGIN_DIR:-/usr/local/lib/docker/cli-plugins}"
  plugin="$plugin_dir/docker-compose"

  # Inspect client metadata only: no daemon or credentials are needed. Include
  # shadowed candidates so adding our system plugin cannot hide operator tools.
  for user in "$(id -un)" "$runtime_user"; do
    paths="$(compose_as_user "$user" info --format \
      '{"plugins":{{json .ClientInfo.Plugins}},"errors":{{json .ClientErrors}}}' |
      jq -r 'if (.errors // [] | length) > 0 then error("plugin discovery failed")
        else (.plugins // [])[] | select(.Name == "compose") |
        .Path, .ShadowedPaths[]? end')" || die "Compose discovery failed for $user"
    while IFS= read -r path; do
      [[ -n "$path" ]] || continue
      [[ -f "$path" && -x "$path" && "$(sha256_file "$path")" == "$expected" ]] ||
        die "conflicting Compose installation: $path; reconcile it before continuing"
    done <<<"$paths"
  done

  if [[ -e "$plugin" || -L "$plugin" ]]; then
    [[ -f "$plugin" && -x "$plugin" && "$(sha256_file "$plugin")" == "$expected" ]] ||
      die "conflicting Compose installation: $plugin; reconcile it before continuing"
  else
    install_dir 0755 "$plugin_dir"
    tmp_dir="$(mktemp -d "$plugin_dir/.compose.XXXXXX")"
    trap 'rm -rf "$tmp_dir"' EXIT
    curl -fsSL -o "$tmp_dir/docker-compose" \
      "https://github.com/docker/compose/releases/download/v$compose_version/docker-compose-linux-$arch"
    [[ "$(sha256_file "$tmp_dir/docker-compose")" == "$expected" ]] ||
      die "checksum mismatch for Compose $compose_version ($arch)"
    chmod 0755 "$tmp_dir/docker-compose"
    # Publish atomically without overwriting a file created during download.
    ln -T "$tmp_dir/docker-compose" "$plugin" || die "Compose destination changed: $plugin"
  fi

  for user in "$(id -un)" "$runtime_user"; do
    [[ "$(compose_as_user "$user" compose version --short)" == "$compose_version" ]] ||
      die "Compose $compose_version is not discoverable for $user"
  done
)

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
  install_docker_compose
  configure_docker
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
