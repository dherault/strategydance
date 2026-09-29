#!/usr/bin/env bash

# The GitHub calls of the Copilot review loop (Workflow in CLAUDE.md). They live in a file because an
# agent session inside a worktree refuses a `gh` call nested in `$(…)` or in a shell loop, which is
# exactly what the wait is, and a session whose wait is refused ends its turn instead of looping

set -euo pipefail

# Read from the checkout's remote rather than written in, so this file is the same in sunshine and
# strategydance and a fix to one is copied to the other as it is
REPOSITORY=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

# Under the ten minutes an agent's shell call may run, so a wait that has not landed yet exits and
# says so rather than being killed mid-poll
WAIT_SECONDS=${COPILOT_REVIEW_WAIT_SECONDS:-540}
POLL_SECONDS=30

usage() {
  cat >&2 << 'EOF'
Usage: bun run review <command>

  count <pr>                 Copilot reviews with a body so far: the baseline to read before a push
  wait <pr> <baseline>       block until that count passes <baseline>, then print the new count
  body <pr>                  the newest Copilot review's body, where "Previously missed" findings live
  threads <pr>               the open review threads, one JSON object each
  reply <thread id> <body>   reply on a thread, reading the body from stdin when it is -
  resolve <thread id>        resolve a thread, once it has been replied to
EOF
  exit 64
}

# Only reviews with a body count: every reply posted to a thread creates a review record with an
# empty one, so a bare count climbs without a review having happened. Those records are also why
# this paginates: the endpoint pages at 30, and the newest review falls off an unpaginated read
count_reviews() {
  gh api --paginate "repos/$REPOSITORY/pulls/$1/reviews" \
    --jq '.[] | select(.user.login | test("copilot")) | select(.body | length > 0) | .id' \
    | wc -l | tr -d ' '
}

wait_for_review() {
  local deadline=$((SECONDS + WAIT_SECONDS))
  local count=unknown

  while true; do
    # A failed read (a network blip, a rate limit) is retried at the next poll rather than ending
    # a wait that may have minutes left to run
    if count=$(count_reviews "$1") && [ "$count" -gt "$2" ]; then
      echo "$count"
      return 0
    fi

    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "No new Copilot review on #$1 yet (count: $count, baseline: $2). Run the same wait again" >&2
      return 75
    fi

    sleep "$POLL_SECONDS"
  done
}

# The newest review can sit on any page, so the pages are read as one array, and `gh api` refuses
# `--slurp` beside `--jq`: Bun, which runs this script anyway, filters them instead of a jq that a
# machine may not have
print_body() {
  gh api --paginate --slurp "repos/$REPOSITORY/pulls/$1/reviews" \
    | bun -e '
      const reviews = (await Bun.stdin.json()).flat()
      const body = reviews.filter(review => /copilot/.test(review.user.login) && review.body).at(-1)?.body
      if (body) console.log(body)'
}

# `--paginate` follows `$endCursor`, so a pull request with more than a page of threads is read whole
print_threads() {
  gh api graphql --paginate -F owner="${REPOSITORY%/*}" -F name="${REPOSITORY#*/}" -F pr="$1" -f query='
    query($owner: String!, $name: String!, $pr: Int!, $endCursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100, after: $endCursor) {
            pageInfo { hasNextPage endCursor }
            nodes { id isResolved comments(first: 1) { nodes { path line body } } }
          }
        }
      }
    }' \
    --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)
      | { id, path: .comments.nodes[0].path, line: .comments.nodes[0].line, body: .comments.nodes[0].body }'
}

reply() {
  local body=(-f body="$2")

  # `-F …=@-` reads the value from stdin, which spares a reply full of backticks from shell quoting
  if [ "$2" = - ]; then
    body=(-F body=@-)
  fi

  gh api graphql -f thread="$1" "${body[@]}" -f query='
    mutation($thread: ID!, $body: String!) {
      addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $thread, body: $body }) { comment { url } }
    }' \
    --jq '.data.addPullRequestReviewThreadReply.comment.url'
}

resolve() {
  gh api graphql -f thread="$1" -f query='
    mutation($thread: ID!) { resolveReviewThread(input: { threadId: $thread }) { thread { isResolved } } }' \
    --jq '.data.resolveReviewThread.thread.isResolved'
}

case "${1:-}" in
  count) [ $# -eq 2 ] || usage; count_reviews "$2" ;;
  wait) [ $# -eq 3 ] || usage; wait_for_review "$2" "$3" ;;
  body) [ $# -eq 2 ] || usage; print_body "$2" ;;
  threads) [ $# -eq 2 ] || usage; print_threads "$2" ;;
  reply) [ $# -eq 3 ] || usage; reply "$2" "$3" ;;
  resolve) [ $# -eq 2 ] || usage; resolve "$2" ;;
  *) usage ;;
esac
