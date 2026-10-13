import { describe, expect, mock, test } from 'bun:test'

import type fetchOutbound from '~utils/fetchOutbound'

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { DIRECTORIES_FILE_PATH, INACTIVE_DIRECTORIES_FILE_PATH } = await import('~constants')
const { default: createClaudeMessage } = await import('~domain/agent/createClaudeMessage')
const { default: createScriptedClaudeClient } = await import('~domain/agent/testing/createScriptedClaudeClient')
const { default: publishDirectoryCheck, fitReport } = await import('~domain/directories/publishDirectoryCheck')
const { createAnswer, createDirectory, createInactiveDirectory } =
  await import('~domain/directories/testing/directoryFixtures')
const { default: createGitHubFake } = await import('~domain/github/testing/createGitHubFake')

const TODAY = '2026-10-20'

const PAGE = `<html><body>${'A directory of tools. '.repeat(30)}</body></html>`

const FILES = {
  [DIRECTORIES_FILE_PATH]: `${JSON.stringify([createDirectory('alpha'), createDirectory('beta')], null, 2)}\n`,
  [INACTIVE_DIRECTORIES_FILE_PATH]: '[]\n',
}

const fetch: typeof fetchOutbound = async url => ({
  url,
  status: 200,
  headers: { 'content-type': 'text/html' },
  body: Buffer.from(PAGE),
  isTruncated: false,
})

function createClaude(count = 1) {
  return createScriptedClaudeClient({
    answers: Array.from({ length: count }, () =>
      createClaudeMessage({ content: [{ type: 'text', text: JSON.stringify(createAnswer()), citations: null }] }),
    ),
  })
}

function readDirectories(github: ReturnType<typeof createGitHubFake>) {
  return JSON.parse(github.readFiles('directories-check')[DIRECTORIES_FILE_PATH]) as {
    name: string
    lastChecked: string | null
  }[]
}

async function publish(github: ReturnType<typeof createGitHubFake>, claude = createClaude()) {
  return publishDirectoryCheck({
    github: github.client,
    claude: claude.client,
    today: TODAY,
    count: 1,
    inactiveCount: 0,
    fetch,
    random: () => 0,
  })
}

