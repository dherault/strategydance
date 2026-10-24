#!/usr/bin/env bash

# The GitHub calls of the CodeRabbit review loop (Workflow in CLAUDE.md). They live in a file because
# an agent session inside a worktree refuses a `gh` call nested in `$(…)` or in a shell loop, which
# is exactly what the wait is, and a session whose wait is refused ends its turn instead of looping

set -euo pipefail

# Read from the checkout's remote rather than written in, so the commands this file shares with
# sunshine's copilotReview.sh, `threads`, `reply`, `resolve` and `open`, are copied across as they are
REPOSITORY=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

# Under the ten minutes an agent's shell call may run, so a wait that has not landed yet exits and
# says so rather than being killed mid-poll
WAIT_SECONDS=${CODERABBIT_REVIEW_WAIT_SECONDS:-540}
POLL_SECONDS=30

usage() {
  cat >&2 << 'EOF'
Usage: bun run review <command>

  wait <pr>                  block until CodeRabbit has reviewed the pushed head, asking it to when it waits to be asked
  body <pr>                  CodeRabbit's review of the head, where its nitpicks and outside diff comments live
  threads <pr>               the open review threads, one JSON object each
  reply <thread id> <body>   reply on a thread, reading the body from stdin when it is -
  resolve <thread id>        resolve a thread, once it has been replied to
  open <pr>                  succeed only while the pull request is open: chain a push after it
EOF
  exit 64
}

# The commit the round reviews. A checkout on the pull request's branch waits for what it last pushed,
# `@{push}`, since GitHub can still name the previous head for a moment after a push, and a wait that
# read it would return that round's review again. Its HEAD would not do: the loop commits fixes before
# pushing them. Any other checkout, or a fork's pull request whose branch shares this one's name,
# takes the pull request's head as it is
expected_head() {
  local branch
  branch=$(gh pr view "$1" --repo "$REPOSITORY" --json headRefName,isCrossRepository \
    --jq 'if .isCrossRepository then "" else .headRefName end')

  if [ -n "$branch" ] && [ "$(git branch --show-current)" = "$branch" ] && git rev-parse --verify --quiet '@{push}'; then
    return 0
  fi

  gh pr view "$1" --repo "$REPOSITORY" --json headRefOid --jq .headRefOid
}

# Where CodeRabbit stands on <head>, read from the `CodeRabbit` commit status it writes there
# (`commit_status` in .coderabbit.yaml), one line:
#
#   waiting <why>        nothing to do but poll again
#   ask                  CodeRabbit waits to be asked: auto reviews skipped, or its rate limit is over
#   limited <timestamp>  out of free reviews until then
#   done <description>   reviewed, or skipped for a reason no ask changes, as with nothing to review
#   failed <description> CodeRabbit could not review it
#
# An ask is a pull request comment opening with `@coderabbitai review`. One newer than the latest
# status is still being answered, however old: a second ask could cost a second review, so one that
# CodeRabbit never answers keeps the wait waiting, and its timeout says so
review_state() {
  local pull_request statuses comments
  pull_request=$(gh api "repos/$REPOSITORY/pulls/$1" --jq .head.sha)
  statuses=$(gh api "repos/$REPOSITORY/commits/$2/statuses?per_page=100")
  comments=$(gh api --paginate --slurp "repos/$REPOSITORY/issues/$1/comments?per_page=100")

  PULL_REQUEST_HEAD="$pull_request" EXPECTED_HEAD="$2" STATUSES="$statuses" COMMENTS="$comments" bun -e '
    const { PULL_REQUEST_HEAD, EXPECTED_HEAD, STATUSES, COMMENTS } = process.env
    const isCodeRabbit = login => /^coderabbitai/.test(login)
    const at = timestamp => Date.parse(timestamp)

    if (PULL_REQUEST_HEAD !== EXPECTED_HEAD) {
      console.log(`waiting the pull request names ${PULL_REQUEST_HEAD.slice(0, 7)}, not ${EXPECTED_HEAD.slice(0, 7)}, which this checkout pushed`)
      process.exit()
    }

    const status = JSON.parse(STATUSES)
      .filter(status => status.context === "CodeRabbit")
      .sort((a, b) => at(b.created_at) - at(a.created_at))[0]
    const comments = JSON.parse(COMMENTS).flat()
    const ask = comments.filter(comment => !isCodeRabbit(comment.user.login) && /^@coderabbitai (full )?review\b/.test(comment.body.trim())).at(-1)
    const isAnswering = status && ask && at(ask.created_at) > at(status.created_at)

    if (!status) {
      console.log("waiting no CodeRabbit status yet: if none ever comes, CodeRabbit is not installed on the repository")
    } else if (status.state === "pending") {
      console.log(`waiting ${status.description}`)
    } else if (status.state !== "success") {
      console.log(`failed ${status.description}`)
    } else if (/^Review (completed|approved)/.test(status.description)) {
      console.log(`done ${status.description}`)
    } else if (isAnswering) {
      console.log(`waiting asked for a review at ${ask.created_at}, with no CodeRabbit status since`)
    } else if (/rate limited/i.test(status.description)) {
      // The rate limit notice says how long from when it was written, as "34 minutes" or "8 seconds"
      const notice = comments.filter(comment => isCodeRabbit(comment.user.login) && /Next included review available in/.test(comment.body)).at(-1)
      const units = { second: 1000, minute: 60000, hour: 3600000, day: 86400000 }
      const sentence = notice?.body.match(/Next included review available in ([^.*\n]*)/)[1] ?? ""
      const delay = [...sentence.matchAll(/(\d+)\s*(second|minute|hour|day)/g)].reduce((sum, [, count, unit]) => sum + count * units[unit], 0)
      const freesAt = notice && delay ? at(notice.updated_at) + delay : at(status.created_at) + 600000

      console.log(Date.now() >= freesAt ? "ask" : `limited ${new Date(freesAt).toISOString()}`)
    } else if (/manual review|disabled for this base branch|paused/i.test(status.description)) {
      console.log("ask")
    } else {
      console.log(`done ${status.description}`)
    }'
}

