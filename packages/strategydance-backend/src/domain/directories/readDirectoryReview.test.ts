import { describe, expect, test } from 'bun:test'

import type { BetaContentBlock, BetaStopReason } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import createClaudeMessage from '~domain/agent/createClaudeMessage'
import readDirectoryReview from '~domain/directories/readDirectoryReview'
import { createAnswer } from '~domain/directories/testing/directoryFixtures'

function read(content: BetaContentBlock[], stopReason: BetaStopReason = 'end_turn') {
  return readDirectoryReview(createClaudeMessage({ content, stopReason }), content)
}

function text(value: unknown): BetaContentBlock {
  return { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value), citations: null }
}

const FETCH: BetaContentBlock[] = [
  { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_fetch', input: { url: 'https://tools.example/faq' } },
  {
    type: 'web_fetch_tool_result',
    tool_use_id: 'srvtoolu_1',
    content: { type: 'web_fetch_tool_result_error', error_code: 'url_not_accessible' },
  } as BetaContentBlock,
]

describe('readDirectoryReview', () => {
  test('reads the answer after the last fetch', () => {
    const answer = createAnswer({
      businessModel: 'FREE_WITH_BADGE',
      evidence: { quote: 'Listings are free once our badge is on your site', url: 'https://tools.example/faq' },
    })

    expect(read([text('Let me read the FAQ.'), ...FETCH, text(answer)])).toEqual(answer)
  })

  test('reads a text a fallback carried on as one answer', () => {
    const json = JSON.stringify(createAnswer())

    expect(read([text(json.slice(0, 20)), text(json.slice(20))])).toEqual(createAnswer())
  })

  test('answers null for a turn that did not end, or for anything but the schema JSON', () => {
    expect(read([text(createAnswer())], 'max_tokens')).toBeNull()
    expect(read([text(createAnswer())], 'refusal')).toBeNull()
    expect(read([text('It is a directory.')])).toBeNull()
    expect(read([text({ ...createAnswer(), verdict: 'DEAD' })])).toBeNull()
    expect(read([text(createAnswer()), ...FETCH])).toBeNull()
  })

  test('drops a description past a sentence rather than cutting it', () => {
    expect(read([text(createAnswer({ description: 'A'.repeat(201) }))])?.description).toBeNull()
    expect(read([text(createAnswer({ description: 'One line.\nAnother.' }))])?.description).toBeNull()
    expect(read([text(createAnswer({ description: '  Trimmed.  ' }))])?.description).toBe('Trimmed.')
  })

  test('drops an UNKNOWN model and addresses that are not web ones', () => {
    const answer = read([
      text(
        createAnswer({
          businessModel: 'UNKNOWN',
          evidence: { quote: 'A quote long enough', url: 'javascript:alert(1)' },
          submissionUrl: 'mailto:hello@tools.example',
        }),
      ),
    ])

    expect(answer).toMatchObject({ businessModel: null, evidence: null, submissionUrl: null })
  })
})
