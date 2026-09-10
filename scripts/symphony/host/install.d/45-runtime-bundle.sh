#!/usr/bin/env bash
# Stage the repo-owned hosted runtime bundle and install it into the
# Symphony user's personal Codex home.
set -euo pipefail

SYMPHONY_STEP_NAME="45-runtime-bundle"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

runtime_bundle_manifest_source() {
  printf '%s\n' "$runtime_bundle_source_dir/manifest.json"
}

require_runtime_bundle_source() {
  local manifest
  manifest="$(runtime_bundle_manifest_source)"

  [[ -d "$runtime_bundle_source_dir" ]] ||
    die "runtime bundle source is missing: $runtime_bundle_source_dir"
  [[ -f "$manifest" ]] ||
    die "runtime bundle manifest is missing: $manifest"
  jq -er '.schemaVersion == "symphony-runtime-bundle/v1"' "$manifest" >/dev/null ||
    die "unsupported runtime bundle manifest schema"
  [[ -f "$runtime_bundle_source_dir/codex/AGENTS.md" ]] ||
    die "runtime bundle AGENTS.md is missing"
  [[ -f "$runtime_bundle_source_dir/codex/config.toml.template" ]] ||
    die "runtime bundle Codex config template is missing"
  [[ -f "$runtime_bundle_source_dir/workflow/WORKFLOW.md" ]] ||
    die "runtime bundle workflow source is missing"
}

normalize_root_group_tree() {
  local root="$1"

  find "$root" -type d -exec chmod 0755 {} +
  find "$root" -type f -exec chmod 0644 {} +

  if [[ -d "$root/bin" ]]; then
    find "$root/bin" -type f -exec chmod 0755 {} +
  fi

  if [[ -d "$root/skills" ]]; then
    find "$root/skills" -path '*/bin/*' -type f -exec chmod 0755 {} +
  fi

  if is_root; then
    chown -R "root:$runtime_group" "$root"
  fi
}

copy_dir_contents() {
  local source="$1"
  local dest="$2"

  install_dir 0755 "$dest"
  cp -a "$source/." "$dest/"
}

