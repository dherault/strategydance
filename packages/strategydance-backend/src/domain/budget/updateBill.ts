import { type BillRecurrence, type Currency, formatMoneyAmount } from 'strategydance-core'
import {
  BillRecurrence as DatabaseBillRecurrence,
  Currency as DatabaseCurrency,
  updateBillForAgent,
} from 'strategydance-database/backend'

import type { AgentBill, AgentBillUpdateReceipt, BudgetWriteResult, ModuleCall, ModuleCaller } from '~types'

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
import storeAgentBillReceipt from '~domain/budget/storeAgentBillReceipt'
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
  // Null detaches the bill's receipt, which is kept among its earlier receipts
  receipt?: AgentBillUpdateReceipt | null
}

/*
  Saves a bill for an agent, any member saving any bill: the fields given laid over the bill as it is
  read, the rest kept. A currency changed without an amount keeps the amount as written, which the new
  currency has to take, a recurrence taken off takes the end with it, and `receipt: null` detaches
  the receipt, which the bill keeps among its earlier receipts, as it keeps one a new receipt
  replaces, and `receipt: { earlierReceiptId }` takes one of those back.

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
  const earlierReceiptId =
    input.receipt && 'earlierReceiptId' in input.receipt ? toCanonicalUuid(input.receipt.earlierReceiptId) : null
  const receipt =
    input.receipt == null || 'earlierReceiptId' in input.receipt
      ? null
      : await readAgentBillReceipt(caller, input.receipt)

  if (receipt && receipt.outcome !== 'read' && receipt.outcome !== 'named') return receipt

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const billId = toCanonicalUuid(input.id)
  // The receipt the save gives the bill: null to detach it, undefined to keep the bill's own
  let receiptId: string | null | undefined = input.receipt === null ? null : (earlierReceiptId ?? undefined)

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
    // The day the bill is paid on is held to the caller's today only when the call changes it: one
    // kept was taken on another member's today, which may be a day ahead
    const checked = checkBillFields(
      {
        amount: input.amount ?? formatMoneyAmount(current.amountMinor, current.currency),
        currency,
        paidOn,
        recurrence,
        endsOn,
      },
      state.today,
      { isPaidOnKept: input.paidOn === undefined },
    )

    if (checked.outcome !== 'checked') return checked

    const paidById = input.paidBy === undefined ? current.paidById : parseBillPayer(input.paidBy, caller)

    if (paidById === null) return { outcome: 'payerRequired' }

    const payer = state.members.find(member => member.id === paidById)

    // A bill keeps the payer it has, even one who has left
    if (!payer && paidById !== current.paidById) return { outcome: 'payerNotMember' }

    if (receipt && receiptId === undefined) {
      const written = await storeAgentBillReceipt(caller, receipt)

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

      const isPayerRefused = isOperationRefusal(error, PAYER_REFUSAL)
      const isReceiptRefused =
        isOperationRefusal(error, RECEIPT_REFUSAL) || isOperationRefusal(error, RECEIPT_TAKEN_REFUSAL)
      // The operation checks the payer and the receipt before the `updatedAt` it is held to, so a
      // payer or a receipt the call kept from its read, which a member's save moved since, is refused
      // as the bill having changed
      const isKeptFieldRefused =
        (isPayerRefused && input.paidBy === undefined) || (isReceiptRefused && input.receipt === undefined)

      if (isPayerRefused && !isKeptFieldRefused) return { outcome: 'payerNotMember' }
      // An earlier receipt is held to the bill's by the operation's own check, however old it is
      if (isReceiptRefused && !isKeptFieldRefused) {
        return { outcome: earlierReceiptId ? 'earlierReceiptNotFound' : 'receiptTaken' }
      }
      if (!isKeptFieldRefused && !isOperationRefusal(error, CHANGED_REFUSAL)) throw error
      // Saved or deleted by somebody else since the read: a version held to the read refuses it
      if (input.version !== undefined) return { outcome: 'changed' }
    }
  }

  return { outcome: 'busy' }
}

export default updateBill
