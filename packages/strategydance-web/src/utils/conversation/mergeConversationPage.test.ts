import { describe, expect, it } from 'bun:test'

import { ConversationMessageKind } from 'strategydance-database/web'

import type { ConversationPageMessage, ConversationThreadState } from '~types'

import mergeConversationPage from '~utils/conversation/mergeConversationPage'

const PAGE_LENGTH = 2

function message(position: number): ConversationPageMessage {
  return {
    id: `message-${position}`,
    kind: ConversationMessageKind.AGENT_TEXT,
    position,
    createdAt: '2026-10-04T12:00:00Z',
    isAnswerSkipped: false,
    text: `Message ${position}`,
  }
}

function state(positions: number[], fields: Partial<ConversationThreadState> = {}): ConversationThreadState {
  return {
    revision: 0,
    counter: 20,
    entries: positions.map(position => {
      const { text: _text, ...entry } = message(position)

      return entry
    }),
    verifiedFrom: positions[0]!,
    fillTo: null,
    resume: null,
    hasOlder: true,
    ...fields,
  }
}

// A page read below `before`, newest first
function page(before: number, positions: number[], historyRevision = 0) {
  return { before, historyRevision, messages: positions.map(message).reverse() }
}

describe('mergeConversationPage', () => {
  it('adds a full page below the verified range, with older messages left to read', () => {
    const next = mergeConversationPage(state([8, 9]), page(8, [6, 7]), PAGE_LENGTH)

    expect(next.entries.map(({ position }) => position)).toEqual([6, 7, 8, 9])
    expect(next.verifiedFrom).toBe(6)
    expect(next.hasOlder).toBe(true)
  })

  it('makes the thread whole with a page shorter than it may be', () => {
    const next = mergeConversationPage(state([8, 9]), page(8, [7]), PAGE_LENGTH)

    expect(next.verifiedFrom).toBe(-Infinity)
    expect(next.hasOlder).toBe(false)
  })

  it('replaces what it held in the page range, dropping what the page leaves out', () => {
    const held = state([3, 5, 6, 9], { verifiedFrom: 9, fillTo: 3 })
    const next = mergeConversationPage(held, page(9, [5]), PAGE_LENGTH)

    expect(next.entries.map(({ position }) => position)).toEqual([5, 9])
    expect(next.fillTo).toBeNull()
  })

  it('drops a page read below another position, or in another history', () => {
    const held = state([8, 9])

    expect(mergeConversationPage(held, page(7, [5, 6]), PAGE_LENGTH)).toBe(held)
    expect(mergeConversationPage(held, page(8, [6, 7], 1), PAGE_LENGTH)).toBe(held)
  })

  it('restores the range below a gap once the fill meets it', () => {
    const held = state([2, 3, 4, 10, 11], {
      verifiedFrom: 10,
      fillTo: 4,
      resume: { verifiedFrom: 2, hasOlder: false },
    })
    const next = mergeConversationPage(held, page(10, [4, 7]), PAGE_LENGTH)

    expect(next.entries.map(({ position }) => position)).toEqual([2, 3, 4, 7, 10, 11])
    expect(next.verifiedFrom).toBe(2)
    expect(next.hasOlder).toBe(false)
    expect(next.fillTo).toBeNull()
  })
})
