import { type Currency, listExchangeRateYears, MAX_BILLS } from 'strategydance-core'
import { getBillForAgent, restoreBillForAgent } from 'strategydance-database/backend'

import type { BudgetWriteResult, ModuleBill, ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import { FULL_REFUSAL, GONE_REFUSAL } from '~domain/budget/budgetRefusalMessages'
import readBudgetRates from '~domain/budget/readBudgetRates'
import readBudgetState from '~domain/budget/readBudgetState'
import toAgentBill from '~domain/budget/toAgentBill'
import toModuleBill from '~domain/budget/toModuleBill'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

// How long after its delete a bill can be restored, as `RestoreBillForAgent` holds it
const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000

// What restoring answers: the bill as it is back
export type RestoredBill = ModuleBill & { budgetCurrency: Currency }

/*
  Takes back a delete for an agent, as the page's Undo does: within a day of it, with its receipt, and
  against the 2000 bills an organization keeps. A refusal the restore itself gives is worded from the
  bill read again, since another restore landing meanwhile, which fills the last place or finds the
  bill no longer deleted, makes the bill not deleted rather than the organization full or the bill gone
*/
async function restoreBill(
  caller: ModuleCaller,
  { id }: { id: string },
  call: ModuleCall | null,
): Promise<BudgetWriteResult<RestoredBill>> {
  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const billId = toCanonicalUuid(id)
  const reference = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    id: billId,
  }
  const [{ data }, read] = await Promise.all([getBillForAgent(dataConnect, reference), readBudgetState(caller)])

  if (data.membership.length === 0 || read.outcome !== 'read') return { outcome: 'notMember' }

  const [row] = data.bills

  // No row tells a wrong id from a bill the sweep removed past its day: the refusal says both
  if (!row) return { outcome: 'notRestorable' }
  if (!row.deletedAt) return { outcome: 'notDeleted' }
  if (Date.parse(row.deletedAt) <= Date.now() - RESTORE_WINDOW_MS) return { outcome: 'goneForGood' }
  if (read.state.bills.length >= MAX_BILLS) return { outcome: 'full' }

  const { currency, today } = read.state
  const bill = toAgentBill({ ...row, receiptId: row.receipt?.id ?? null })
  const { rates } = await readBudgetRates([bill.currency], listExchangeRateYears([bill], today), currency)
  const result = { ...toModuleBill(bill, { currency, today, rates }), budgetCurrency: currency }

  try {
    await restoreBillForAgent(dataConnect, { ...reference, ...toModuleCallVariables(caller, call, result) })

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }

    const isFull = isOperationRefusal(error, FULL_REFUSAL)

    if (!isFull && !isOperationRefusal(error, GONE_REFUSAL)) throw error

    // Restored by another call, or pruned, between the read and the write
    const { data: again } = await getBillForAgent(dataConnect, reference)
    const [current] = again.bills

    if (again.membership.length === 0) return { outcome: 'notMember' }
    if (!current) return { outcome: 'goneForGood' }
    if (!current.deletedAt) return { outcome: 'notDeleted' }

    return { outcome: isFull ? 'full' : 'goneForGood' }
  }
}

export default restoreBill
