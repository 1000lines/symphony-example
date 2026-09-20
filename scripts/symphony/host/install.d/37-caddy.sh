#!/usr/bin/env bash
# Public HTTPS endpoint for the disposable direct-host deployment.
set -euo pipefail

SYMPHONY_STEP_NAME="37-caddy"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

caddy_version="2.11.4"
caddy_archive_sha256="527fbf917c39189a1e3b31d34fa955601680b2d5c8055d2a87b8b9588dec7bb9"
caddy_binary="${SYMPHONY_CADDY_BIN:-/usr/local/bin/caddy}"
caddy_config_dir="${SYMPHONY_CADDY_CONFIG_DIR:-/etc/caddy}"
caddy_config="$caddy_config_dir/Caddyfile"
caddy_data_dir="${SYMPHONY_CADDY_DATA_DIR:-$workspace_root/caddy}"
caddy_unit="$systemd_dir/caddy.service"

install_caddy() {
  local archive_url archive_dir archive binary

  if [[ -x "$caddy_binary" ]] && [[ "$("$caddy_binary" version)" == "v$caddy_version"* ]]; then
    return
  fi

  archive_url="https://github.com/caddyserver/caddy/releases/download/v${caddy_version}/caddy_${caddy_version}_linux_amd64.tar.gz"
  archive_dir="$(mktemp -d)"
  archive="$archive_dir/caddy.tar.gz"
  binary="$archive_dir/caddy"
  trap 'rm -rf "$archive_dir"' RETURN

  curl -fsSL -o "$archive" "$archive_url"
  [[ "$(sha256_file "$archive")" == "$caddy_archive_sha256" ]] || die "Caddy archive checksum mismatch"
  tar -xzf "$archive" -C "$archive_dir" caddy
  install -D -m 0755 "$binary" "$caddy_binary"
}

public_hostname() {
  local hostname

  hostname="$(resolve_tag_setting "${SYMPHONY_PUBLIC_HOSTNAME:-}" "symphony:public-hostname")"
  [[ "$hostname" =~ ^[A-Za-z0-9.-]+$ && "$hostname" == *.* ]] ||
    die "invalid symphony:public-hostname tag: $hostname"
  printf '%s\n' "$hostname"
}

write_caddy_config() {
  local hostname="$1"
  local tmp

  install_dir 0755 "$caddy_config_dir"
  install_dir 0700 "$caddy_data_dir"
  tmp="$(mktemp "$caddy_config_dir/Caddyfile.XXXXXX")"
  cat >"$tmp" <<EOF
{
  auto_https disable_redirects
}

$hostname {
  tls {
    issuer acme {
      disable_http_challenge
    }
  }

  @safe method GET HEAD
  handle @safe {
    reverse_proxy 127.0.0.1:$service_port
  }

  respond "Method Not Allowed" 405
}
EOF
  install -m 0644 "$tmp" "$caddy_config"
  rm -f "$tmp"
}

write_caddy_unit() {
  local tmp

  tmp="$(mktemp "$systemd_dir/caddy.service.XXXXXX")"
  cat >"$tmp" <<EOF
[Unit]
Description=Caddy HTTPS reverse proxy for Symphony
After=network-online.target
Wants=network-online.target
RequiresMountsFor=$caddy_data_dir

[Service]
Type=notify
Environment=XDG_DATA_HOME=$caddy_data_dir/data
Environment=XDG_CONFIG_HOME=$caddy_data_dir/config
ExecStart=$caddy_binary run --environ --config $caddy_config
ExecReload=$caddy_binary reload --config $caddy_config
TimeoutStopSec=5s
Restart=on-failure
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF
  install -m 0644 "$tmp" "$caddy_unit"
  rm -f "$tmp"
}

main() {
  local hostname

  require_root
  if [[ "${SYMPHONY_SKIP_CADDY:-0}" == "1" ]]; then
    log "skipping Caddy setup"
    return
  fi
  install_caddy
  hostname="$(public_hostname)"
  write_caddy_config "$hostname"
  "$caddy_binary" validate --config "$caddy_config" --adapter caddyfile
  write_caddy_unit
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
