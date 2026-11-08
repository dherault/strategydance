#!/usr/bin/env bash

# The pull request's GitHub calls (Workflow in CLAUDE.md). They live in a file because an agent
# session inside a worktree refuses a `gh` call nested in `$(…)`, which a test of its answer needs

set -euo pipefail

usage() {
  cat >&2 << 'EOF'
Usage: bun run pr <command>

  open <pr>   succeed only while the pull request is open: chain a push after it
EOF
  exit 64
}

# `gh pr view` succeeds whatever the state, so a push chained after it goes out over a merged pull
# request too, and re-creates the branch GitHub deleted. This fails instead, naming the state
is_open() {
  local state
  state=$(gh pr view "$1" --json state --jq .state)

  if [ "$state" != OPEN ]; then
    echo "#$1 is $state" >&2
    return 1
  fi
}

case "${1:-}" in
  open) [ $# -eq 2 ] || usage; is_open "$2" ;;
  *) usage ;;
esac
