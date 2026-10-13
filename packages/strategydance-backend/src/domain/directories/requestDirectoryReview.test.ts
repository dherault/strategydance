import { describe, expect, mock, test } from 'bun:test'

import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { default: createClaudeMessage } = await import('~domain/agent/createClaudeMessage')
const { default: createScriptedClaudeClient } = await import('~domain/agent/testing/createScriptedClaudeClient')
const { default: requestDirectoryReview } = await import('~domain/directories/requestDirectoryReview')
const { createAnswer, createDirectory, createPageProbe } = await import('~domain/directories/testing/directoryFixtures')

const DIRECTORY = createDirectory('tools')

const PROBE = { root: createPageProbe(DIRECTORY.rootUrl), submission: null }

const FETCHED: BetaContentBlock[] = [
  { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_fetch', input: { url: 'https://tools.example/faq' } },
  {
    type: 'web_fetch_tool_result',
    tool_use_id: 'srvtoolu_1',
    content: {
      type: 'web_fetch_result',
      url: 'https://tools.example/faq',
      retrieved_at: null,
      content: {
        type: 'document',
        source: { type: 'text', media_type: 'text/plain', data: 'Free listings need our badge on your site.' },
        title: 'FAQ',
        citations: null,
      },
    },
  } as BetaContentBlock,
]

function answer(content: BetaContentBlock[], stopReason: 'end_turn' | 'pause_turn' | 'refusal' = 'end_turn') {
  return createClaudeMessage({ content, stopReason, usage: { inputTokens: 1000, outputTokens: 100 } })
}

function text(value: unknown): BetaContentBlock {
  return { type: 'text', text: JSON.stringify(value), citations: null }
}

describe('requestDirectoryReview', () => {
  test('answers with the review, what its fetches read, and what it used', async () => {
    const claude = createScriptedClaudeClient({ answers: [answer([...FETCHED, text(createAnswer())])] })

    const review = await requestDirectoryReview(DIRECTORY, PROBE, claude.client)

    expect(review).toMatchObject({
      outcome: 'answered',
      answer: createAnswer(),
      usage: { inputTokens: 1000, outputTokens: 100 },
    })
    expect(review.outcome === 'answered' && review.fetchedText).toContain('Free listings need our badge on your site.')
  })

  test('sends a paused turn back, and reads the answer of its last part', async () => {
    const claude = createScriptedClaudeClient({
      answers: [answer(FETCHED, 'pause_turn'), answer([text(createAnswer())])],
    })

    const review = await requestDirectoryReview(DIRECTORY, PROBE, claude.client)

    expect(review).toMatchObject({ outcome: 'answered', usage: { inputTokens: 2000, outputTokens: 200 } })
    expect(review.outcome === 'answered' && review.fetchedText).toContain('Free listings need our badge')
    expect(JSON.parse(claude.requests[1]).messages.at(-1)).toEqual({ role: 'assistant', content: FETCHED })
  })

  test('counts a refusal, or an answer past the schema, as no answer', async () => {
    const refused = createScriptedClaudeClient({ answers: [answer([], 'refusal')] })
    const rambling = createScriptedClaudeClient({ answers: [answer([{ type: 'text', text: 'Hmm', citations: null }])] })

    expect(await requestDirectoryReview(DIRECTORY, PROBE, refused.client)).toMatchObject({
      outcome: 'unanswered',
      failure: expect.stringContaining('refused'),
    })
    expect(await requestDirectoryReview(DIRECTORY, PROBE, rambling.client)).toMatchObject({ outcome: 'unanswered' })
  })

  test('counts a failure of the API as no check at all', async () => {
    const claude = createScriptedClaudeClient({ answers: [new Error('overloaded_error')] })

    expect(await requestDirectoryReview(DIRECTORY, PROBE, claude.client)).toMatchObject({
      outcome: 'failed',
      failure: 'overloaded_error',
    })
  })
})
