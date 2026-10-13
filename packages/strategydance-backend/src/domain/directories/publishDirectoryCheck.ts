import type { ClaudeClient, DirectoryLists, GitHubClient } from '~types'

import {
  DIRECTORIES_FILE_PATH,
  DIRECTORY_CHECK_BASE_BRANCH,
  DIRECTORY_CHECK_BRANCH,
  GITHUB_REPOSITORY,
  INACTIVE_DIRECTORIES_FILE_PATH,
} from '~constants'

import type fetchOutbound from '~utils/fetchOutbound'
import logger from '~utils/logger'

import applyDirectoryChecks from '~domain/directories/applyDirectoryChecks'
import checkDirectories from '~domain/directories/checkDirectories'
import { DIRECTORY_CHECK_COUNT, INACTIVE_DIRECTORY_CHECK_COUNT } from '~domain/directories/directoryCheckSettings'
import formatDirectoryCheckReport from '~domain/directories/formatDirectoryCheckReport'
import readDirectoryLists from '~domain/directories/readDirectoryLists'
import serializeDirectoryLists from '~domain/directories/serializeDirectoryLists'
import { GitHubError } from '~domain/github/createGitHubClient'

type Options = {
  github: GitHubClient
  claude: ClaudeClient
  // The UTC day of the run, YYYY-MM-DD
  today: string
  count?: number
  inactiveCount?: number
  fetch?: typeof fetchOutbound
  random?: () => number
}

type PullRequest = { number: number; html_url: string; body: string | null }

const PULL_REQUEST_TITLE = 'Check directories'

// GitHub holds a comment to 65,536 characters
const MAX_COMMENT_LENGTH = 65_000

// After a report cut to fit a comment
const CUT_NOTE = '\n\nThe report was cut here: its commit holds it whole.'

// On the comment that says the branch conflicts with its base, so it is left once
const CONFLICT_MARKER = '<!-- directories-check conflict -->'

const PULL_REQUEST_HEADER = `The daily check of the directories package's lists, run by the worker's \`/internal/directories-check\` and described in \`documents/directories.md\`. Each run adds a commit, and its report as a comment below. Merge it whenever the changes read right: the next run then opens another.`

const COMMIT_MUTATION = `mutation CommitDirectoryCheck($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) {
    commit {
      oid
    }
  }
}`

