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

const PULL_REQUEST_HEADER = `The daily check of the knowledge package's directory lists, run by the worker's \`/internal/directories-check\` and described in \`documents/directories.md\`. Each run adds a commit, and its report as a comment below. Merge it whenever the changes read right: the next run then opens another.`

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
        commit_message: `[knowledge] Merge ${DIRECTORY_CHECK_BASE_BRANCH} into ${DIRECTORY_CHECK_BRANCH}`,
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
  let committed = ''

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
      committed = await commit(
        github,
        head,
        files,
        `[knowledge] Check ${result.checks.length} directories on ${today}`,
        report,
      )

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

  /*
    Closed while the run ran: a rejection, which a new pull request would undo. The commit just made
    is no closed pull request's, so the next run would take it for another run's work: the branch
    is given back `dev`'s lists, in a commit made against that one, so a newer run's commit on top of
    it refuses the write rather than being dropped, and the next run, finding nothing `dev` lacks,
    starts again from it
  */
  if (pullRequest) {
    logger.warn(`Directories: pull request ${pullRequest.number} closed while the check ran, so it opens none`)

    try {
      await commit(
        github,
        committed,
        serializeDirectoryLists(await readLists(github, await readBranchHead(github, DIRECTORY_CHECK_BASE_BRANCH))),
        `[knowledge] Leave the check of ${today}, its pull request closed`,
        `Pull request #${pullRequest.number} was closed while the check ran, so its lists go back to ${DIRECTORY_CHECK_BASE_BRANCH}'s.`,
      )
    } catch (error) {
      if (!(error instanceof GitHubError)) throw error

      logger.info('Directories: a newer run committed on top, so its commit is left')
    }

    return { outcome: 'closed' as const, url: pullRequest.html_url }
  }

  const { status, data } = await github.request('POST', `/repos/${GITHUB_REPOSITORY}/pulls`, {
    body: {
      title: PULL_REQUEST_TITLE,
      head: DIRECTORY_CHECK_BRANCH,
      base: DIRECTORY_CHECK_BASE_BRANCH,
      body: PULL_REQUEST_HEADER,
    },
    allowedStatuses: [422],
  })
  // GitHub refuses a second pull request from the branch: an overlapping run opened it since this
  // one looked, and this run's report goes on that one
  const created = status === 422 ? await findOpenPullRequest(github) : (data as PullRequest)

  if (!created) throw new Error(`GitHub refused the directories pull request: ${JSON.stringify(data)}`)

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
  request, and says whether it did. A branch holding nothing `dev` lacks moves on to it as a
  fast-forward, which GitHub refuses once anybody committed meanwhile. One holding what a closed pull
  request carried, a rejection, or lists no different from `dev`'s, which a run whose pull request
  closed while it ran leaves, is reset. Anything else is another run's, which committed and has not
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
  const { data: comparison } = await github.request(
    'GET',
    `/repos/${GITHUB_REPOSITORY}/compare/${DIRECTORY_CHECK_BASE_BRANCH}...${head}`,
  )

  if ((comparison as { ahead_by: number }).ahead_by === 0) {
    const { status: moved } = await github.request(
      'PATCH',
      `/repos/${GITHUB_REPOSITORY}/git/refs/heads/${DIRECTORY_CHECK_BRANCH}`,
      { body: { sha, force: false }, allowedStatuses: [422] },
    )

    return moved !== 422
  }

  if (!(await isDiscardable(github, head, sha))) return false

  await github.request('PATCH', `/repos/${GITHUB_REPOSITORY}/git/refs/heads/${DIRECTORY_CHECK_BRANCH}`, {
    body: { sha, force: true },
  })

  return true
}

// Whether a branch head `dev` lacks can be dropped: a closed pull request carried it, or its lists
// are `dev`'s
async function isDiscardable(github: GitHubClient, head: string, baseHead: string) {
  const owner = GITHUB_REPOSITORY.split('/')[0]
  const { data: closed } = await github.request(
    'GET',
    `/repos/${GITHUB_REPOSITORY}/pulls?state=closed&base=${DIRECTORY_CHECK_BASE_BRANCH}&head=${owner}:${DIRECTORY_CHECK_BRANCH}&per_page=10`,
  )

  if ((closed as { head: { sha: string } }[]).some(pull => pull.head.sha === head)) return true

  const [branchLists, baseLists] = await Promise.all([readLists(github, head), readLists(github, baseHead)])

  return JSON.stringify(serializeDirectoryLists(branchLists)) === JSON.stringify(serializeDirectoryLists(baseLists))
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
  const { createCommitOnBranch } = await github.graphql<{ createCommitOnBranch: { commit: { oid: string } } }>(
    COMMIT_MUTATION,
    {
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
    },
  )

  return createCommitOnBranch.commit.oid
}

/*
  Asks a human, once a conflict, to resolve it or close the pull request: no report is posted while
  it lasts, so the conflict's comment stays the latest until it is resolved, and a later conflict
  gets one of its own. Only the latest comment is read, whatever the number before it
*/
async function reportConflict(github: GitHubClient, number: number) {
  logger.warn(`Directories: ${DIRECTORY_CHECK_BASE_BRANCH} conflicts with pull request ${number}, so the check waits`)

  const { data: issue } = await github.request('GET', `/repos/${GITHUB_REPOSITORY}/issues/${number}`)
  const { comments: count } = issue as { comments: number }

  if (count) {
    const { data } = await github.request(
      'GET',
      `/repos/${GITHUB_REPOSITORY}/issues/${number}/comments?per_page=1&page=${count}`,
    )

    if ((data as { body: string }[]).some(({ body }) => body.includes(CONFLICT_MARKER))) return
  }

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