describe('publishDirectoryCheck', () => {
  test('starts the branch from dev, commits the check, and opens the pull request', async () => {
    const github = createGitHubFake({ files: FILES })

    expect(await publish(github)).toEqual({ outcome: 'committed', url: 'https://github.com/pull/1' })
    expect(readDirectories(github).filter(({ lastChecked }) => lastChecked === TODAY)).toHaveLength(1)
    expect(github.pullRequests).toMatchObject([{ head: 'directories-check', base: 'dev', state: 'open' }])
    expect(github.comments.get(1)?.map(({ body }) => body.split('\n')[0])).toEqual([`### ${TODAY}`])
  })

  test('adds each run to the open pull request, after merging dev into it', async () => {
    const github = createGitHubFake({ files: FILES })

    await publish(github)
    await publish(github)

    expect(github.merges).toEqual(['directories-check'])
    expect(readDirectories(github).every(({ lastChecked }) => lastChecked === TODAY)).toBe(true)
    expect(github.pullRequests).toHaveLength(1)
    // Each run's report a comment of its own, which no other run writes over
    expect(github.comments.get(1)?.map(({ body }) => body.split('\n')[0])).toEqual([`### ${TODAY}`, `### ${TODAY}`])
  })

  test('starts again from dev once the pull request was closed', async () => {
    const github = createGitHubFake({ files: FILES })

    await publish(github)
    github.close(1)
    await publish(github)

    expect(readDirectories(github).filter(({ lastChecked }) => lastChecked === TODAY)).toHaveLength(1)
    expect(github.pullRequests.map(({ state }) => state)).toEqual(['closed', 'open'])
  })

  test('carries into the branch what landed on dev meanwhile', async () => {
    const github = createGitHubFake({ files: FILES })

    await publish(github)
    github.push('dev', {
      [INACTIVE_DIRECTORIES_FILE_PATH]: `${JSON.stringify([createInactiveDirectory('gone')], null, 2)}\n`,
    })
    await publish(github)

    expect(JSON.parse(github.readFiles('directories-check')[INACTIVE_DIRECTORIES_FILE_PATH])).toMatchObject([
      { name: 'gone' },
    ])
    expect(readDirectories(github).every(({ lastChecked }) => lastChecked === TODAY)).toBe(true)
  })

  test('waits on a conflict with dev, asking a human once, without asking Claude', async () => {
    const github = createGitHubFake({ files: FILES })

    await publish(github)
    github.push('dev', { [DIRECTORIES_FILE_PATH]: `${JSON.stringify([createDirectory('alpha')], null, 2)}\n` })

    const claude = createClaude(0)

    expect(await publish(github, claude)).toEqual({ outcome: 'conflict', url: 'https://github.com/pull/1' })
    await publish(github, claude)

    expect(claude.requests).toHaveLength(0)
    expect(github.comments.get(1)?.filter(({ body }) => body.includes('conflicts with this branch'))).toHaveLength(1)
  })

  test('opens no pull request again when a person closed it while the run ran', async () => {
    const github = createGitHubFake({ files: FILES })

    await publish(github)
    github.state.beforeCommit = () => {
      github.state.beforeCommit = () => {}
      github.close(1)
    }

    expect((await publish(github)).outcome).toBe('closed')
    expect(github.pullRequests.map(({ state }) => state)).toEqual(['closed'])
    // Its lists given back as dev's, by a commit made against its own
    expect(github.readFiles('directories-check')).toEqual(github.readFiles('dev'))

    // And the next run starts again from dev, as after any closed pull request
    expect((await publish(github)).outcome).toBe('committed')
    expect(github.pullRequests.map(({ state }) => state)).toEqual(['closed', 'open'])
  })

  test('leaves a newer run’s commit when its own pull request was closed while it ran', async () => {
    const github = createGitHubFake({ files: FILES })

    await publish(github)
    github.state.afterCommit = () => {
      github.state.afterCommit = () => {}
      github.close(1)
      github.push('directories-check', { 'newer.txt': 'a newer run' })
    }

    expect((await publish(github)).outcome).toBe('closed')
    expect(github.readFiles('directories-check')['newer.txt']).toBe('a newer run')
  })

  test('reports on the pull request an overlapping run opened since it looked', async () => {
    const github = createGitHubFake({ files: FILES })

    github.state.beforePullRequest = () => {
      github.state.beforePullRequest = () => {}
      // The other run opens it first, with its own report
      github.pullRequests.push({
        number: 1,
        html_url: 'https://github.com/pull/1',
        body: '',
        state: 'open',
        head: 'directories-check',
        base: 'dev',
      })
      github.comments.set(1, [{ body: '### the other run' }])
    }

    expect(await publish(github)).toEqual({ outcome: 'committed', url: 'https://github.com/pull/1' })
    expect(github.pullRequests).toHaveLength(1)
    expect(github.comments.get(1)?.map(({ body }) => body.split('\n')[0])).toEqual([
      '### the other run',
      `### ${TODAY}`,
    ])
  })

  test('moves the branch on to dev when dev holds all it holds, as after a merge that kept it', async () => {
    const github = createGitHubFake({ files: FILES })

    await publish(github)
    // Merged, its branch kept, and dev moved on since
    github.pullRequests[0].state = 'closed'
    github.branches.set('dev', github.branches.get('directories-check')!)
    github.push('dev', { 'other.txt': 'landed since' })

    expect((await publish(github)).outcome).toBe('committed')
    expect(github.readFiles('directories-check')['other.txt']).toBe('landed since')
  })

  test('leaves the branch, without asking Claude, while it holds another run’s commit', async () => {
    const github = createGitHubFake({ files: FILES })

    await publish(github)
    // Another run committed, and has not opened its pull request yet
    github.pullRequests.splice(0)

    const head = github.branches.get('directories-check')
    const claude = createClaude(0)

    expect(await publish(github, claude)).toEqual({ outcome: 'busy', url: null })
    expect(github.branches.get('directories-check')).toBe(head)
    expect(claude.requests).toHaveLength(0)
  })

  test('applies its checks again to the lists a push changed while it ran', async () => {
    const github = createGitHubFake({ files: FILES })
    const added = `${JSON.stringify([createDirectory('alpha'), createDirectory('beta'), createDirectory('gamma')], null, 2)}\n`

    github.state.beforeCommit = () => {
      github.state.beforeCommit = () => {}
      github.push('directories-check', { [DIRECTORIES_FILE_PATH]: added })
    }

    const claude = createClaude()

    await publish(github, claude)

    expect(claude.requests).toHaveLength(1)
    expect(readDirectories(github).map(({ name, lastChecked }) => [name, lastChecked])).toEqual([
      ['alpha', null],
      ['beta', TODAY],
      ['gamma', null],
    ])
  })
})

test('applies no check to a directory a push changed while it ran', async () => {
  const github = createGitHubFake({ files: FILES })
  const renamed = `${JSON.stringify([createDirectory('alpha'), createDirectory('beta', { rootUrl: 'https://beta.example.org/', submissionUrl: 'https://beta.example.org/' })], null, 2)}\n`

  github.state.beforeCommit = () => {
    github.state.beforeCommit = () => {}
    github.push('directories-check', { [DIRECTORIES_FILE_PATH]: renamed })
  }

  expect((await publish(github)).outcome).toBe('unchanged')
  expect(readDirectories(github).map(({ lastChecked }) => lastChecked)).toEqual([null, null])
})

describe('fitReport', () => {
  test('keeps a report that fits a comment, and cuts one that does not', () => {
    expect(fitReport('### 1\nshort')).toBe('### 1\nshort')

    const cut = fitReport(`### 1\n${'x'.repeat(70_000)}`)

    expect(cut.length).toBeLessThanOrEqual(65_000)
    expect(cut.endsWith('The report was cut here: its commit holds it whole.')).toBe(true)
  })
})
