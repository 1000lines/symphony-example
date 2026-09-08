#!/usr/bin/env bash
# Build the Symphony escript from the runtime checkout and publish it.
#
# The build runs inside the persistent checkout so _build survives between runs
# and rebuilds are incremental. The resulting binary is still installed into an
# immutable, content-addressed release directory so rollback stays possible; a
# build from a locally-modified tree is suffixed -dirty so it can never be
# mistaken for a committed SHA.
set -euo pipefail

SYMPHONY_STEP_NAME="70-symphony-escript"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

runtime_build_home="${SYMPHONY_RUNTIME_BUILD_HOME:-$state_dir/runtime-build-home}"

runtime_mix_source_dir() {
  local source_dir="$1"

  if [[ -f "$source_dir/mix.exs" ]]; then
    printf '%s\n' "$source_dir"
    return 0
  fi

  if [[ -f "$source_dir/elixir/mix.exs" ]]; then
    printf '%s\n' "$source_dir/elixir"
    return 0
  fi

  return 1
}

install_built_escript() {
  local build_dir="$1"
  local release_bin="$2"

  if [[ -x "$build_dir/bin/$escript_name" ]]; then
    install -m 0755 "$build_dir/bin/$escript_name" "$release_bin/$escript_name"
  elif [[ -x "$build_dir/$escript_name" ]]; then
    install -m 0755 "$build_dir/$escript_name" "$release_bin/$escript_name"
  elif [[ -x "$build_dir/_build/prod/escript/$escript_name" ]]; then
    install -m 0755 "$build_dir/_build/prod/escript/$escript_name" "$release_bin/$escript_name"
  else
    die "runtime build did not produce $escript_name"
  fi
}

release_dir_for_head() {
  local head="$1"
  local dirty="$2"

  if [[ "$dirty" == "1" ]]; then
    printf '%s/%s-dirty\n' "$releases_dir" "$head"
    return
  fi

  printf '%s/%s\n' "$releases_dir" "$head"
}

install_runtime_escript() {
  local ref
  local head
  local dirty
  local release_dir
  local mix_source_dir

  ref="$(resolve_runtime_ref)"

  clone_if_absent "$symphony_checkout" "$runtime_repo"
  sync_checkout "$symphony_checkout" "$ref" SYMPHONY_RUNTIME

  head="${SYMPHONY_RUNTIME_HEAD:?checkout sync did not record a runtime HEAD}"
  dirty="${SYMPHONY_RUNTIME_STASHED:-0}"
  release_dir="$(release_dir_for_head "$head" "$dirty")"

  install_dir 0755 "$release_dir/bin"

  if [[ "${SYMPHONY_SKIP_RUNTIME_INSTALL:-0}" == "1" ]]; then
    local stub
    stub="$(mktemp "$release_dir/runtime-stub.XXXXXX")"
    cat >"$stub" <<'STUB'
#!/usr/bin/env bash
printf 'symphony runtime install skipped for fixture\n'
STUB
    install -m 0755 "$stub" "$release_dir/bin/$escript_name"
    rm -f "$stub"
    ln -sfn "$release_dir" "$current_link"
    state_set SYMPHONY_RUNTIME_SHA "$head"
    return
  fi

  if [[ -n "${SYMPHONY_RUNTIME_BIN_SOURCE:-}" ]]; then
    install -m 0755 "$SYMPHONY_RUNTIME_BIN_SOURCE" "$release_dir/bin/$escript_name"
    ln -sfn "$release_dir" "$current_link"
    state_set SYMPHONY_RUNTIME_SHA "$head"
    return
  fi

  mix_source_dir="$(runtime_mix_source_dir "$symphony_checkout")" ||
    die "$runtime_repo@$head does not contain mix.exs"

  require_command mix
  install_dir 0700 "$runtime_build_home"
  (
    export HOME="$runtime_build_home"
    cd "$mix_source_dir"
    mix local.hex --force
    mix local.rebar --force
    MIX_ENV=prod mix deps.get --only prod
    MIX_ENV=prod mix escript.build
  )
  install_built_escript "$mix_source_dir" "$release_dir/bin"

  ln -sfn "$release_dir" "$current_link"
  state_set SYMPHONY_RUNTIME_SHA "$head"
  log "escript installed from $release_dir"
}

main() {
  require_root
  install_runtime_escript
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
