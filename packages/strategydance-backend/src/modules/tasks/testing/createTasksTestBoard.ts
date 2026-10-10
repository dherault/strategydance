import type { ModuleCaller } from '~types'

import type { ModuleDatabaseFake } from '~domain/modules/testing/createModuleDatabaseFake'
import markdownToTaskDescription from '~domain/tasks/markdownToTaskDescription'
import type { FakeTask } from '~domain/tasks/testing/createTasksDatabaseFake'

import createModuleTestKit from '~modules/testing/createModuleTestKit'

/*
  What the Tasks module's tests set a board up with: a member's connection to the module, tasks
  stored as the page stores them, a description written from Markdown, and chains of tasks each
  waiting on the one before
*/
function createTasksTestBoard(fake: ModuleDatabaseFake, organizationId: string) {
  // The module as the member `userId` reaches it, Strategy Dance's agent unless told otherwise
  function connect(fields: Partial<ModuleCaller> = {}, userId = 'member') {
    return createModuleTestKit('tasks', {
      kind: 'agent',
      userId,
      organizationId,
      membershipCreatedAt: fake.addMember(userId, organizationId, { displayName: 'Ada' }),
      scopes: ['tasks:read', 'tasks:write'],
      idempotencyScope: 'conversation:checked',
      ...fields,
    })
  }

  function add(fields: Partial<FakeTask> = {}) {
    return fake.insertTask({ organizationId, ...fields })
  }

  // A description as the page stores it from what a member typed, with its plain text
  function describe(markdown: string) {
    const written = markdownToTaskDescription(markdown)

    if (written.outcome !== 'written') throw new Error(`A description refused: ${written.outcome}`)

    return { description: written.description, descriptionText: written.descriptionText }
  }

  // Tasks each waiting on the one before, the first waiting on nothing
  function chain(count: number, fields: Partial<FakeTask> = {}) {
    const tasks = Array.from({ length: count }, (_, index) =>
      add({ name: `Step ${index}`, position: index, ...fields }),
    )

    for (let index = 1; index < count; index++) fake.link(tasks[index]!.id, tasks[index - 1]!.id)

    return tasks
  }

  return { connect, add, describe, chain }
}

export default createTasksTestBoard
