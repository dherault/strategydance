import { type BillRecurrence, type Currency, formatMoneyAmount } from 'strategydance-core'
import {
  BillRecurrence as DatabaseBillRecurrence,
  Currency as DatabaseCurrency,
  updateBillForAgent,
} from 'strategydance-database/backend'

import type { AgentBill, AgentBillReceipt, BudgetWriteResult, ModuleCall, ModuleCaller } from '~types'

import { BILL_UPDATE_ATTEMPTS } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import {
  CHANGED_REFUSAL,
  PAYER_REFUSAL,
  RECEIPT_REFUSAL,
  RECEIPT_TAKEN_REFUSAL,
} from '~domain/budget/budgetRefusalMessages'
import checkBillFields from '~domain/budget/checkBillFields'
import parseBillPayer from '~domain/budget/parseBillPayer'
import readAgentBillReceipt from '~domain/budget/readAgentBillReceipt'
import readBudgetState from '~domain/budget/readBudgetState'
import toWrittenBill, { type WrittenBill } from '~domain/budget/toWrittenBill'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

type UpdateBillInput = {
  id: string
  // The `updatedAt` `read_bill` gave, which holds the update to the bill as it was read
  version?: string
  name?: string
  description?: string
  company?: string
  amount?: string
  currency?: Currency
  paidOn?: string
  recurrence?: BillRecurrence | null
  endsOn?: string | null
  paidBy?: string
  // Null detaches the bill's receipt
  receipt?: AgentBillReceipt | null
}

/*
  Saves a bill for an agent, any member saving any bill: the fields given laid over the bill as it is
  read, the rest kept. A currency changed without an amount keeps the amount as written, which the new
  currency has to take, a recurrence taken off takes the end with it, and `receipt: null` detaches
  the receipt, which the sweep then prunes.

  The save is held to the bill's `updatedAt` as read. When a member saved in between, it reads the
  bill again and lays its fields over that, three times at most, unless `version` holds it to the bill
  the agent read, when the change is refused for the agent to read it again. A new receipt is checked
  first and stored once, before the first write
*/
async function updateBill(
  caller: ModuleCaller,
  input: UpdateBillInput,
  call: ModuleCall | null,
): Promise<BudgetWriteResult<WrittenBill>> {
  const receipt = input.receipt == null ? null : await readAgentBillReceipt(input.receipt)

  if (receipt && receipt.outcome !== 'read') return receipt

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const billId = toCanonicalUuid(input.id)
  // The receipt the save gives the bill: null to detach it, undefined to keep the bill's own
  let receiptId: string | null | undefined = input.receipt === null ? null : undefined

  for (let attempt = 0; attempt < BILL_UPDATE_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const answeredMeanwhile = await answerFromModuleCall(caller, call)

      if (answeredMeanwhile) return answeredMeanwhile
    }

    const read = await readBudgetState(caller)

    if (read.outcome !== 'read') return read

    const { state } = read
    const current = state.bills.find(bill => bill.id === billId)

    if (!current) return { outcome: 'notFound' }
    if (input.version !== undefined && input.version !== current.updatedAt) return { outcome: 'changed' }

    const currency = input.currency ?? current.currency
    const paidOn = input.paidOn ?? current.paidOn
    const recurrence = input.recurrence === undefined ? current.recurrence : input.recurrence
    const endsOn = input.endsOn !== undefined ? input.endsOn : recurrence === null ? null : current.endsOn
    const checked = checkBillFields(
      {
        amount: input.amount ?? formatMoneyAmount(current.amountMinor, current.currency),
        currency,
        paidOn,
        recurrence,
        endsOn,
      },
      state.today,
    )

    if (checked.outcome !== 'checked') return checked

    const paidById = input.paidBy === undefined ? current.paidById : parseBillPayer(input.paidBy, caller)

    if (paidById === null) return { outcome: 'payerRequired' }

    const payer = state.members.find(member => member.id === paidById)

    // A bill keeps the payer it has, even one who has left
    if (!payer && paidById !== current.paidById) return { outcome: 'payerNotMember' }

    if (receipt && receiptId === undefined) {
      const { default: writeAgentBillReceipt } = await import('~domain/budget/writeAgentBillReceipt')
      const written = await writeAgentBillReceipt(caller, receipt.file)

      if (written.outcome !== 'written') return written

      receiptId = written.receiptId
    }

    const bill: AgentBill = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      company: input.company ?? current.company,
      amountMinor: checked.amountMinor,
      currency,
      paidOn,
      recurrence,
      endsOn,
      paidById,
      paidByName: payer ? payer.name : current.paidByName,
      receiptId: receiptId === undefined ? current.receiptId : receiptId,
    }
    const result = await toWrittenBill(
      bill,
      state,
      state.bills.map(other => (other.id === billId ? bill : other)),
    )

    try {
      await updateBillForAgent(dataConnect, {
        organizationId: caller.organizationId,
        userId: caller.userId,
        membershipCreatedAt: caller.membershipCreatedAt,
        id: billId,
        updatedAt: current.updatedAt,
        name: bill.name,
        description: bill.description,
        company: bill.company,
        amountMinor: String(bill.amountMinor),
        currency: DatabaseCurrency[bill.currency],
        paidOn: bill.paidOn,
        recurrence: bill.recurrence === null ? null : DatabaseBillRecurrence[bill.recurrence],
        endsOn: bill.endsOn,
        paidById,
        receiptId: bill.receiptId,
        ...toModuleCallVariables(caller, call, result),
      })

      return { outcome: 'written', result }
    } catch (error) {
      const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

      if (answeredMeanwhile) return answeredMeanwhile
      if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }
      if (isOperationRefusal(error, PAYER_REFUSAL)) return { outcome: 'payerNotMember' }
      if (isOperationRefusal(error, RECEIPT_REFUSAL) || isOperationRefusal(error, RECEIPT_TAKEN_REFUSAL)) {
        return { outcome: 'receiptTaken' }
      }
      if (!isOperationRefusal(error, CHANGED_REFUSAL)) throw error
      // Saved or deleted by somebody else since the read: a version held to the read refuses it
      if (input.version !== undefined) return { outcome: 'changed' }
    }
  }

  return { outcome: 'busy' }
}

export default updateBill
