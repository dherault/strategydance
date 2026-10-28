import { deleteBillForAgent } from 'strategydance-database/backend'

import type { BudgetWriteResult, ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import { NOT_FOUND_REFUSAL } from '~domain/budget/budgetRefusalMessages'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

// How long a deleted bill can be restored, as the page's Undo and the sweep hold it
const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000

// What deleting answers: the bill, and until when `restore_bill` brings it back
export type DeletedBill = {
  id: string
  restorableUntil: string
}

/*
  Deletes a bill for an agent as the page's Delete does, setting `deletedAt` and keeping its receipt,
  so it can be restored for a day, which the answer says. Unlike the page's, a bill already deleted,
  or unknown, is refused, so the agent hears it
*/
async function deleteBill(
  caller: ModuleCaller,
  { id }: { id: string },
  call: ModuleCall | null,
): Promise<BudgetWriteResult<DeletedBill>> {
  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const billId = toCanonicalUuid(id)
  const result = { id: billId, restorableUntil: new Date(Date.now() + RESTORE_WINDOW_MS).toISOString() }

  try {
    await deleteBillForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      id: billId,
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

export default deleteBill
