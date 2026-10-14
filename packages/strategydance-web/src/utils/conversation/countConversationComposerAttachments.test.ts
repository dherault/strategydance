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
  }
}

describe('countConversationComposerAttachments', () => {
  test('counts the files in the tray', () => {
    expect(
      countConversationComposerAttachments({
        attachments: [createAttachment('a'), createAttachment('b')],
        sendingMessageId: null,
        pendingMessage: null,
      }),
    ).toBe(2)
  })

  test('counts the files of the message whose send is going, which a failure puts back', () => {
    expect(
      countConversationComposerAttachments({
        attachments: [createAttachment('a')],
        sendingMessageId: 'message-1',
        pendingMessage: createPendingMessage('message-1', 3),
      }),
    ).toBe(4)
  })

  test('leaves out the files of a message sent, once its send has gone through', () => {
    expect(
      countConversationComposerAttachments({
        attachments: [createAttachment('a')],
        sendingMessageId: null,
        pendingMessage: createPendingMessage('message-1', 3),
      }),
    ).toBe(1)
  })
})
