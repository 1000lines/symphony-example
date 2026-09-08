#!/usr/bin/env bash
# Mount (or initialize) the encrypted workspace EBS volume at the workspace root.
#
# Runs before any step writes under the workspace root. The actual discovery,
# format and fstab work lives in the Terraform module's init-workspace-volume.sh,
# which is shared with the walking-skeleton tests; this step only decides the
# reported workspace state and invokes it.
set -euo pipefail

SYMPHONY_STEP_NAME="30-workspace-volume"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

# Reads one KEY="value" out of an lsblk --pairs record. Matches the quoted value
# directly rather than splitting the record on spaces, because field values may
# themselves contain spaces — a mountpoint like "/mnt/my disk" would otherwise
# split into fragments and the device could be misread as blank and formatted.
#
# The leading space is what keeps NAME from also matching inside PKNAME, and
# avoids \b, which BSD sed does not support.
lsblk_field_value() {
  local record="$1"
  local field="$2"

  printf ' %s\n' "$record" | sed -n "s/.* ${field}=\"\\([^\"]*\\)\".*/\\1/p"
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

  # ${arr[@]+...} guards the empty-array case, which is unbound under set -u.
  for candidate in ${candidates[@]+"${candidates[@]}"}; do
    has_mounted_child=0
    for parent in ${mounted_parents[@]+"${mounted_parents[@]}"}; do
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
  printf 'symphony-install[%s]: %s\n' "$SYMPHONY_STEP_NAME" "$*" >&2
}

workspace_state_once() {
  local device="$1"
  local label="$2"

  if [[ "${SYMPHONY_WORKSPACE_SKIP_MOUNT:-0}" == "1" ]]; then
    printf 'skip-mount\n'
    return
  fi

  if command -v mountpoint >/dev/null 2>&1 && mountpoint -q "$workspace_root"; then
    printf 'reused\n'
    return
  fi

  if command -v findfs >/dev/null 2>&1 && findfs "LABEL=$label" >/dev/null 2>&1; then
    printf 'reused\n'
    return
  fi

  if [[ -n "$device" && -e "$device" ]]; then
    if command -v blkid >/dev/null 2>&1 && blkid "$device" >/dev/null 2>&1; then
      printf 'reused\n'
      return
    fi

    printf 'empty-volume\n'
    return
  fi

  if [[ -n "$device" ]]; then
    return 1
  fi

  if discover_blank_workspace_device >/dev/null; then
    printf 'empty-volume\n'
    return
  fi

  return 1
}

determine_workspace_state() {
  local device="${SYMPHONY_WORKSPACE_DEVICE:-}"
  local label="${SYMPHONY_WORKSPACE_LABEL:-SYMPHONYWS}"
  local timeout
  local interval
  local elapsed=0
  local sleep_for
  local state

  timeout="$(workspace_wait_timeout_seconds)"
  interval="$(workspace_wait_interval_seconds)"

  while true; do
    if state="$(workspace_state_once "$device" "$label")"; then
      printf '%s\n' "$state"
      return
    fi

    if ((elapsed >= timeout)); then
      if [[ -n "$device" ]]; then
        die "workspace device $device was not found after waiting ${timeout}s"
      fi

      die "workspace device not supplied and LABEL=$label was not found after waiting ${timeout}s"
    fi

    sleep_for="$interval"
    if ((elapsed + sleep_for > timeout)); then
      sleep_for=$((timeout - elapsed))
    fi

    log_workspace_wait "waiting for workspace device (LABEL=$label${device:+, device=$device}); ${elapsed}s elapsed, ${timeout}s timeout"
    sleep "$sleep_for"
    elapsed=$((elapsed + sleep_for))
  done
}

initialize_workspace() {
  local workspace_state
  local workspace_env=(
    "SYMPHONY_WORKSPACE_ROOT=$workspace_root"
    "SYMPHONY_WORKSPACE_LOG_LINK=$logs_root"
    "SYMPHONY_WORKSPACE_USER=$runtime_user"
    "SYMPHONY_WORKSPACE_GROUP=$runtime_group"
  )

  if [[ -n "${SYMPHONY_WORKSPACE_DEVICE:-}" ]]; then
    workspace_env+=("SYMPHONY_WORKSPACE_DEVICE=$SYMPHONY_WORKSPACE_DEVICE")
  fi

  workspace_state="$(determine_workspace_state)"

  env "${workspace_env[@]}" "$init_workspace_script"

  state_set SYMPHONY_WORKSPACE_STATE "$workspace_state"
  log "workspace $workspace_state at $workspace_root"
}

main() {
  require_root
  initialize_workspace
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
