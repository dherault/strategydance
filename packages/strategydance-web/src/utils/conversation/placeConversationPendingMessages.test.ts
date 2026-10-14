import { describe, expect, test } from 'bun:test'

import placeConversationPendingMessages from '~utils/conversation/placeConversationPendingMessages'

import type { ConversationPendingMessage } from '~data/conversationComposerDrafts'

function createPendingMessage(id: string, position: number): ConversationPendingMessage {
  return { id, text: id, attachments: [], sentAt: '2026-10-14T10:00:00.000Z', position }
}

const NO_BODIES = new Map<string, { id: string }>()

function ids(messages: readonly ConversationPendingMessage[]) {
  return messages.map(({ id }) => id)
}

describe('placeConversationPendingMessages', () => {
  test('draws a message the thread does not hold yet at its foot', () => {
    const { shown, needless } = placeConversationPendingMessages(
      [createPendingMessage('sent', 2)],
      [
        { id: 'a', position: 0 },
        { id: 'b', position: 1 },
      ],
      NO_BODIES,
    )

    expect(ids(shown)).toEqual(['sent'])
    expect(ids(needless)).toEqual([])
  })

  test("draws a draft's first message, which the thread holds nothing beside", () => {
    expect(ids(placeConversationPendingMessages([createPendingMessage('sent', 0)], [], NO_BODIES).shown)).toEqual([
      'sent',
    ])
  })

  test('keeps a message the thread holds without its body, drawn in its place', () => {
    const { shown, needless } = placeConversationPendingMessages(
      [createPendingMessage('sent', 2)],
      [
        { id: 'a', position: 1 },
        { id: 'sent', position: 2 },
      ],
      NO_BODIES,
    )

    expect(ids(shown)).toEqual([])
    expect(ids(needless)).toEqual([])
  })

  test('lets go of a message the thread holds with its body', () => {
    const { needless } = placeConversationPendingMessages(
      [createPendingMessage('sent', 2)],
      [{ id: 'sent', position: 2 }],
      new Map([['sent', { id: 'sent' }]]),
    )

    expect(ids(needless)).toEqual(['sent'])
  })

  test('lets go of a message below the oldest entry the thread holds, which lies in the history above', () => {
    const { shown, needless } = placeConversationPendingMessages(
      [createPendingMessage('sent', 2)],
      [
        { id: 'c', position: 160 },
        { id: 'd', position: 161 },
      ],
      NO_BODIES,
    )

    expect(ids(shown)).toEqual([])
    expect(ids(needless)).toEqual(['sent'])
  })

  test('draws a message stored after a note that took the position it was sent at', () => {
    const { shown } = placeConversationPendingMessages(
      [createPendingMessage('sent', 2)],
      [
        { id: 'b', position: 1 },
        { id: 'note', position: 2 },
      ],
      NO_BODIES,
    )

    expect(ids(shown)).toEqual(['sent'])
  })
})
