import type { ConversationRunReference, ModuleCaller } from '~types'

import type { ConversationDatabaseFake } from '~domain/conversations/testing/createConversationDatabaseFake'

/*
  The caller a worker that claimed one of a conversation's runs connects the Subagents module as:
  the run's member, every scope of the module, its keys kept under the conversation's scope, and the
  run as its launcher, which a test overrides to call from elsewhere or from nowhere
*/
function createSubagentsCaller(
  fake: ConversationDatabaseFake,
  launching: ConversationRunReference,
  overrides: Partial<ModuleCaller> = {},
): ModuleCaller {
  const membership = fake.memberships.get(`${launching.userId}:${launching.organizationId}`)

  if (!membership) throw new Error('The caller is no member')

  return {
    kind: 'agent',
    userId: launching.userId,
    organizationId: launching.organizationId,
    membershipCreatedAt: membership.createdAt,
    scopes: [],
    idempotencyScope: `conversation:${launching.conversationId}`,
    launcher: { conversationId: launching.conversationId, runId: launching.runId },
    ...overrides,
  }
}

export default createSubagentsCaller