/*
  A day's run of the directories' check, as a pull request into `dev`: one at a time, which each run
  adds a commit to while it is open, so a run builds on the days before it rather than checking
  their directories again.

  With one open, `dev` is merged into its branch first, so it carries what landed meanwhile; a
  conflict stops the run before anything is paid for, and asks a human, once, to resolve it or close
  the pull request. With none, the branch starts again from `dev`: a pull request closed without a
  merge was a rejection, and a merged one's branch is gone.

  The lists are read at the branch's head and committed against it, so a push in between refuses
  the commit rather than being written over; the checks, already paid for, are then applied again
  to the lists read afresh, once. The pull request is read again once the commit lands, so a run
  never reports to one a person closed meanwhile, and each day's report is a comment of its own
*/
async function publishDirectoryCheck({
  github,
  claude,
  today,
  count = DIRECTORY_CHECK_COUNT,
  inactiveCount = INACTIVE_DIRECTORY_CHECK_COUNT,
  fetch,
  random,
}: Options) {
  const pullRequest = await findOpenPullRequest(github)

  if (pullRequest) {
    const { status } = await github.request('POST', `/repos/${GITHUB_REPOSITORY}/merges`, {
      body: {
        base: DIRECTORY_CHECK_BRANCH,
        head: DIRECTORY_CHECK_BASE_BRANCH,
        commit_message: `[directories] Merge ${DIRECTORY_CHECK_BASE_BRANCH} into ${DIRECTORY_CHECK_BRANCH}`,
      },
      allowedStatuses: [409],
    })

    if (status === 409) {
      await reportConflict(github, pullRequest.number)

      return { outcome: 'conflict' as const, url: pullRequest.html_url }
    }
  } else if (!(await resetBranch(github))) {
    logger.warn(
      `Directories: ${DIRECTORY_CHECK_BRANCH} holds commits no pull request carries, another run's, so this one waits`,
    )

    return { outcome: 'busy' as const, url: null }
  }

  let head = await readBranchHead(github)
  let lists = await readLists(github, head)
  const result = await checkDirectories(lists, { claude, count, inactiveCount, today, fetch, random })
  let { report } = result
  let applied = result.lists

  for (let attempt = 0; ; attempt++) {
    const files = serializeDirectoryLists(applied)
    const current = serializeDirectoryLists(lists)

    if (
      files.directoriesText === current.directoriesText
      && files.inactiveDirectoriesText === current.inactiveDirectoriesText
    ) {
      logger.info('Directories: the check changed nothing')

      return { outcome: 'unchanged' as const, url: pullRequest?.html_url ?? null }
    }

    try {
      await commit(github, head, files, `[directories] Check ${result.checks.length} directories on ${today}`, report)

      break
    } catch (error) {
      if (attempt || !(error instanceof GitHubError)) throw error

      logger.warn('Directories: the branch moved while the check ran, so its checks apply again', error)

      head = await readBranchHead(github)
      lists = await readLists(github, head)

      const reapplied = applyDirectoryChecks(lists, result.checks, today)

      applied = reapplied.lists
      report = formatDirectoryCheckReport({
        today,
        outcomes: reapplied.outcomes,
        skipped: result.skipped,
        usage: result.usage,
      })
    }
  }

  // Read again, since a run takes minutes: a person may have closed it, or another run opened it
  const open = await findOpenPullRequest(github)

  if (open) {
    await postReport(github, open.number, report)

    return { outcome: 'committed' as const, url: open.html_url }
  }

  // Closed while the run ran: a rejection, which a new pull request would undo. The branch goes back
  // to `dev` now, since the commit just made is no closed pull request's, and would read as another
  // run's work to the next
  if (pullRequest) {
    logger.warn(`Directories: pull request ${pullRequest.number} closed while the check ran, so it opens none`)

    await github.request('PATCH', `/repos/${GITHUB_REPOSITORY}/git/refs/heads/${DIRECTORY_CHECK_BRANCH}`, {
      body: { sha: await readBranchHead(github, DIRECTORY_CHECK_BASE_BRANCH), force: true },
    })

    return { outcome: 'closed' as const, url: pullRequest.html_url }
  }

  const { data } = await github.request('POST', `/repos/${GITHUB_REPOSITORY}/pulls`, {
    body: {
      title: PULL_REQUEST_TITLE,
      head: DIRECTORY_CHECK_BRANCH,
      base: DIRECTORY_CHECK_BASE_BRANCH,
      body: PULL_REQUEST_HEADER,
    },
  })
  const created = data as PullRequest

  await postReport(github, created.number, report)

  return { outcome: 'committed' as const, url: created.html_url }
}

async function findOpenPullRequest(github: GitHubClient) {
  const owner = GITHUB_REPOSITORY.split('/')[0]
  const { data } = await github.request(
    'GET',
    `/repos/${GITHUB_REPOSITORY}/pulls?state=open&base=${DIRECTORY_CHECK_BASE_BRANCH}&head=${owner}:${DIRECTORY_CHECK_BRANCH}`,
  )

  return (data as PullRequest[])[0] ?? null
}

async function readBranchHead(github: GitHubClient, branch = DIRECTORY_CHECK_BRANCH) {
  const { data } = await github.request('GET', `/repos/${GITHUB_REPOSITORY}/git/ref/heads/${branch}`)

  return (data as { object: { sha: string } }).object.sha
}

/*
  Points the branch at `dev`'s head, creating it when GitHub deleted it with its merged pull
  request, and says whether it did. A branch holding nothing `dev` lacks, or what a closed pull
  request carried, a rejection, is reset. Anything else is another run's, which committed and has not
  opened its pull request yet, or opened it since this run looked: resetting it would drop that paid
  work, so the branch is left, and the run waits for the next day
*/
async function resetBranch(github: GitHubClient) {
  const sha = await readBranchHead(github, DIRECTORY_CHECK_BASE_BRANCH)
  const { status, data } = await github.request(
    'GET',
    `/repos/${GITHUB_REPOSITORY}/git/ref/heads/${DIRECTORY_CHECK_BRANCH}`,
    { allowedStatuses: [404] },
  )

  if (status === 404) {
    await github.request('POST', `/repos/${GITHUB_REPOSITORY}/git/refs`, {
      body: { ref: `refs/heads/${DIRECTORY_CHECK_BRANCH}`, sha },
    })

    return true
  }

  const head = (data as { object: { sha: string } }).object.sha

  if (!(await isDiscardable(github, head))) return false

  await github.request('PATCH', `/repos/${GITHUB_REPOSITORY}/git/refs/heads/${DIRECTORY_CHECK_BRANCH}`, {
    body: { sha, force: true },
  })

  return true
}

