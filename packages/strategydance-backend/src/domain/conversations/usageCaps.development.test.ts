import { describe, expect, mock, test } from 'bun:test'

import type { ConversationRunReference } from '~types'

/*
  The development backend, as `bun run dev:backend` starts it. The environment is the process's,
  which the next test file shares, so it is put back once the constants have read it, and every
  module that reads them is imported after it is set
*/
const environment = process.env.NODE_ENV

process.env.NODE_ENV = 'development'

const { IS_USAGE_CAPPED } = await import('~constants')
const { default: createConversationDatabaseFake } = await import('./testing/createConversationDatabaseFake')
const { default: createAttachmentStorageFake } = await import('./testing/createAttachmentStorageFake')
const {
  default: createConversationTestKit,
  ORGANIZATION_ID,
  createId,
} = await import('./testing/createConversationTestKit')

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('~domain/conversations/conversationAttachmentStorage', () => ({
  default: createAttachmentStorageFake().storage,
}))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({
  default: async (_reference: ConversationRunReference) => true,
}))

const { default: sendConversationMessage } = await import('./sendConversationMessage')

process.env.NODE_ENV = environment

const kit = createConversationTestKit(fake)

describe('the daily caps on the development backend', () => {
  test('let every start through, the mutation told so, and still count it', async () => {
    fake.addMember('author', ORGANIZATION_ID)
    kit.seedStarts('CONVERSATION', 40)
    kit.seedStarts('RUN', 300)

    const result = await sendConversationMessage({
      organizationId: ORGANIZATION_ID,
      userId: 'author',
      conversationId: createId(),
      messageId: createId(),
      text: 'Help me price the beta',
      drawnText: 'Help me price the beta',
    })

    expect(IS_USAGE_CAPPED).toBe(false)
    expect(result.outcome).toBe('sent')
    expect(fake.cappedStarts.size).toBe(342)
  })
})
