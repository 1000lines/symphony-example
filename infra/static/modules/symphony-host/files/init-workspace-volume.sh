#!/usr/bin/env bash
set -euo pipefail

workspace_root="${SYMPHONY_WORKSPACE_ROOT:-/var/lib/symphony}"
workspace_device="${SYMPHONY_WORKSPACE_DEVICE:-}"
workspace_label="${SYMPHONY_WORKSPACE_LABEL:-SYMPHONYWS}"
workspace_fstype="${SYMPHONY_WORKSPACE_FSTYPE:-xfs}"
workspace_user="${SYMPHONY_WORKSPACE_USER:-symphony}"
workspace_group="${SYMPHONY_WORKSPACE_GROUP:-symphony}"
workspace_dir_mode="${SYMPHONY_WORKSPACE_DIR_MODE:-0750}"
workspace_log_link="${SYMPHONY_WORKSPACE_LOG_LINK:-/var/log/symphony}"
fstab_path="${SYMPHONY_FSTAB_PATH:-/etc/fstab}"
skip_mount="${SYMPHONY_WORKSPACE_SKIP_MOUNT:-0}"
manage_fstab="${SYMPHONY_WORKSPACE_MANAGE_FSTAB:-1}"

required_dirs=(workspaces sessions artifacts cache logs)

log() {
  printf '%s\n' "$*"
}

die() {
  printf 'init-workspace-volume: %s\n' "$*" >&2
  exit 1
}

lsblk_field_value() {
  local record="$1"
  local field="$2"

  printf '%s\n' "$record" | tr ' ' '\n' | sed -n "s/^${field}=\"\\([^\"]*\\)\"$/\\1/p"
}

discover_blank_workspace_device() {
  command -v lsblk >/dev/null 2>&1 || return 1

  local record
  local name
  local pkname
  local type
  local fstype
  local mountpoint
  local candidate
  local parent
  local has_mounted_child
  local candidates=()
  local filtered=()
  local mounted_parents=()

  while IFS= read -r record; do
    name="$(lsblk_field_value "$record" NAME)"
    pkname="$(lsblk_field_value "$record" PKNAME)"
    type="$(lsblk_field_value "$record" TYPE)"
    fstype="$(lsblk_field_value "$record" FSTYPE)"
    mountpoint="$(lsblk_field_value "$record" MOUNTPOINT)"

    [[ -n "$name" && -n "$type" ]] || continue

    if [[ -n "$pkname" && -n "$mountpoint" ]]; then
      mounted_parents+=("$pkname")
    fi

    if [[ "$type" == "disk" && -z "$fstype" && -z "$mountpoint" ]]; then
      candidates+=("$name")
    fi
  done < <(lsblk -pn -o NAME,PKNAME,TYPE,FSTYPE,MOUNTPOINT --pairs)

  for candidate in "${candidates[@]}"; do
    has_mounted_child=0
    for parent in "${mounted_parents[@]}"; do
      if [[ "$candidate" == "$parent" ]]; then
        has_mounted_child=1
        break
      fi
    done

    if [[ "$has_mounted_child" == "0" ]]; then
      filtered+=("$candidate")
    fi
  done

  if [[ "${#filtered[@]}" == "1" ]]; then
    printf '%s\n' "${filtered[0]}"
    return 0
  fi

  if [[ "${#filtered[@]}" -gt 1 ]]; then
    die "multiple blank workspace device candidates; set SYMPHONY_WORKSPACE_DEVICE"
  fi

  return 1
}

workspace_wait_timeout_seconds() {
  local value="${SYMPHONY_WORKSPACE_DEVICE_WAIT_TIMEOUT_SECONDS:-180}"
  [[ "$value" =~ ^[0-9]+$ ]] ||
    die "SYMPHONY_WORKSPACE_DEVICE_WAIT_TIMEOUT_SECONDS must be a non-negative integer"
  printf '%s\n' "$value"
}

workspace_wait_interval_seconds() {
  local value="${SYMPHONY_WORKSPACE_DEVICE_WAIT_INTERVAL_SECONDS:-5}"
  [[ "$value" =~ ^[1-9][0-9]*$ ]] ||
    die "SYMPHONY_WORKSPACE_DEVICE_WAIT_INTERVAL_SECONDS must be a positive integer"
  printf '%s\n' "$value"
}

log_workspace_wait() {
  printf 'init-workspace-volume: %s\n' "$*" >&2
}

find_workspace_device_once() {
  local labelled_device

  if [[ -n "$workspace_device" ]]; then
    if [[ -e "$workspace_device" ]]; then
      printf '%s\n' "$workspace_device"
      return
    fi

    return 1
  fi

  if command -v findfs >/dev/null 2>&1 && labelled_device="$(findfs "LABEL=$workspace_label" 2>/dev/null)"; then
    printf '%s\n' "$labelled_device"
    return
  fi

  if [[ -e "/dev/disk/by-label/$workspace_label" ]]; then
    readlink -f "/dev/disk/by-label/$workspace_label"
    return
  fi

  if workspace_device="$(discover_blank_workspace_device)"; then
    printf '%s\n' "$workspace_device"
    return
  fi

  return 1
}