// Whether a branch head can be dropped: `dev` holds all it holds, or a closed pull request carried it
async function isDiscardable(github: GitHubClient, head: string) {
  const { data: comparison } = await github.request(
    'GET',
    `/repos/${GITHUB_REPOSITORY}/compare/${DIRECTORY_CHECK_BASE_BRANCH}...${head}`,
  )

  if ((comparison as { ahead_by: number }).ahead_by === 0) return true

  const owner = GITHUB_REPOSITORY.split('/')[0]
  const { data: closed } = await github.request(
    'GET',
    `/repos/${GITHUB_REPOSITORY}/pulls?state=closed&base=${DIRECTORY_CHECK_BASE_BRANCH}&head=${owner}:${DIRECTORY_CHECK_BRANCH}&per_page=10`,
  )

  return (closed as { head: { sha: string } }[]).some(pull => pull.head.sha === head)
}

async function readLists(github: GitHubClient, sha: string): Promise<DirectoryLists> {
  const [directories, inactiveDirectories] = await Promise.all(
    [DIRECTORIES_FILE_PATH, INACTIVE_DIRECTORIES_FILE_PATH].map(async path => {
      const { data } = await github.request('GET', `/repos/${GITHUB_REPOSITORY}/contents/${path}?ref=${sha}`, {
        accept: 'application/vnd.github.raw+json',
      })

      return typeof data === 'string' ? data : JSON.stringify(data)
    }),
  )

  return readDirectoryLists(directories, inactiveDirectories)
}

async function commit(
  github: GitHubClient,
  expectedHeadOid: string,
  { directoriesText, inactiveDirectoriesText }: ReturnType<typeof serializeDirectoryLists>,
  headline: string,
  body: string,
) {
  await github.graphql(COMMIT_MUTATION, {
    input: {
      branch: { repositoryNameWithOwner: GITHUB_REPOSITORY, branchName: DIRECTORY_CHECK_BRANCH },
      expectedHeadOid,
      message: { headline, body },
      fileChanges: {
        additions: [
          { path: DIRECTORIES_FILE_PATH, contents: Buffer.from(directoriesText).toString('base64') },
          { path: INACTIVE_DIRECTORIES_FILE_PATH, contents: Buffer.from(inactiveDirectoriesText).toString('base64') },
        ],
      },
    },
  })
}

async function reportConflict(github: GitHubClient, number: number) {
  logger.warn(`Directories: ${DIRECTORY_CHECK_BASE_BRANCH} conflicts with pull request ${number}, so the check waits`)

  const { data } = await github.request('GET', `/repos/${GITHUB_REPOSITORY}/issues/${number}/comments?per_page=100`)

  if ((data as { body: string }[]).some(({ body }) => body.includes(CONFLICT_MARKER))) return

  await github.request('POST', `/repos/${GITHUB_REPOSITORY}/issues/${number}/comments`, {
    body: {
      body: `${CONFLICT_MARKER}\n\`${DIRECTORY_CHECK_BASE_BRANCH}\` changed the directories' lists in a way that conflicts with this branch, so the daily check waits until it is resolved. Resolve the conflict here, or close this pull request for the next run to start again from \`${DIRECTORY_CHECK_BASE_BRANCH}\`.`,
    },
  })
}

/*
  A day's report, as a comment of its own on the pull request, so runs that overlap each add theirs
  and never write over another's, as a shared description would. One too long for a comment is
  cut, its commit holding it whole
*/
async function postReport(github: GitHubClient, number: number, report: string) {
  await github.request('POST', `/repos/${GITHUB_REPOSITORY}/issues/${number}/comments`, {
    body: { body: fitReport(report) },
  })
}

export function fitReport(report: string) {
  const room = MAX_COMMENT_LENGTH - CUT_NOTE.length

  return report.length > room ? `${report.slice(0, room)}${CUT_NOTE}` : report
}

export default publishDirectoryCheck