stage_shared_skill_copies() {
  local stage_dir="$1"
  local manifest="$2"
  local shared_root="$stage_dir/shared-skills"
  local name
  local source_path
  local source_dir
  local dest

  while IFS=$'\t' read -r name source_path; do
    [[ -n "$name" && -n "$source_path" ]] || continue
    [[ "$name" != */* ]] || die "invalid shared skill name in manifest: $name"

    if [[ "$source_path" == /* ]]; then
      source_dir="$source_path"
    else
      source_dir="$repo_root/$source_path"
    fi

    [[ -d "$source_dir" ]] ||
      die "shared skill source is missing: $source_dir"

    dest="$shared_root/$name"
    install_dir 0755 "$dest"
    cp -a "$source_dir/." "$dest/"
  done < <(jq -r '.installedSharedSkillLinks[]? | [.name, .canonicalSourcePath] | @tsv' "$manifest")
}

stage_runtime_bundle_release_unlocked() {
  local repo_sha
  local release_dir
  local stage_dir=""
  local manifest

  require_runtime_bundle_source

  repo_sha="$(runtime_bundle_repo_sha)"
  release_dir="$runtime_bundle_releases_dir/$repo_sha"
  manifest="$(runtime_bundle_manifest_source)"

  install_root_group_dir 0755 "$runtime_bundle_cache_dir"
  install_root_group_dir 0755 "$runtime_bundle_releases_dir"

  if [[ ! -d "$release_dir" ]]; then
    stage_dir="$(mktemp -d "$runtime_bundle_releases_dir/.tmp-$repo_sha.XXXXXX")"
    copy_dir_contents "$runtime_bundle_source_dir" "$stage_dir"
    stage_shared_skill_copies "$stage_dir" "$manifest"
    normalize_root_group_tree "$stage_dir"
    mv "$stage_dir" "$release_dir"
    stage_dir=""
  fi

  publish_runtime_bundle_current "$release_dir"
  log "runtime bundle active at $release_dir"
}

publish_runtime_bundle_current() {
  local release_dir="$1"
  local tmp_link="$runtime_bundle_cache_dir/.current.$$"

  [[ -d "$release_dir" ]] || die "runtime bundle release is missing: $release_dir"
  rm -f "$tmp_link"
  ln -s "$release_dir" "$tmp_link"
  mv -Tf "$tmp_link" "$runtime_bundle_current_link"

  [[ "$(readlink "$runtime_bundle_current_link")" == "$release_dir" ]] ||
    die "runtime bundle current symlink did not update"
}

install_personal_file() {
  local mode="$1"
  local source="$2"
  local dest="$3"

  install -m "$mode" "$source" "$dest"

  if is_root; then
    chown "$runtime_user:$runtime_group" "$dest"
  fi
}

link_skill_dir() {
  local stage_skills_dir="$1"
  local name="$2"
  local target="$3"
  local link="$stage_skills_dir/$name"

  [[ -d "$target" ]] || die "skill link target is missing: $target"
  ln -s "$target" "$link"

  if is_root; then
    chown -h "$runtime_user:$runtime_group" "$link"
  fi
}

install_bundle_skill_links() {
  local stage_dir="$1"
  local stage_skills_dir="$stage_dir/skills"
  local skill_dir
  local name

  install_runtime_dir 0755 "$stage_skills_dir"

  if [[ -d "$runtime_bundle_current_link/skills" ]]; then
    while IFS= read -r -d '' skill_dir; do
      name="$(basename "$skill_dir")"
      link_skill_dir "$stage_skills_dir" "$name" "$runtime_bundle_current_link/skills/$name"
    done < <(find "$runtime_bundle_current_link/skills" -mindepth 1 -maxdepth 1 -type d -print0 | LC_ALL=C sort -z)
  fi

  if [[ -d "$runtime_bundle_current_link/shared-skills" ]]; then
    while IFS= read -r -d '' skill_dir; do
      name="$(basename "$skill_dir")"
      [[ ! -e "$stage_skills_dir/$name" ]] ||
        die "duplicate installed skill name: $name"
      link_skill_dir "$stage_skills_dir" "$name" "$runtime_bundle_current_link/shared-skills/$name"
    done < <(find "$runtime_bundle_current_link/shared-skills" -mindepth 1 -maxdepth 1 -type d -print0 | LC_ALL=C sort -z)
  fi
}

install_runtime_wrappers() {
  local stage_dir="$1"
  local runtime_bin_dir="$stage_dir/runtime/bin"
  local wrapper
  local name

  install_runtime_dir 0755 "$runtime_bin_dir"
  write_codex_freshness_wrapper "$runtime_bin_dir/codex-with-runtime-bundle.sh"

  if [[ -d "$runtime_bundle_current_link/bin" ]]; then
    while IFS= read -r -d '' wrapper; do
      name="$(basename "$wrapper")"
      install_personal_file 0755 "$wrapper" "$runtime_bin_dir/$name"
    done < <(find "$runtime_bundle_current_link/bin" -mindepth 1 -maxdepth 1 -type f -print0 | LC_ALL=C sort -z)
  fi
}

write_codex_freshness_wrapper() {
  local dest="$1"
  local tmp
  local installer="$bootstrap_source_checkout/scripts/symphony/host/install-runtime.sh"

  tmp="$(mktemp "$state_dir/codex-wrapper.XXXXXX")"
  cat >"$tmp" <<WRAPPER
#!/usr/bin/env bash
set -euo pipefail

installer="\${SYMPHONY_RUNTIME_BUNDLE_INSTALLER:-$installer}"

if [[ ! -x "\$installer" ]]; then
  printf 'symphony-runtime-bundle: freshness installer is missing: %s\\n' "\$installer" >&2
  exit 1
fi

"\$installer" --check-runtime-bundle-fresh ||
  {
    printf 'symphony-runtime-bundle: installed CODEX_HOME bundle is stale; run %s --runtime-bundle-refresh\\n' "\$installer" >&2
    exit 1
  }

export SYMPHONY_TOOLING_ROOT="$bootstrap_source_checkout"
exec codex "\$@"
WRAPPER
  install_personal_file 0755 "$tmp" "$dest"
  rm -f "$tmp"
}

append_skill_manifest_entries() {
  local skills_file="$1"
  local root="$2"
  local kind="$3"
  local link_prefix="$4"
  local codex_home="$5"
  local skill_dir
  local name
  local source_sha

  [[ -d "$root" ]] || return

  while IFS= read -r -d '' skill_dir; do
    name="$(basename "$skill_dir")"
    source_sha="$(sha256_tree "$skill_dir")"
    jq -n \
      --arg name "$name" \
      --arg kind "$kind" \
      --arg destination "$codex_home/skills/$name" \
      --arg link_target "$link_prefix/$name" \
      --arg source_sha "$source_sha" \
      '{
        name: $name,
        kind: $kind,
        destination: $destination,
        linkTarget: $link_target,
        sourceSha256: $source_sha
      }' >>"$skills_file"
  done < <(find "$root" -mindepth 1 -maxdepth 1 -type d -print0 | LC_ALL=C sort -z)
}

write_installed_manifest() {
  local stage_dir="$1"
  local codex_home="$2"
  local output="$stage_dir/runtime-bundle-manifest.json"
  local skills_file
  local repo_sha
  local bundle_sha
  local manifest_sha
  local workflow_sha
  local current_target
  local installed_at

  skills_file="$(mktemp "$state_dir/runtime-bundle-skills.XXXXXX")"
  : >"$skills_file"

  append_skill_manifest_entries \
    "$skills_file" \
    "$runtime_bundle_current_link/skills" \
    "private" \
    "$runtime_bundle_current_link/skills" \
    "$codex_home"
  append_skill_manifest_entries \
    "$skills_file" \
    "$runtime_bundle_current_link/shared-skills" \
    "shared" \
    "$runtime_bundle_current_link/shared-skills" \
    "$codex_home"

  repo_sha="$(runtime_bundle_repo_sha)"
  bundle_sha="$(sha256_tree "$runtime_bundle_source_dir")"
  manifest_sha="$(sha256_file "$runtime_bundle_current_link/manifest.json")"
  workflow_sha="$(sha256_file "$runtime_bundle_current_link/workflow/WORKFLOW.md")"
  current_target="$(readlink "$runtime_bundle_current_link")"
  installed_at="${SYMPHONY_RUNTIME_BUNDLE_INSTALLED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

  jq -s \
    --arg installed_at "$installed_at" \
    --arg repo_sha "$repo_sha" \
    --arg source_path "$runtime_bundle_source_dir" \
    --arg bundle_sha "$bundle_sha" \
    --arg manifest_sha "$manifest_sha" \
    --arg workflow_sha "$workflow_sha" \
    --arg release_path "$current_target" \
    --arg current_link "$runtime_bundle_current_link" \
    --arg current_target "$current_target" \
    --arg codex_home "$codex_home" \
    --arg codex_config "$codex_home/config.toml" \
    --arg codex_agents "$codex_home/AGENTS.md" \
    '{
      schemaVersion: "symphony-runtime-bundle-install/v1",
      installedAt: $installed_at,
      repo: {
        sha: $repo_sha,
        sourcePath: $source_path
      },
      bundle: {
        sha256: $bundle_sha,
        manifestSha256: $manifest_sha,
        workflowSourceSha256: $workflow_sha,
        releasePath: $release_path,
        currentLink: $current_link,
        currentTarget: $current_target
      },
      codex: {
        home: $codex_home,
        configPath: $codex_config,
        agentsPath: $codex_agents
      },
      skills: .
    }' "$skills_file" >"$output"
  rm -f "$skills_file"

  if is_root; then
    chown "$runtime_user:$runtime_group" "$output"
  fi
  chmod 0644 "$output"
}

verify_personal_stage() {
  local stage_dir="$1"
  local link

  [[ -s "$stage_dir/AGENTS.md" ]] || die "staged personal AGENTS.md is empty"
  [[ -s "$stage_dir/config.toml" ]] || die "staged personal config.toml is empty"
  [[ -s "$stage_dir/runtime-bundle-manifest.json" ]] ||
    die "staged runtime bundle manifest is empty"

  while IFS= read -r -d '' link; do
    [[ -d "$link" ]] || die "staged skill link does not resolve: $link"
    case "$(readlink "$link")" in
      "$runtime_bundle_current_link"/*) ;;
      *) die "staged skill link does not point at runtime bundle current: $link" ;;
    esac
  done < <(find "$stage_dir/skills" -mindepth 1 -maxdepth 1 -type l -print0 | LC_ALL=C sort -z)
}

activate_personal_runtime() {
  local codex_home="$1"
  local stage_dir="$2"
  local backup

  install_personal_file 0644 "$stage_dir/AGENTS.md" "$codex_home/AGENTS.md"
  install_personal_file 0600 "$stage_dir/config.toml" "$codex_home/config.toml"

  backup="$codex_home/.skills.previous.$$"
  rm -rf "$backup"
  if [[ -e "$codex_home/skills" || -L "$codex_home/skills" ]]; then
    mv "$codex_home/skills" "$backup"
  fi
  mv "$stage_dir/skills" "$codex_home/skills"
  rm -rf "$backup"

  install_runtime_dir 0755 "$codex_home/runtime"
  rm -rf "$codex_home/runtime/bin"
  mv "$stage_dir/runtime/bin" "$codex_home/runtime/bin"

  install_personal_file \
    0644 \
    "$stage_dir/runtime-bundle-manifest.json" \
    "$codex_home/runtime-bundle-manifest.json"
}

install_personal_runtime_unlocked() {
  local codex_home
  local stage_dir

  codex_home="$(runtime_codex_home)"
  install_runtime_dir 0700 "$codex_home"
  install_dir 0700 "$state_dir"

  stage_dir="$(mktemp -d "$codex_home/.bundle-next.XXXXXX")"
  install_bundle_skill_links "$stage_dir"
  install_runtime_wrappers "$stage_dir"
  install_personal_file 0644 "$runtime_bundle_current_link/codex/AGENTS.md" "$stage_dir/AGENTS.md"
  install_personal_file 0600 "$runtime_bundle_current_link/codex/config.toml.template" "$stage_dir/config.toml"
  write_installed_manifest "$stage_dir" "$codex_home"
  verify_personal_stage "$stage_dir"
  activate_personal_runtime "$codex_home" "$stage_dir"
  rm -rf "$stage_dir"

  log "installed runtime bundle into $codex_home"
}

install_runtime_bundle_unlocked() {
  stage_runtime_bundle_release_unlocked
  install_personal_runtime_unlocked
}

main() {
  require_root
  with_runtime_bundle_lock install_runtime_bundle_unlocked
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
