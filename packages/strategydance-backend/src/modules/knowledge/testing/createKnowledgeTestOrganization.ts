import type { ModuleCaller } from '~types'

import type { FakeDocument } from '~domain/documents/testing/createDocumentsDatabaseFake'
import type { ModuleDatabaseFake } from '~domain/modules/testing/createModuleDatabaseFake'
import type { FakeTask } from '~domain/tasks/testing/createTasksDatabaseFake'

import createModuleTestKit from '~modules/testing/createModuleTestKit'

/*
  What the Knowledge module's tests set an organization up with: a member's connection to the module,
  and the documents and tasks its items are linked to, stored as their pages store them
*/
function createKnowledgeTestOrganization(fake: ModuleDatabaseFake, organizationId: string) {
  // The module as the member `userId` reaches it, Strategy Dance's agent unless told otherwise
  function connect(fields: Partial<ModuleCaller> = {}, userId = 'member', displayName = 'Ada') {
    return createModuleTestKit('knowledge', {
      kind: 'agent',
      userId,
      organizationId,
      membershipCreatedAt: fake.addMember(userId, organizationId, { displayName }),
      scopes: ['knowledge:read', 'knowledge:write'],
      idempotencyScope: 'conversation:checked',
      ...fields,
    })
  }

  function addDocument(fields: Partial<FakeDocument> = {}) {
    return fake.insertDocument({ organizationId, title: 'Plan', ...fields })
  }

  function addTask(fields: Partial<FakeTask> = {}) {
    return fake.insertTask({ organizationId, name: 'Send the first cold emails', ...fields })
  }

  return { connect, addDocument, addTask }
}

export default createKnowledgeTestOrganization
