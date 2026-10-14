import { describe, expect, test } from 'bun:test'

import restoreConversationFailedSend from '~utils/conversation/restoreConversationFailedSend'

import type { ConversationComposerAttachment } from '~data/conversationComposerDrafts'

function createAttachment(id: string): ConversationComposerAttachment {
  return {
    id,
    name: `${id}.pdf`,
    contentType: 'application/pdf',
    file: new Blob(['%PDF']),
    status: 'ready',
    progress: 100,
  }
}

const EMPTY = { text: '', mentions: new Map<string, string>(), attachments: [] }

describe('restoreConversationFailedSend', () => {
  test('puts the message back as it was sent when nothing was written meanwhile', () => {
    const sent = {
      text: 'Ask @Plan',
      mentions: new Map([['Plan', 'document-1']]),
      attachments: [createAttachment('a')],
    }

    const restored = restoreConversationFailedSend(sent, EMPTY)

    expect(restored.text).toBe('Ask @Plan')
    expect(restored.mentions).toBe(sent.mentions)
    expect(restored.attachments).toEqual(sent.attachments)
  })

  test('puts it ahead of what was written meanwhile, on a line of its own', () => {
    const restored = restoreConversationFailedSend({ ...EMPTY, text: 'First' }, { ...EMPTY, text: 'Second' })

    expect(restored.text).toBe('First\nSecond')
  })

  test('adds no line for a message of files alone', () => {
    const restored = restoreConversationFailedSend(
      { ...EMPTY, attachments: [createAttachment('a')] },
      { ...EMPTY, text: 'Written since' },
    )

    expect(restored.text).toBe('Written since')
  })

  test('keeps the mentions of both, the one picked since winning a shared title', () => {
    const restored = restoreConversationFailedSend(
      {
        ...EMPTY,
        text: '@Plan @Notes',
        mentions: new Map([
          ['Plan', 'document-1'],
          ['Notes', 'document-2'],
        ]),
      },
      { ...EMPTY, text: '@Plan', mentions: new Map([['Plan', 'document-3']]) },
    )

    expect([...restored.mentions]).toEqual([
      ['Plan', 'document-3'],
      ['Notes', 'document-2'],
    ])
  })

  test('keeps the files sent ahead of those added since', () => {
    const restored = restoreConversationFailedSend(
      { ...EMPTY, attachments: [createAttachment('a'), createAttachment('b')] },
      { ...EMPTY, attachments: [createAttachment('c')] },
    )

    expect(restored.attachments.map(({ id }) => id)).toEqual(['a', 'b', 'c'])
  })
})
