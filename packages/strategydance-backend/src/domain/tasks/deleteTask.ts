import { deleteTaskForAgent } from 'strategydance-database/backend'

import type { ModuleCall, ModuleCaller, TasksWriteResult } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'
import { NOT_FOUND_REFUSAL } from '~domain/tasks/tasksRefusalMessages'

// How long a deleted task can be restored, as the page's Undo and the sweep hold it
const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000

// What deleting answers: the task, and until when `restore_task` brings it back
export type DeletedTask = {
  id: string
  restorableUntil: string
}

/*
  Deletes a task for an agent as its dialog's Delete does, setting `deletedAt` and keeping its links,
  so it can be restored with them for a day, which the answer says. Unlike the page's, a task already
  deleted, or unknown, is refused, so the agent hears it
*/
async function deleteTask(
  caller: ModuleCaller,
  { id }: { id: string },
  call: ModuleCall | null,
): Promise<TasksWriteResult<DeletedTask>> {
  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const taskId = toCanonicalUuid(id)
  const result = { id: taskId, restorableUntil: new Date(Date.now() + RESTORE_WINDOW_MS).toISOString() }

  try {
    await deleteTaskForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      id: taskId,
      ...toModuleCallVariables(caller, call, result),
    })

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }
    if (isOperationRefusal(error, NOT_FOUND_REFUSAL)) return { outcome: 'notFound' }

    throw error
  }
}

export default deleteTask
