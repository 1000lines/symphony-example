#!/usr/bin/env bash
# Render systemd units and the runtime workflow config, and publish the
# bootstrap entrypoints that SSM and the boot-time reconcile unit invoke.
set -euo pipefail

SYMPHONY_STEP_NAME="80-config"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

render_template() {
  local template="$1"
  local output="$2"

  sed \
    -e "s|{{SYMPHONY_RUNTIME_USER}}|$(escape_sed "$runtime_user")|g" \
    -e "s|{{SYMPHONY_RUNTIME_GROUP}}|$(escape_sed "$runtime_group")|g" \
    -e "s|{{SYMPHONY_RUNTIME_BIN}}|$(escape_sed "$runtime_bin")|g" \
    -e "s|{{SYMPHONY_RUNTIME_ENV}}|$(escape_sed "$runtime_env_path")|g" \
    -e "s|{{SYMPHONY_WORKFLOW_PATH}}|$(escape_sed "$workflow_path")|g" \
    -e "s|{{SYMPHONY_WORKSPACE_ROOT}}|$(escape_sed "$workspace_root")|g" \
    -e "s|{{SYMPHONY_LOGS_ROOT}}|$(escape_sed "$logs_root")|g" \
    -e "s|{{SYMPHONY_BOOTSTRAP_BIN_DIR}}|$(escape_sed "$bootstrap_bin_dir")|g" \
    -e "s|{{SYMPHONY_CONFIG_DIR}}|$(escape_sed "$config_dir")|g" \
    -e "s|{{SYMPHONY_STATE_DIR}}|$(escape_sed "$state_dir")|g" \
    -e "s|{{SYMPHONY_SERVICE_PORT}}|$(escape_sed "$service_port")|g" \
    "$template" >"$output"
}

render_workflow_config() {
  local source="${SYMPHONY_WORKFLOW_SOURCE:-$(runtime_bundle_workflow_source)}"
  local codex_wrapper
  local tmp

  [[ -f "$source" ]] || die "workflow source is missing: $source"
  codex_wrapper="$(runtime_codex_wrapper_path)"

  tmp="$(mktemp "$state_dir/workflow.XXXXXX")"
  if ! awk -v slots="$worker_slots" -v codex_wrapper="$codex_wrapper" '
    BEGIN {
      opened = 0
      closed = 0
      in_front_matter = 0
      matches = 0
      codex_matches = 0
    }
    NR == 1 && $0 == "---" {
      opened = 1
      in_front_matter = 1
      print
      next
    }
    opened && in_front_matter && $0 == "---" {
      closed = 1
      in_front_matter = 0
      print
      next
    }
    in_front_matter && $0 ~ /^  max_concurrent_agents:[[:space:]]*[0-9]+[[:space:]]*$/ {
      matches += 1
      print "  max_concurrent_agents: " slots
      next
    }
    in_front_matter && $0 ~ /^  command:[[:space:]]+codex([[:space:]]|$)/ {
      codex_matches += 1
      sub(/^  command:[[:space:]]+codex/, "  command: " codex_wrapper)
      print
      next
    }
    { print }
    END {
      if (!opened || !closed || matches != 1 || codex_matches != 1) exit 1
    }
  ' "$source" >"$tmp"; then
    rm -f "$tmp"
    die "expected exactly one front-matter agent.max_concurrent_agents line and codex command in $source"
  fi

  install -m 0644 "$tmp" "$workflow_path"
  rm -f "$tmp"
}

render_config_files() {
  render_workflow_config
  render_template "$templates_dir/symphony.service" "$systemd_dir/symphony.service"
  render_template "$templates_dir/symphony-reconcile.service" "$systemd_dir/symphony-reconcile.service"
}

install_bootstrap_scripts() {
  install -m 0755 "$host_dir/bootstrap.sh" "$bootstrap_bin_dir/bootstrap.sh"
  install -m 0755 "$host_dir/reconcile.sh" "$bootstrap_bin_dir/reconcile.sh"
}

main() {
  require_root
  worker_slots="$(resolve_worker_slots)"
  install_bootstrap_scripts
  render_config_files
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
