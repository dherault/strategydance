import { describe, expect, test } from 'bun:test'

import { ConversationMessageKind } from 'strategydance-database/web'

import type { ConversationMessageBody, ConversationThreadEntry } from '~types'

import groupConversationReplies from './groupConversationReplies'

function entry(id: string, kind: ConversationMessageKind, runId = 'run'): ConversationThreadEntry {
  return { id, kind, position: 0, run: { id: runId } } as ConversationThreadEntry
}

function cited(id: string, citations: { end: number; urls: string[] }[]): [string, ConversationMessageBody] {
  return [
    id,
    {
      id,
      text: 'text',
      citations: citations.map(({ end, urls }) => ({
        start: 0,
        end,
        sources: urls.map(url => ({ url, title: `Title of ${url}`, citedText: 'x' })),
      })),
    } as ConversationMessageBody,
  ]
}

describe('groupConversationReplies', () => {
  test('finds a reply’s pieces, numbering its sources across them in the order first cited', () => {
    const entries = [
      entry('member', ConversationMessageKind.MEMBER_TEXT),
      entry('first', ConversationMessageKind.AGENT_TEXT),
      entry('second', ConversationMessageKind.AGENT_TEXT),
    ]
    const bodies = new Map([
      cited('first', [{ end: 10, urls: ['https://a.com', 'https://b.com'] }]),
      cited('second', [{ end: 4, urls: ['https://b.com', 'https://c.com'] }]),
    ])
    const pieces = groupConversationReplies(entries, bodies)

    expect(pieces.get('first')).toMatchObject({
      isContinuation: false,
      isLast: false,
      markers: [
        { offset: 10, key: '1' },
        { offset: 10, key: '2' },
      ],
    })
    expect(pieces.get('second')).toMatchObject({
      isContinuation: true,
      isLast: true,
      markers: [
        { offset: 4, key: '2' },
        { offset: 4, key: '3' },
      ],
    })
    expect(pieces.get('second')?.sources.map(({ number, url }) => [number, url])).toEqual([
      [1, 'https://a.com'],
      [2, 'https://b.com'],
      [3, 'https://c.com'],
    ])
    expect(pieces.has('member')).toBe(false)
  })

  test('starts a new reply after another kind of entry, or with another run', () => {
    const entries = [
      entry('first', ConversationMessageKind.AGENT_TEXT),
      entry('call', ConversationMessageKind.TOOL_CALL),
      entry('after', ConversationMessageKind.AGENT_TEXT),
      entry('other', ConversationMessageKind.AGENT_TEXT, 'other run'),
    ]
    const pieces = groupConversationReplies(entries, new Map([cited('after', [{ end: 2, urls: ['https://a.com'] }])]))

    expect(pieces.get('first')).toMatchObject({ isContinuation: false, isLast: true })
    expect(pieces.get('after')).toMatchObject({ isContinuation: false, isLast: true, markers: [{ key: '1' }] })
    expect(pieces.get('other')).toMatchObject({ isContinuation: false, isLast: true, sources: [] })
  })
})
