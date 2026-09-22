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

# Before anything else, including the exits that report there is nothing to do: a commit
# sitting unpushed is one the pull request would leave behind whichever branch it takes,
# and saying "nothing to ship" over the top of it is the reading that costs a release.
if git show-ref --quiet --verify "refs/heads/$HEAD"; then
  unpushed=$(git rev-list --count "origin/$HEAD..$HEAD")

  if [[ $unpushed -gt 0 ]]; then
    echo "Local $HEAD is $unpushed commit(s) ahead of origin/$HEAD, which the pull request would leave behind." >&2
    echo "Push them first: git push origin $HEAD" >&2
    exit 1
  fi
fi

url=$(gh pr list --base "$BASE" --head "$HEAD" --state open --json url --jq '.[0].url // empty')

if [[ -n $url ]]; then
  echo "$HEAD is already on its way to $BASE: $url"
  exit 0
fi

# The remote refs, not the local branches, because they are what GitHub will compare. The
# whole range decides whether there is a release, merges included, since a merge that
# resolved a conflict by hand carries changes no other commit in the range does.
if [[ -z $(git rev-list "origin/$BASE..origin/$HEAD") ]]; then
  echo "origin/$HEAD holds nothing that origin/$BASE does not. Nothing to ship."
  exit 0
fi

# The body reads better without them, though: a merge names the branch work arrived on,
# and the commits under it say what the release does. Unless merges are all there is.
commits=$(git log --format='- %s' --no-merges --reverse "origin/$BASE..origin/$HEAD")

if [[ -z $commits ]]; then
  commits=$(git log --format='- %s' --reverse "origin/$BASE..origin/$HEAD")
fi

gh pr create \
  --base "$BASE" \
  --head "$HEAD" \
  --title "Ship $HEAD to $BASE" \
  --body "$(printf 'Everything that has landed on `%s` since the last release.\n\n%s\n' "$HEAD" "$commits")"
