import type { ConversationRunReference, ModuleCaller } from '~types'

import type {
  ConversationDatabaseFake,
  FakeAttachment,
} from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, { createId } from '~domain/conversations/testing/createConversationTestKit'
import createSubagentsCaller from '~domain/subagents/testing/createSubagentsCaller'

import createModuleTestKit from '~modules/testing/createModuleTestKit'

/*
  What the Subagents module's tests set a conversation up with, on the conversation fake, which holds
  every module's operations: a parent whose run a worker claimed and is running, the module as that
  run reaches it, its launcher, and files the parent sent
*/
function createSubagentsTestConversation(fake: ConversationDatabaseFake) {
  const kit = createConversationTestKit(fake)

  // A parent whose run a worker claimed and is running, which calls the module
  async function startRunning() {
    const parent = await kit.start()

    await kit.claim(parent)

    return parent
  }

  // The module as a run reaches it, the parent's unless a test names another, and with its launcher
  // unless a test overrides the caller
  function connect(launching: ConversationRunReference, overrides: Partial<ModuleCaller> = {}) {
    return createModuleTestKit('subagents', createSubagentsCaller(fake, launching, overrides))
  }

  // A file of a conversation's, sent by its first message unless a test says it waits in a draft
  function insertAttachment(conversationId: string, values: Partial<FakeAttachment> = {}) {
    const id = createId()
    const [sentBy] = [...fake.messages.values()].filter(message => message.conversationId === conversationId)
    const conversation = fake.conversations.get(conversationId)
    const row: FakeAttachment = {
      id,
      userId: conversation?.userId ?? '',
      organizationId: conversation?.organizationId ?? '',
      conversationId,
      messageId: sentBy?.id ?? null,
      status: 'READY',
      name: 'pricing.pdf',
      contentType: 'application/pdf',
      size: 2000,
      pageCount: 1,
      tokenCount: 1594,
      claudeFileId: `file_${id}`,
      createdAt: new Date().toISOString(),
      ...values,
    }

    fake.attachments.set(id, row)

    return row
  }

  return { kit, startRunning, connect, insertAttachment }
}

export default createSubagentsTestConversation
