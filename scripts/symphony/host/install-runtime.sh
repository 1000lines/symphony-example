#!/usr/bin/env bash
# Runs the install.d/ steps in order.
#
# Steps run as separate processes so one can be re-run on its own while
# debugging on the host, and so a step cannot leak shell state into the next
# one. Anything a step needs to hand downstream goes through the install-state
# file (see lib.sh).
#
#   install-runtime.sh                       run every step
#   install-runtime.sh --list                show the steps and exit
#   install-runtime.sh --runtime-bundle-refresh     sync source, refresh bundle/config/provenance
#   install-runtime.sh --check-runtime-bundle-fresh [bundle-sha]
#   install-runtime.sh --only 50-beam-toolchain
#   install-runtime.sh --from 70-symphony-escript
#   install-runtime.sh --skip 50-beam-toolchain --skip 70-symphony-escript
#
# Step names match on prefix, so `--only 50` is enough.
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

SYMPHONY_STEP_NAME="runner"

usage() {
  sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

list_steps() {
  local step

  while IFS= read -r step; do
    [[ -n "$step" ]] || continue
    printf '%s\n' "$(basename "$step" .sh)"
  done < <(find "$steps_dir" -maxdepth 1 -name '*.sh' -type f | LC_ALL=C sort)
}

step_matches() {
  local name="$1"
  shift

  local pattern
  for pattern in "$@"; do
    [[ "$name" == "$pattern"* ]] && return 0
  done

  return 1
}

main() {
  local only=()
  local skip=()
  local from=""
  local started=1
  local runtime_bundle_refresh=0
  local runtime_bundle_check=0
  local runtime_bundle_check_sha=""
  local name
  local path
  local ran=0
  # Kept verbatim so a restart after 05-source honours the same selection.
  local argv=("$@")

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --list)
        list_steps
        return 0
        ;;
      --runtime-bundle-refresh)
        runtime_bundle_refresh=1
        shift
        ;;
      --check-runtime-bundle-fresh)
        runtime_bundle_check=1
        if [[ $# -ge 2 && "$2" != --* ]]; then
          runtime_bundle_check_sha="$2"
          shift 2
        else
          shift
        fi
        ;;
      --only)
        [[ $# -ge 2 ]] || die "--only requires a step name"
        only+=("$2")
        shift 2
        ;;
      --skip)
        [[ $# -ge 2 ]] || die "--skip requires a step name"
        skip+=("$2")
        shift 2
        ;;
      --from)
        [[ $# -ge 2 ]] || die "--from requires a step name"
        from="$2"
        started=0
        shift 2
        ;;
      -h | --help)
        usage
        return 0
        ;;
      *)
        die "unknown argument: $1 (try --help)"
        ;;
    esac
  done

  if [[ "$runtime_bundle_check" == "1" ]]; then
    [[ "${#only[@]}" == "0" && "${#skip[@]}" == "0" && -z "$from" ]] ||
      die "--check-runtime-bundle-fresh cannot be combined with step selection"
    if [[ -n "$runtime_bundle_check_sha" ]]; then
      runtime_bundle_fresh_for_source "$runtime_bundle_check_sha" ||
        die "runtime bundle is stale for bundle SHA $runtime_bundle_check_sha"
    else
      runtime_bundle_fresh_for_source ||
        die "runtime bundle is stale for current bundle source"
    fi
    return 0
  fi

  if [[ "$runtime_bundle_refresh" == "1" ]]; then
    [[ "${#only[@]}" == "0" && "${#skip[@]}" == "0" && -z "$from" ]] ||
      die "--runtime-bundle-refresh cannot be combined with step selection"
    only=("05-source" "45-runtime-bundle" "80-config" "90-provenance")
  fi

  require_root
  install_dir 0700 "$state_dir"

  [[ -d "$steps_dir" ]] || die "no install.d directory at $steps_dir"

  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    name="$(basename "$path" .sh)"

    if [[ "$started" == "0" ]]; then
      step_matches "$name" "$from" || continue
      started=1
    fi

    if [[ "${#only[@]}" -gt 0 ]] && ! step_matches "$name" "${only[@]}"; then
      continue
    fi

    if [[ "${#skip[@]}" -gt 0 ]] && step_matches "$name" "${skip[@]}"; then
      log "skipping $name"
      continue
    fi

    [[ -x "$path" ]] || die "step is not executable: $path"

    log "==> $name"
    "$path"
    ran=$((ran + 1))

    # 05-source may have moved the checkout this runner is executing from. Start
    # over so the remaining steps, and the step list itself, come from the code
    # that was just installed rather than the code that was running at launch.
    if [[ -f "$state_dir/reexec-requested" ]]; then
      rm -f "$state_dir/reexec-requested"
      log "restarting on updated source"
      SYMPHONY_SOURCE_REEXEC=1 exec "${BASH_SOURCE[0]}" "${argv[@]}"
    fi
  done < <(find "$steps_dir" -maxdepth 1 -name '*.sh' -type f | LC_ALL=C sort)

  [[ "$started" == "1" ]] || die "no step matched --from $from"
  ((ran > 0)) || die "no steps selected"

  log "convergence complete ($ran steps)"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
