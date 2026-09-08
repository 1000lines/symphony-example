#!/usr/bin/env bash
# Node for example-repo workspaces and the pinned Codex CLI that Symphony launches.
set -euo pipefail

SYMPHONY_STEP_NAME="55-node-toolchain"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

codex_version="${SYMPHONY_CODEX_VERSION:-0.153.4}"

node_platform() {
  case "$(uname -m)" in
    x86_64) printf 'linux-x64\n' ;;
    aarch64 | arm64) printf 'linux-arm64\n' ;;
    *) die "unsupported Node architecture: $(uname -m)" ;;
  esac
}

node_version() {
  local version_file="$repo_root/.nvmrc"
  local version

  [[ -f "$version_file" ]] || die "missing Node version file: $version_file"
  version="$(tr -d '[:space:]' <"$version_file")"
  [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
    die "invalid Node version in $version_file: $version"

  printf '%s\n' "$version"
}

install_node() {
  local version="$1"
  local platform="$2"
  local node_dir="$tools_root/node/$version-$platform"
  local archive="node-$version-$platform.tar.xz"
  local url="https://nodejs.org/dist/$version/$archive"
  local sums_url="https://nodejs.org/dist/$version/SHASUMS256.txt"
  local tmp_dir
  local expected
  local actual

  if [[ -x "$node_dir/bin/node" && -x "$node_dir/bin/npm" ]]; then
    printf '%s\n' "$node_dir"
    return
  fi

  install_dir 0755 "$(dirname "$node_dir")"
  tmp_dir="$(mktemp -d "$state_dir/node.XXXXXX")"

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

  tar -xJf "$tmp_dir/$archive" -C "$tmp_dir"
  rm -rf "$node_dir"
  mv "$tmp_dir/node-$version-$platform" "$node_dir"
  rm -rf "$tmp_dir"

  printf '%s\n' "$node_dir"
}

package_npm_version() {
  local package_json="$repo_root/package.json"
  local package_manager

  [[ -f "$package_json" ]] || die "missing package metadata: $package_json"
  require_command jq

  package_manager="$(jq -er '.packageManager // empty' "$package_json")" ||
    die "packageManager must pin npm in $package_json"
  [[ "$package_manager" =~ ^npm@([0-9]+\.[0-9]+\.[0-9]+)$ ]] ||
    die "packageManager must pin npm in $package_json"

  printf '%s\n' "${BASH_REMATCH[1]}"
}

install_npm() {
  local node_dir="$1"
  local version="$2"
  local actual

  actual="$(PATH="$node_dir/bin:$PATH" "$node_dir/bin/npm" --version)"
  if [[ "$actual" == "$version" ]]; then
    return
  fi

  NPM_CONFIG_CACHE="${SYMPHONY_INSTALL_NPM_CACHE:-$tools_root/npm-cache}" \
    PATH="$node_dir/bin:$PATH" \
    "$node_dir/bin/npm" install -g "npm@$version" \
    >/dev/null

  actual="$(PATH="$node_dir/bin:$PATH" "$node_dir/bin/npm" --version)"
  [[ "$actual" == "$version" ]] ||
    die "npm install produced version $actual, expected $version"
}

install_codex() {
  local node_dir="$1"
  local codex_prefix="$tools_root/codex/$codex_version"

  if [[ -x "$codex_prefix/bin/codex" ]]; then
    printf '%s\n' "$codex_prefix"
    return
  fi

  install_dir 0755 "$codex_prefix"
  NPM_CONFIG_CACHE="${SYMPHONY_INSTALL_NPM_CACHE:-$tools_root/npm-cache}" \
    NPM_CONFIG_MIN_RELEASE_AGE=0 \
    PATH="$node_dir/bin:$PATH" \
    "$node_dir/bin/npm" install -g --prefix "$codex_prefix" "@openai/codex@$codex_version" \
    >/dev/null

  [[ -x "$codex_prefix/bin/codex" ]] ||
    die "Codex install did not produce $codex_prefix/bin/codex"

  printf '%s\n' "$codex_prefix"
}

configure_runtime_node_path() {
  local node_dir="$1"
  local codex_prefix="$2"
  local runtime_node_path="$codex_prefix/bin:$node_dir/bin"

  export PATH="$runtime_node_path:$PATH"
  state_set SYMPHONY_NODE_TOOL_PATH "$runtime_node_path"
  prepend_runtime_path "$runtime_node_path"
}

main() {
  require_root

  if [[ "${SYMPHONY_SKIP_NODE_TOOLCHAIN:-0}" == "1" ]]; then
    log "skipping Node/Codex toolchain install"
    return
  fi

  local version
  local platform
  local node_dir
  local npm_version
  local codex_prefix

  version="$(node_version)"
  platform="$(node_platform)"
  node_dir="$(install_node "$version" "$platform")"
  npm_version="$(package_npm_version)"
  install_npm "$node_dir" "$npm_version"
  codex_prefix="$(install_codex "$node_dir")"
  configure_runtime_node_path "$node_dir" "$codex_prefix"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
