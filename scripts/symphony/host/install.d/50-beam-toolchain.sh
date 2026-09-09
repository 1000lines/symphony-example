#!/usr/bin/env bash
# Erlang/Elixir for building and running the Symphony escript, via mise.
#
# This is by far the slowest step — the Erlang build is compiled from source —
# so it is marker-guarded: once a given erlang/elixir pair is installed, a rerun
# only re-derives the tool path. The resulting PATH is persisted both to the
# install-state file (for later steps) and to runtime.env (for systemd).
set -euo pipefail

SYMPHONY_STEP_NAME="50-beam-toolchain"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

beam_marker="beam-$erlang_version-$elixir_version"
elixir_install_dir="${SYMPHONY_ELIXIR_INSTALL_DIR:-$tools_root/mise/installs/elixir/$elixir_version}"

install_mise() {
  if command -v mise >/dev/null 2>&1; then
    mise_bin="$(command -v mise)"
    return
  fi

  if [[ -x "$mise_bin" ]]; then
    return
  fi

  install_dir 0755 "$(dirname "$mise_bin")"
  curl -fsSL https://mise.run | MISE_INSTALL_PATH="$mise_bin" MISE_QUIET=1 sh
}

mise_runtime_env() {
  export MISE_DATA_DIR="${SYMPHONY_MISE_DATA_DIR:-$tools_root/mise}"
  export MISE_CONFIG_DIR="${SYMPHONY_MISE_CONFIG_DIR:-$tools_root/mise-config}"
  export MISE_CACHE_DIR="${SYMPHONY_MISE_CACHE_DIR:-$tools_root/mise-cache}"
  export MISE_JOBS="${SYMPHONY_MISE_JOBS:-1}"
  export MISE_ERLANG_COMPILE="${SYMPHONY_MISE_ERLANG_COMPILE:-1}"
  export KERL_CONFIGURE_OPTIONS="${KERL_CONFIGURE_OPTIONS:---without-javac --without-wx --without-debugger --without-observer --without-et --without-megaco --without-odbc}"
}

configure_runtime_tool_path() {
  local erlang_dir

  erlang_dir="$("$mise_bin" where "erlang@$erlang_version")"
  [[ -x "$elixir_install_dir/bin/mix" ]] ||
    die "Elixir install is missing mix: $elixir_install_dir"
  runtime_tool_path="$elixir_install_dir/bin:$erlang_dir/bin"
  export PATH="$runtime_tool_path:$PATH"
  state_set SYMPHONY_RUNTIME_TOOL_PATH "$runtime_tool_path"
}

install_elixir() {
  local erlang_dir="$1"
  local release_version="${elixir_version%%-otp-*}"
  local otp_version="${elixir_version##*-otp-}"
  local archive="elixir-otp-$otp_version.zip"
  local url="https://github.com/elixir-lang/elixir/releases/download/v$release_version/$archive"
  local sums_url="$url.sha256sum"
  local tmp_dir
  local expected
  local actual

  if [[ -x "$elixir_install_dir/bin/elixir" ]]; then
    PATH="$erlang_dir/bin:$PATH" "$elixir_install_dir/bin/elixir" --version >/dev/null
    return
  fi

  require_command unzip
  install_dir 0700 "$state_dir"
  install_dir 0755 "$(dirname "$elixir_install_dir")"
  tmp_dir="$(mktemp -d "$state_dir/elixir.XXXXXX")"

  curl -fsSL -o "$tmp_dir/$archive" "$url"
  expected="$(
    curl -fsSL "$sums_url" |
      awk -v archive="$archive" '$2 == archive { print $1 }'
  )"
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] ||
    die "missing checksum for $archive"

  actual="$(sha256_file "$tmp_dir/$archive")"
  [[ "$actual" == "$expected" ]] ||
    die "checksum mismatch for $archive"

  rm -rf "$elixir_install_dir"
  install_dir 0755 "$elixir_install_dir"
  unzip -q "$tmp_dir/$archive" -d "$elixir_install_dir"
  rm -rf "$tmp_dir"

  PATH="$erlang_dir/bin:$PATH" "$elixir_install_dir/bin/elixir" --version >/dev/null
}

install_beam_tools() {
  local erlang_dir
  local attempt
  local install_status

  log "installing erlang@$erlang_version and elixir@$elixir_version (this is slow)"
  # `mise exec` can warn on a failed kerl release lookup, skip installation,
  # then fail with a misleading missing-erl error. Install explicitly and give
  # transient release lookup/download failures a bounded retry.
  for attempt in 1 2 3; do
    if "$mise_bin" install --yes "erlang@$erlang_version"; then
      break
    else
      install_status=$?
    fi
    [[ "$attempt" -lt 3 ]] ||
      die "mise install --yes erlang@$erlang_version failed after $attempt attempts (exit $install_status)"
    warn "mise install --yes erlang@$erlang_version failed (attempt $attempt/3, exit $install_status); retrying in $((attempt * 5))s"
    sleep "$((attempt * 5))"
  done

  erlang_dir="$("$mise_bin" where "erlang@$erlang_version")" ||
    die "mise where erlang@$erlang_version failed after installation"
  [[ -x "$erlang_dir/bin/erl" ]] || die "Erlang install is missing erl: $erlang_dir"
  "$erlang_dir/bin/erl" -noshell -eval 'halt().' ||
    die "Erlang validation failed: $erlang_dir/bin/erl"
  export PATH="$erlang_dir/bin:$PATH"
  install_elixir "$erlang_dir"
}

# Appended rather than written: 40-credentials owns the body of runtime.env, and
# must have run first — without this PATH the service starts with no Erlang.
write_runtime_tool_path() {
  [[ -n "$runtime_tool_path" ]] || die "no toolchain path to record"
  prepend_runtime_path "$runtime_tool_path"
}

ensure_mix() {
  # cloud-init and SSM may start without HOME; kerl requires a writable one.
  export HOME="${HOME:-$state_dir/toolchain-home}"
  install_dir 0700 "$HOME"
  install_mise
  mise_runtime_env

  if ! marker_present "$beam_marker"; then
    install_beam_tools
    marker_record "$beam_marker"
  fi

  configure_runtime_tool_path
  require_command mix
}

main() {
  require_root

  if [[ "${SYMPHONY_SKIP_BEAM_TOOLCHAIN:-0}" == "1" ]]; then
    log "skipping BEAM toolchain install"
    return
  fi

  ensure_mix
  write_runtime_tool_path
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
