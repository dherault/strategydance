import { describe, expect, test } from 'bun:test'

import countConversationComposerAttachments from '~utils/conversation/countConversationComposerAttachments'

import type { ConversationComposerAttachment, ConversationPendingMessage } from '~data/conversationComposerDrafts'

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

function createPendingMessage(id: string, attachmentCount: number): ConversationPendingMessage {
  return {
    id,
    text: '',
    attachments: Array.from({ length: attachmentCount }, (_, index) => ({
      id: `sent-${index}`,
      name: `sent-${index}.pdf`,
      contentType: 'application/pdf',
      size: 4,
    })),
    sentAt: '2026-10-14T10:00:00.000Z',
    position: 0,
  }
}

describe('countConversationComposerAttachments', () => {
  test('counts the files in the tray', () => {
    expect(
      countConversationComposerAttachments({
        attachments: [createAttachment('a'), createAttachment('b')],
        sendingMessageId: null,
        pendingMessages: [],
      }),
    ).toBe(2)
  })

  test('counts the files of the message whose send is going, which a failure puts back', () => {
    expect(
      countConversationComposerAttachments({
        attachments: [createAttachment('a')],
        sendingMessageId: 'message-1',
        pendingMessages: [createPendingMessage('message-1', 3)],
      }),
    ).toBe(4)
  })

  test('leaves out the files of the messages sent before, whose bodies the thread has not read yet', () => {
    expect(
      countConversationComposerAttachments({
        attachments: [],
        sendingMessageId: 'message-2',
        pendingMessages: [createPendingMessage('message-1', 4), createPendingMessage('message-2', 2)],
      }),
    ).toBe(2)
  })

  test('leaves out the files of a message sent, once its send has gone through', () => {
    expect(
      countConversationComposerAttachments({
        attachments: [createAttachment('a')],
        sendingMessageId: null,
        pendingMessages: [createPendingMessage('message-1', 3)],
      }),
    ).toBe(1)
  })
})
