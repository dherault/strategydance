import { describe, expect, mock, test } from 'bun:test'

import type fetchOutbound from '~utils/fetchOutbound'

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { default: createClaudeMessage } = await import('~domain/agent/createClaudeMessage')
const { default: createScriptedClaudeClient } = await import('~domain/agent/testing/createScriptedClaudeClient')
const { default: runDirectoryChecks } = await import('~domain/directories/runDirectoryChecks')
const { createAnswer, createDirectory } = await import('~domain/directories/testing/directoryFixtures')

const PAGE = `<html><body>${'A directory of tools. '.repeat(30)}</body></html>`

// Every address answers the page, but those of the hosts named, which do not resolve
function createFetch(unreachableHosts: string[] = []): typeof fetchOutbound {
  return async url => {
    if (unreachableHosts.includes(new URL(url).hostname))
      throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })

    return { url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(PAGE), isTruncated: false }
  }
}

function answer(fields = {}) {
  return createClaudeMessage({
    content: [{ type: 'text', text: JSON.stringify(createAnswer(fields)), citations: null }],
  })
}

describe('runDirectoryChecks', () => {
  test('reviews what it reaches, and only counts what it cannot', async () => {
    const claude = createScriptedClaudeClient({ answers: [answer()] })
    const { checks, skipped } = await runDirectoryChecks([createDirectory('up'), createDirectory('down')], {
      claude: claude.client,
      fetch: createFetch(['down.example']),
    })

    expect(skipped).toEqual([])
    expect(checks.map(({ name, review }) => [name, review?.outcome ?? null])).toEqual([
      ['up', 'answered'],
      ['down', null],
    ])
    expect(claude.requests).toHaveLength(1)
  })

  test('probes the submission page a review names', async () => {
    const claude = createScriptedClaudeClient({ answers: [answer({ submissionUrl: 'https://up.example/new-submit' })] })
    const { checks } = await runDirectoryChecks([createDirectory('up')], {
      claude: claude.client,
      fetch: createFetch(),
    })

    expect(checks[0].submissionProbe).toMatchObject({ url: 'https://up.example/new-submit', outcome: 'reachable' })
  })

  test('starts none once its budget is spent', async () => {
    let time = 0
    const claude = createScriptedClaudeClient({ answers: [answer()] })
    const { checks, skipped } = await runDirectoryChecks([createDirectory('first'), createDirectory('second')], {
      claude: claude.client,
      fetch: createFetch(),
      budgetMs: 1000,
      now: () => {
        time += 600

        return time
      },
    })

    expect(checks.map(({ name }) => name)).toEqual(['first'])
    expect(skipped).toEqual(['second'])
  })
})
