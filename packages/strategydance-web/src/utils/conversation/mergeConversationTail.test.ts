import { describe, expect, it } from 'bun:test'

import { ConversationMessageKind, ConversationToolStatus } from 'strategydance-database/web'

import type { ConversationThreadEntry } from '~types'

import mergeConversationTail from '~utils/conversation/mergeConversationTail'

const TAIL_LENGTH = 3

function entry(position: number, fields: Partial<ConversationThreadEntry> = {}): ConversationThreadEntry {
  return {
    id: `message-${position}`,
    kind: ConversationMessageKind.AGENT_TEXT,
    position,
    createdAt: '2026-10-04T12:00:00Z',
    isAnswerSkipped: false,
    ...fields,
  }
}

// A tail of the given positions, newest first as the live query reads it
function tail(positions: number[], { revision = 0, counter = Math.max(...positions) + 1 } = {}) {
  return {
    historyRevision: revision,
    nextMessagePosition: counter,
    messages: positions.map(position => entry(position)).reverse(),
  }
}

describe('mergeConversationTail', () => {
  it('starts a thread from a full tail, with older messages left to read', () => {
    const state = mergeConversationTail(null, tail([4, 5, 6]), TAIL_LENGTH)

    expect(state.entries.map(({ position }) => position)).toEqual([4, 5, 6])
    expect(state.verifiedFrom).toBe(4)
    expect(state.hasOlder).toBe(true)
  })

  it('starts a whole thread from a tail shorter than it may be', () => {
    const state = mergeConversationTail(null, tail([0, 1]), TAIL_LENGTH)

    expect(state.verifiedFrom).toBe(-Infinity)
    expect(state.hasOlder).toBe(false)
  })

  it('ignores a tail older than what it holds, and keeps its state for the same one again', () => {
    const state = mergeConversationTail(null, tail([4, 5, 6], { revision: 1 }), TAIL_LENGTH)

    expect(mergeConversationTail(state, tail([3, 4, 5], { revision: 1 }), TAIL_LENGTH)).toBe(state)
    expect(mergeConversationTail(state, tail([5, 6, 7], { revision: 0 }), TAIL_LENGTH)).toBe(state)
    expect(mergeConversationTail(state, tail([4, 5, 6], { revision: 1 }), TAIL_LENGTH)).toBe(state)
  })

  it('ignores an old tail holding a note Resume deleted since, at the same revision and counter', () => {
    const withNote = tail([4, 5, 6])
    const state = mergeConversationTail(null, withNote, TAIL_LENGTH)
    const resumed = mergeConversationTail(state, tail([3, 4, 5], { counter: 7 }), TAIL_LENGTH)

    expect(resumed.entries.map(({ position }) => position)).toEqual([3, 4, 5])
    expect(mergeConversationTail(resumed, withNote, TAIL_LENGTH)).toBe(resumed)
  })

  it('keeps the object of an entry that did not change, and replaces one that did', () => {
    const state = mergeConversationTail(null, tail([4, 5, 6]), TAIL_LENGTH)
    const next = mergeConversationTail(
      state,
      {
        historyRevision: 0,
        nextMessagePosition: 7,
        messages: [
          entry(6, { kind: ConversationMessageKind.TOOL_CALL, toolStatus: ConversationToolStatus.SUCCEEDED }),
          entry(5),
          entry(4),
        ],
      },
      TAIL_LENGTH,
    )

    expect(next.entries[0]).toBe(state.entries[0]!)
    expect(next.entries[1]).toBe(state.entries[1]!)
    expect(next.entries[2]).not.toBe(state.entries[2]!)
    expect(next.entries[2]?.toolStatus).toBe(ConversationToolStatus.SUCCEEDED)
  })

  it('drops what a tail shorter than it may be no longer holds', () => {
    const state = mergeConversationTail(null, tail([0, 1, 2]), TAIL_LENGTH)
    const next = mergeConversationTail(state, tail([0, 1], { counter: 3 }), TAIL_LENGTH)

    expect(next.entries.map(({ position }) => position)).toEqual([0, 1])
  })

  it('marks a gap to fill down to the newest entry it holds, remembering the range below', () => {
    const state = mergeConversationTail(null, tail([4, 5, 6]), TAIL_LENGTH)
    const next = mergeConversationTail(state, tail([10, 11, 12]), TAIL_LENGTH)

    expect(next.entries.map(({ position }) => position)).toEqual([4, 5, 6, 10, 11, 12])
    expect(next.verifiedFrom).toBe(10)
    expect(next.fillTo).toBe(6)
    expect(next.resume).toEqual({ verifiedFrom: 4, hasOlder: true })
  })

  it('treats a tail that starts right after the newest entry held as a gap, since positions have holes', () => {
    const state = mergeConversationTail(null, tail([4, 5, 6]), TAIL_LENGTH)

    expect(mergeConversationTail(state, tail([7, 8, 9]), TAIL_LENGTH).fillTo).toBe(6)
  })

  it('reads every entry below the tail again once the history moved', () => {
    const state = mergeConversationTail(null, tail([4, 5, 6]), TAIL_LENGTH)
    const next = mergeConversationTail(state, tail([5, 7, 8], { revision: 1 }), TAIL_LENGTH)

    expect(next.entries.map(({ position }) => position)).toEqual([4, 5, 7, 8])
    expect(next.verifiedFrom).toBe(5)
    expect(next.fillTo).toBe(4)
    expect(next.resume).toBeNull()
  })
})
