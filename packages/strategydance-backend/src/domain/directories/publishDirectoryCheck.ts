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

// Before each day's report in the pull request's description, newest first, so the oldest can be
// dropped when the description outgrows GitHub's limit
const REPORT_MARKER = '<!-- directories-check report -->'

// GitHub holds a pull request's description to 65,536 characters
const MAX_BODY_LENGTH = 65_000

// On the comment that says the branch conflicts with its base, so it is left once
const CONFLICT_MARKER = '<!-- directories-check conflict -->'

const PULL_REQUEST_HEADER = `The daily check of the directories package's lists, run by the worker's \`/internal/directories-check\` and described in \`documents/directories.md\`. Each run adds a commit, and its report below, newest first. Merge it whenever the changes read right: the next run then opens another.`

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
  to the lists read afresh, once
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
  } else {
    await resetBranch(github)
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

  const open = pullRequest ?? (await findOpenPullRequest(github))

  if (open) {
    await github.request('PATCH', `/repos/${GITHUB_REPOSITORY}/pulls/${open.number}`, {
      body: { body: addReport(open.body ?? '', report) },
    })

    return { outcome: 'committed' as const, url: open.html_url }
  }

  const { data } = await github.request('POST', `/repos/${GITHUB_REPOSITORY}/pulls`, {
    body: {
      title: PULL_REQUEST_TITLE,
      head: DIRECTORY_CHECK_BRANCH,
      base: DIRECTORY_CHECK_BASE_BRANCH,
      body: addReport('', report),
    },
  })

  return { outcome: 'committed' as const, url: (data as PullRequest).html_url }
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

// Points the branch at `dev`'s head, creating it when GitHub deleted it with its merged pull request
async function resetBranch(github: GitHubClient) {
  const sha = await readBranchHead(github, DIRECTORY_CHECK_BASE_BRANCH)
  const { status } = await github.request(
    'GET',
    `/repos/${GITHUB_REPOSITORY}/git/ref/heads/${DIRECTORY_CHECK_BRANCH}`,
    {
      allowedStatuses: [404],
    },
  )

  if (status === 404) {
    await github.request('POST', `/repos/${GITHUB_REPOSITORY}/git/refs`, {
      body: { ref: `refs/heads/${DIRECTORY_CHECK_BRANCH}`, sha },
    })
  } else {
    await github.request('PATCH', `/repos/${GITHUB_REPOSITORY}/git/refs/heads/${DIRECTORY_CHECK_BRANCH}`, {
      body: { sha, force: true },
    })
  }
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

// The description with the day's report on top of the earlier ones, the oldest dropped past GitHub's limit
export function addReport(body: string, report: string) {
  const [, ...reports] = body.split(REPORT_MARKER).map(section => section.trim())
  const sections = [report, ...reports]

  while (sections.length > 1 && formatBody(sections).length > MAX_BODY_LENGTH) sections.pop()

  return formatBody(sections)
}

function formatBody(reports: string[]) {
  return [PULL_REQUEST_HEADER, ...reports].join(`\n\n${REPORT_MARKER}\n\n`)
}

export default publishDirectoryCheck