wait_for_review() {
  local deadline=$((SECONDS + WAIT_SECONDS))
  local head state

  while true; do
    # A failed read (a network blip, a rate limit) is retried at the next poll rather than ending
    # a wait that may have minutes left to run
    if head=$(expected_head "$1") && state=$(review_state "$1" "$head"); then
      case "$state" in
        done\ *)
          echo "${head:0:7}: ${state#done }"
          return 0
          ;;
        failed\ *)
          echo "CodeRabbit could not review ${head:0:7}: ${state#failed }" >&2
          return 1
          ;;
        ask)
          if gh pr comment "$1" --repo "$REPOSITORY" --body '@coderabbitai review' > /dev/null; then
            echo "Asked CodeRabbit to review ${head:0:7}" >&2
          fi
          ;;
        limited\ *)
          echo "CodeRabbit is out of free reviews until ${state#limited }: the wait asks again then" >&2
          ;;
      esac
    fi

    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "No CodeRabbit review of #$1 yet (${state:-unread}). Run the same wait again" >&2
      return 75
    fi

    sleep "$POLL_SECONDS"
  done
}

# Every CodeRabbit review of the head, oldest first: its body holds what has no thread, the nitpicks,
# the comments outside the diff and the ones it repeats. A round with nothing to say leaves none, and
# a review of an earlier head is that head's round, already answered, so neither prints anything.
# The pages are read as one array, and `gh api` refuses `--slurp` beside `--jq`: Bun, which runs this
# script anyway, filters them instead of a jq that a machine may not have
print_body() {
  local head
  head=$(gh pr view "$1" --repo "$REPOSITORY" --json headRefOid --jq .headRefOid)

  gh api --paginate --slurp "repos/$REPOSITORY/pulls/$1/reviews" \
    | HEAD_SHA="$head" bun -e '
      const reviews = (await Bun.stdin.json()).flat()
        .filter(review => /^coderabbitai/.test(review.user.login) && review.commit_id === process.env.HEAD_SHA && review.body)
      if (reviews.length) console.log(reviews.map(review => review.body).join("\n\n---\n\n"))
      else console.error(`CodeRabbit left no review body on ${process.env.HEAD_SHA.slice(0, 7)}`)'
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

# `gh pr view` succeeds whatever the state, so a push chained after it goes out over a merged pull
# request too, and re-creates the branch GitHub deleted. This fails instead, naming the state
is_open() {
  local state
  state=$(gh pr view "$1" --repo "$REPOSITORY" --json state --jq .state)

  if [ "$state" != OPEN ]; then
    echo "#$1 is $state" >&2
    return 1
  fi
}

case "${1:-}" in
  wait) [ $# -eq 2 ] || usage; wait_for_review "$2" ;;
  body) [ $# -eq 2 ] || usage; print_body "$2" ;;
  threads) [ $# -eq 2 ] || usage; print_threads "$2" ;;
  reply) [ $# -eq 3 ] || usage; reply "$2" "$3" ;;
  resolve) [ $# -eq 2 ] || usage; resolve "$2" ;;
  open) [ $# -eq 2 ] || usage; is_open "$2" ;;
  *) usage ;;
esac
