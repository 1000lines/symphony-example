#!/usr/bin/env bash
# Developer tools needed by host-run Symphony workspaces.
set -euo pipefail

SYMPHONY_STEP_NAME="60-dev-tools"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

gh_version="${SYMPHONY_GH_VERSION:-2.97.0}"
terraform_version="${SYMPHONY_TERRAFORM_VERSION:-1.4.2}"

linux_archive_arch() {
  case "$(uname -m)" in
    x86_64) printf 'amd64\n' ;;
    aarch64 | arm64) printf 'arm64\n' ;;
    *) die "unsupported Linux architecture: $(uname -m)" ;;
  esac
}

download_checksum_verified() {
  local url="$1"
  local sums_url="$2"
  local archive="$3"
  local output="$4"
  local expected
  local actual

  curl -fsSL -o "$output" "$url"
  expected="$(
    curl -fsSL "$sums_url" |
      awk -v archive="$archive" '$2 == archive { print $1 }'
  )"
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] ||
    die "missing checksum for $archive"

  actual="$(sha256_file "$output")"
  [[ "$actual" == "$expected" ]] ||
    die "checksum mismatch for $archive"
}

install_gh() {
  local arch="$1"
  local gh_dir="$tools_root/gh/$gh_version-linux-$arch"
  local archive="gh_${gh_version}_linux_${arch}.tar.gz"
  local url="https://github.com/cli/cli/releases/download/v$gh_version/$archive"
  local sums_url="https://github.com/cli/cli/releases/download/v$gh_version/gh_${gh_version}_checksums.txt"
  local tmp_dir

  if [[ -x "$gh_dir/bin/gh" ]]; then
    printf '%s\n' "$gh_dir"
    return
  fi

  install_dir 0755 "$gh_dir/bin"
  tmp_dir="$(mktemp -d "$state_dir/gh.XXXXXX")"
  download_checksum_verified "$url" "$sums_url" "$archive" "$tmp_dir/$archive"
  tar -xzf "$tmp_dir/$archive" -C "$tmp_dir"
  install -m 0755 "$tmp_dir/gh_${gh_version}_linux_${arch}/bin/gh" "$gh_dir/bin/gh"
  rm -rf "$tmp_dir"

  printf '%s\n' "$gh_dir"
}

install_terraform() {
  local arch="$1"
  local terraform_dir="$tools_root/terraform/$terraform_version-linux-$arch"
  local archive="terraform_${terraform_version}_linux_${arch}.zip"
  local url="https://releases.hashicorp.com/terraform/$terraform_version/$archive"
  local sums_url="https://releases.hashicorp.com/terraform/$terraform_version/terraform_${terraform_version}_SHA256SUMS"
  local tmp_dir

  if [[ -x "$terraform_dir/bin/terraform" ]]; then
    printf '%s\n' "$terraform_dir"
    return
  fi

  require_command unzip
  install_dir 0755 "$terraform_dir/bin"
  tmp_dir="$(mktemp -d "$state_dir/terraform.XXXXXX")"
  download_checksum_verified "$url" "$sums_url" "$archive" "$tmp_dir/$archive"
  unzip -q "$tmp_dir/$archive" -d "$tmp_dir"
  install -m 0755 "$tmp_dir/terraform" "$terraform_dir/bin/terraform"
  rm -rf "$tmp_dir"

  printf '%s\n' "$terraform_dir"
}

configure_runtime_dev_path() {
  local gh_dir="$1"
  local terraform_dir="$2"
  local runtime_dev_path="$gh_dir/bin:$terraform_dir/bin"

  export PATH="$runtime_dev_path:$PATH"
  state_set SYMPHONY_DEV_TOOL_PATH "$runtime_dev_path"
  prepend_runtime_path "$runtime_dev_path"
}

main() {
  require_root

  if [[ "${SYMPHONY_SKIP_DEV_TOOLS:-0}" == "1" ]]; then
    log "skipping developer tools install"
    return
  fi

  local arch
  local gh_dir
  local terraform_dir

  arch="$(linux_archive_arch)"
  gh_dir="$(install_gh "$arch")"
  terraform_dir="$(install_terraform "$arch")"
  configure_runtime_dev_path "$gh_dir" "$terraform_dir"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
