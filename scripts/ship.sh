#!/usr/bin/env bash

# Opens the release pull request: everything that has landed on `dev` goes to `main`.
# Idempotent, because `dev` is long lived and one pull request stays open across several
# merges into it: a second run reports the open one rather than failing.

set -euo pipefail

BASE=main
HEAD=dev

if ! command -v gh > /dev/null; then
  echo "This needs the GitHub CLI: https://cli.github.com" >&2
  exit 1
fi

git fetch --quiet origin "$BASE" "$HEAD"

url=$(gh pr list --base "$BASE" --head "$HEAD" --state open --json url --jq '.[0].url // empty')

if [[ -n $url ]]; then
  echo "$HEAD is already on its way to $BASE: $url"
  exit 0
fi

# The remote refs, not the local branches, because they are what GitHub will compare.
commits=$(git log --format='- %s' --no-merges --reverse "origin/$BASE..origin/$HEAD")

if [[ -z $commits ]]; then
  echo "origin/$HEAD holds nothing that origin/$BASE does not. Nothing to ship."
  exit 0
fi

if git show-ref --quiet --verify "refs/heads/$HEAD"; then
  unpushed=$(git rev-list --count "origin/$HEAD..$HEAD")

  if [[ $unpushed -gt 0 ]]; then
    echo "Local $HEAD is $unpushed commit(s) ahead of origin/$HEAD, which the pull request would leave behind." >&2
    echo "Push them first: git push origin $HEAD" >&2
    exit 1
  fi
fi

gh pr create \
  --base "$BASE" \
  --head "$HEAD" \
  --title "Ship $HEAD to $BASE" \
  --body "$(printf 'Everything that has landed on `%s` since the last release.\n\n%s\n' "$HEAD" "$commits")"
