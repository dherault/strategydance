import { describe, expect, test } from 'bun:test'

import type { BetaStopReason } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { CompanyAspect } from 'strategydance-database/backend'

import createClaudeMessage from './createClaudeMessage'
import readConversationTagging from './readConversationTagging'

function answer(texts: string[], stopReason: BetaStopReason = 'end_turn') {
  return createClaudeMessage({
    content: texts.map(text => ({ type: 'text' as const, text, citations: null })),
    stopReason,
  })
}

describe('readConversationTagging', () => {
  test('reads the aspects answered, in their order', () => {
    expect(readConversationTagging(answer(['{"aspects":["SALES","FINANCES"]}']))).toEqual([
      CompanyAspect.SALES,
      CompanyAspect.FINANCES,
    ])
  })

  test('keeps each aspect once, those it knows, and the first three', () => {
    expect(
      readConversationTagging(answer(['{"aspects":["SALES","PRICING","SALES","LEGAL","PRODUCT","DESIGN"]}'])),
    ).toEqual([CompanyAspect.SALES, CompanyAspect.LEGAL, CompanyAspect.PRODUCT])
  })

  test('reads a text a fallback carried on as one answer', () => {
    expect(readConversationTagging(answer(['{"aspects":["MARK', 'ETING"]}']))).toEqual([CompanyAspect.MARKETING])
  })

  test('answers null for no aspect, or none it knows', () => {
    expect(readConversationTagging(answer(['{"aspects":[]}']))).toBeNull()
    expect(readConversationTagging(answer(['{"aspects":["PRICING"]}']))).toBeNull()
  })

  test('answers null for anything but the schema’s JSON', () => {
    expect(readConversationTagging(answer(['Sales, mostly']))).toBeNull()
    expect(readConversationTagging(answer(['{"aspects":"SALES"}']))).toBeNull()
    expect(readConversationTagging(answer([]))).toBeNull()
  })

  test('answers null for a refusal, or an answer cut at its length', () => {
    expect(readConversationTagging(answer(['{"aspects":["SALES"]}'], 'refusal'))).toBeNull()
    expect(readConversationTagging(answer(['{"aspects":["SA'], 'max_tokens'))).toBeNull()
  })
})
