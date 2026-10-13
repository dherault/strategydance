import { describe, expect, mock, test } from 'bun:test'

import type fetchOutbound from '~utils/fetchOutbound'

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { DIRECTORIES_FILE_PATH, INACTIVE_DIRECTORIES_FILE_PATH } = await import('~constants')
const { default: createClaudeMessage } = await import('~domain/agent/createClaudeMessage')
const { default: createScriptedClaudeClient } = await import('~domain/agent/testing/createScriptedClaudeClient')
const { default: publishDirectoryCheck, addReport } = await import('~domain/directories/publishDirectoryCheck')
const { createAnswer, createDirectory } = await import('~domain/directories/testing/directoryFixtures')
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
    expect(github.pullRequests[0].body).toContain(`### ${TODAY}`)
  })

  test('adds each run to the open pull request, after merging dev into it', async () => {
    const github = createGitHubFake({ files: FILES })

    await publish(github)
    await publish(github)

    expect(github.merges).toEqual(['directories-check'])
    expect(readDirectories(github).every(({ lastChecked }) => lastChecked === TODAY)).toBe(true)
    expect(github.pullRequests).toHaveLength(1)
    expect(github.pullRequests[0].body.split(`### ${TODAY}`)).toHaveLength(3)
  })

  test('starts again from dev once the pull request was closed', async () => {
    const github = createGitHubFake({ files: FILES })

    await publish(github)
    github.pullRequests[0].state = 'closed'
    await publish(github)

    expect(readDirectories(github).filter(({ lastChecked }) => lastChecked === TODAY)).toHaveLength(1)
    expect(github.pullRequests.map(({ state }) => state)).toEqual(['closed', 'open'])
  })

  test('waits on a conflict with dev, asking a human once, without asking Claude', async () => {
    const github = createGitHubFake({ files: FILES, isMergeConflicting: true })

    await publish(github)

    const claude = createClaude(0)

    expect(await publish(github, claude)).toEqual({ outcome: 'conflict', url: 'https://github.com/pull/1' })
    await publish(github, claude)

    expect(claude.requests).toHaveLength(0)
    expect(github.comments.get(1)).toHaveLength(1)
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

describe('addReport', () => {
  test('puts the report on top, and drops the oldest past GitHub’s limit', () => {
    const body = addReport(addReport('', '### 1\nold'), '### 2\nnew')

    expect(body.indexOf('### 2')).toBeLessThan(body.indexOf('### 1'))
    const longer = addReport(body, `### 3\n${'x'.repeat(64_600)}`)

    expect(longer).not.toContain('### 1')
    expect(longer).toContain('### 2')
    expect(longer).not.toContain('cut here')
  })

  test('cuts a report past the limit alone', () => {
    const body = addReport('', `### 1\n${'x'.repeat(70_000)}`)

    expect(body.length).toBeLessThanOrEqual(65_000)
    expect(body.endsWith('The report was cut here: its commit holds it whole.')).toBe(true)
  })
})
