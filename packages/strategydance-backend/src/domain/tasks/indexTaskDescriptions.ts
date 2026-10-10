import { getUnindexedTasksForAgent, indexTaskTextForAgent } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { MAX_TASKS_INDEXED } from '~constants'

import { dataConnect } from '~firebase'

import readTaskDescriptionText from '~domain/tasks/readTaskDescriptionText'

type IndexTaskDescriptionsResult = { outcome: 'notMember' } | { outcome: 'indexed'; isComplete: boolean }

/*
  Indexes, before a query reads the plain text, up to 20 tasks whose `descriptionText` a page from
  before it left null, from their descriptions, enough for the odd save from an old bundle once the
  release's backfill has run. Each is written only while the task is as it was read, so a save landing
  in between, which writes its own text or nulls it again, is never written over: that one stays for
  the next query. The answer says whether every task is indexed now, which the list passes on, and
  refuses a caller who is no longer the member the module read
*/
async function indexTaskDescriptions(caller: ModuleCaller): Promise<IndexTaskDescriptionsResult> {
  const reference = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
  }
  const { data } = await getUnindexedTasksForAgent(dataConnect, reference)

  if (data.membership.length === 0) return { outcome: 'notMember' }

  const batch = data.tasks.slice(0, MAX_TASKS_INDEXED)
  const written = await Promise.all(
    batch.map(async task => {
      const { data: indexed } = await indexTaskTextForAgent(dataConnect, {
        ...reference,
        id: task.id,
        updatedAt: task.updatedAt,
        descriptionText: readTaskDescriptionText(task.description),
      })

      return indexed.task_updateMany === 1
    }),
  )

  if (data.tasks.length > MAX_TASKS_INDEXED) return { outcome: 'indexed', isComplete: false }
  if (written.every(Boolean)) return { outcome: 'indexed', isComplete: true }

  // A write that changed nothing lost to a save, which leaves the task for the next query, or to
  // another query that indexed it first: only a read again tells the two apart
  const { data: again } = await getUnindexedTasksForAgent(dataConnect, reference)

  return { outcome: 'indexed', isComplete: again.tasks.length === 0 }
}

export default indexTaskDescriptions