find_workspace_device() {
  local timeout
  local interval
  local elapsed=0
  local sleep_for
  local device

  timeout="$(workspace_wait_timeout_seconds)"
  interval="$(workspace_wait_interval_seconds)"

  while true; do
    if device="$(find_workspace_device_once)"; then
      printf '%s\n' "$device"
      return
    fi

    if ((elapsed >= timeout)); then
      if [[ -n "$workspace_device" ]]; then
        die "workspace device $workspace_device was not found after waiting ${timeout}s"
      fi

      die "workspace device not supplied and LABEL=$workspace_label was not found after waiting ${timeout}s"
    fi

    sleep_for="$interval"
    if ((elapsed + sleep_for > timeout)); then
      sleep_for=$((timeout - elapsed))
    fi

    log_workspace_wait "waiting for workspace device (LABEL=$workspace_label${workspace_device:+, device=$workspace_device}); ${elapsed}s elapsed, ${timeout}s timeout"
    sleep "$sleep_for"
    elapsed=$((elapsed + sleep_for))
  done
}

device_has_filesystem() {
  local device="$1"

  blkid "$device" >/dev/null 2>&1
}

fstab_mount_source() {
  local device="$1"
  local formatted="$2"
  local label

  if [[ "$formatted" == "1" ]]; then
    printf 'LABEL=%s\n' "$workspace_label"
    return
  fi

  label="$(blkid -s LABEL -o value "$device" 2>/dev/null || true)"

  if [[ "$label" == "$workspace_label" ]]; then
    printf 'LABEL=%s\n' "$workspace_label"
    return
  fi

  if [[ -n "$workspace_device" ]]; then
    printf '%s\n' "$workspace_device"
    return
  fi

  printf 'LABEL=%s\n' "$workspace_label"
}

format_blank_device() {
  local device="$1"

  case "$workspace_fstype" in
    xfs)
      command -v mkfs.xfs >/dev/null 2>&1 || die "mkfs.xfs is required to format a blank workspace volume"
      mkfs.xfs -f -L "$workspace_label" "$device"
      ;;
    ext4)
      command -v mkfs.ext4 >/dev/null 2>&1 || die "mkfs.ext4 is required to format a blank workspace volume"
      mkfs.ext4 -F -L "$workspace_label" "$device"
      ;;
    *)
      die "unsupported workspace filesystem type: $workspace_fstype"
      ;;
  esac
}

ensure_fstab_entry() {
  local mount_source="${1:-LABEL=$workspace_label}"

  if [[ "$manage_fstab" != "1" ]]; then
    return 0
  fi

  mkdir -p "$(dirname "$fstab_path")"
  touch "$fstab_path"

  if grep -Eq "[[:space:]]${workspace_root}[[:space:]]" "$fstab_path"; then
    return
  fi

  printf '%s %s %s defaults,nofail 0 2\n' "$mount_source" "$workspace_root" "$workspace_fstype" >>"$fstab_path"
}

ensure_workspace_mount() {
  install -d -m 0755 "$workspace_root"

  if [[ "$skip_mount" == "1" ]]; then
    log "Skipping workspace mount for local initialization test."
    ensure_fstab_entry
    return
  fi

  command -v mountpoint >/dev/null 2>&1 || die "mountpoint is required"
  command -v mount >/dev/null 2>&1 || die "mount is required"
  command -v blkid >/dev/null 2>&1 || die "blkid is required"

  if mountpoint -q "$workspace_root"; then
    ensure_fstab_entry
    return
  fi

  local device
  local formatted=0
  device="$(find_workspace_device)"

  if ! device_has_filesystem "$device"; then
    format_blank_device "$device"
    formatted=1
  fi

  ensure_fstab_entry "$(fstab_mount_source "$device" "$formatted")"
  mount "$device" "$workspace_root"
}

ensure_owned_directory() {
  local path="$1"

  install -d -m "$workspace_dir_mode" "$path"

  if [[ "$(id -u)" == "0" ]]; then
    chown "$workspace_user:$workspace_group" "$path"
    return
  fi

  if [[ "$(id -un)" != "$workspace_user" || "$(id -gn)" != "$workspace_group" ]]; then
    die "run as root to assign $path to $workspace_user:$workspace_group"
  fi
}

ensure_log_link() {
  local log_target="$workspace_root/logs"

  mkdir -p "$(dirname "$workspace_log_link")"

  if [[ -e "$workspace_log_link" && ! -L "$workspace_log_link" ]]; then
    die "$workspace_log_link exists and is not a symlink"
  fi

  ln -sfn "$log_target" "$workspace_log_link"
}

ensure_workspace_layout() {
  local dir

  for dir in "${required_dirs[@]}"; do
    ensure_owned_directory "$workspace_root/$dir"
  done

  ensure_log_link
}

main() {
  ensure_workspace_mount
  ensure_workspace_layout
  log "Initialized Symphony workspace cache at $workspace_root."
}

main "$@"
