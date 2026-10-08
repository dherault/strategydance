import { describe, expect, test } from 'bun:test'

import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import stripBeforeFallback from './stripBeforeFallback'

const thinking = { type: 'thinking', thinking: '', signature: 'sig' } as BetaContentBlock
const redacted = { type: 'redacted_thinking', data: 'opaque' } as BetaContentBlock
const text = (value: string) => ({ type: 'text', text: value, citations: null }) as BetaContentBlock
const search = (id: string) =>
  ({ type: 'server_tool_use', id, name: 'web_search', input: { query: 'pricing' } }) as BetaContentBlock
const searchResult = (id: string) =>
  ({ type: 'web_search_tool_result', tool_use_id: id, content: [] }) as BetaContentBlock
const call = { type: 'tool_use', id: 'toolu_1', name: 'get_team', input: {} } as BetaContentBlock
const fallback = (from: string, to: string) =>
  ({
    type: 'fallback',
    from: { model: from },
    to: { model: to },
    trigger: { type: 'refusal', category: 'cyber' },
  }) as BetaContentBlock

describe('stripBeforeFallback', () => {
  test('keeps a turn no model declined as it is', () => {
    const content = [thinking, search('srvtoolu_1'), searchResult('srvtoolu_1'), text('Flat 19')]

    expect(stripBeforeFallback(content)).toBe(content)
  })

  test('drops thinking, redacted thinking and client calls before the boundary, and keeps text', () => {
    const switched = fallback('claude-opus-5-5', 'claude-opus-4-8')

    expect(
      stripBeforeFallback([thinking, text('Looking'), redacted, call, switched, thinking, text('Flat 19')]),
    ).toEqual([text('Looking'), switched, thinking, text('Flat 19')])
  })

  test('keeps a server call with its result, and drops one left without it', () => {
    const switched = fallback('claude-opus-5-5', 'claude-opus-4-8')

    expect(
      stripBeforeFallback([
        search('srvtoolu_1'),
        searchResult('srvtoolu_1'),
        search('srvtoolu_2'),
        switched,
        text('Flat 19'),
      ]),
    ).toEqual([search('srvtoolu_1'), searchResult('srvtoolu_1'), switched, text('Flat 19')])
  })

  test('drops a result whose call is not in the turn, and any other block the declining model wrote', () => {
    const switched = fallback('claude-opus-5-5', 'claude-opus-4-8')
    const compaction = { type: 'compaction', content: 'Summary' } as BetaContentBlock

    expect(stripBeforeFallback([searchResult('srvtoolu_9'), compaction, switched, text('Flat 19')])).toEqual([
      switched,
      text('Flat 19'),
    ])
  })

  test('strips up to the last boundary when two models declined in turn', () => {
    const first = fallback('claude-opus-5-5', 'claude-opus-5')
    const second = fallback('claude-opus-5', 'claude-opus-4-8')

    expect(stripBeforeFallback([thinking, first, thinking, text('Partly'), second, thinking, text('Flat 19')])).toEqual(
      [first, text('Partly'), second, thinking, text('Flat 19')],
    )
  })
})
