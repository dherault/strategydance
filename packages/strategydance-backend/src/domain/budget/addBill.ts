import { randomUUID } from 'node:crypto'

import { type BillRecurrence, type Currency, MAX_BILLS } from 'strategydance-core'
import {
  BillRecurrence as DatabaseBillRecurrence,
  createBillForAgent,
  Currency as DatabaseCurrency,
} from 'strategydance-database/backend'

import type { AgentBill, AgentBillReceipt, BudgetWriteResult, ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import {
  FULL_REFUSAL,
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

type AddBillInput = {
  name: string
  description?: string
  company: string
  // A decimal string in `currency`
  amount: string
  currency: Currency
  // The member's today when left out
  paidOn?: string
  recurrence?: BillRecurrence
  endsOn?: string
  // `"me"`, the default, or a member as `member:<id>`
  paidBy?: string
  receipt?: AgentBillReceipt
}

/*
  Adds a bill for an agent, as the page's New bill does, any member adding any bill: its fields
  checked first, then its receipt's bytes, so a refused call writes nothing, then the organization's
  2000 bills and the payer, a member, the caller unless named. A receipt is stored before the bill,
  which takes it. The answer carries the budget's status with the bill counted, so the agent hears
  that it tipped a period over
*/
async function addBill(
  caller: ModuleCaller,
  input: AddBillInput,
  call: ModuleCall | null,
): Promise<BudgetWriteResult<WrittenBill>> {
  const receipt = input.receipt === undefined ? null : await readAgentBillReceipt(input.receipt)

  if (receipt && receipt.outcome !== 'read') return receipt

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const read = await readBudgetState(caller)

  if (read.outcome !== 'read') return read

  const { state } = read
  const recurrence = input.recurrence ?? null
  const endsOn = input.endsOn ?? null
  const paidOn = input.paidOn ?? state.today
  const checked = checkBillFields(
    { amount: input.amount, currency: input.currency, paidOn, recurrence, endsOn },
    state.today,
  )

  if (checked.outcome !== 'checked') return checked

  const paidById = parseBillPayer(input.paidBy ?? 'me', caller)
  const payer = state.members.find(member => member.id === paidById)

  if (!payer) return { outcome: 'payerNotMember' }
  if (state.bills.length >= MAX_BILLS) return { outcome: 'full' }

  let receiptId: string | null = null

  if (receipt) {
    const { default: writeAgentBillReceipt } = await import('~domain/budget/writeAgentBillReceipt')
    const written = await writeAgentBillReceipt(caller, receipt.file)

    if (written.outcome !== 'written') return written

    receiptId = written.receiptId
  }

  const bill: AgentBill = {
    id: toCanonicalUuid(randomUUID()),
    name: input.name,
    description: input.description ?? '',
    company: input.company,
    amountMinor: checked.amountMinor,
    currency: input.currency,
    paidOn,
    recurrence,
    endsOn,
    paidById,
    paidByName: payer.name,
    receiptId,
    updatedAt: '',
  }
  const result = await toWrittenBill(bill, state, [...state.bills, bill])

  try {
    await createBillForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      id: bill.id,
      name: bill.name,
      description: bill.description,
      company: bill.company,
      amountMinor: String(bill.amountMinor),
      currency: DatabaseCurrency[bill.currency],
      paidOn,
      recurrence: recurrence === null ? null : DatabaseBillRecurrence[recurrence],
      endsOn,
      paidById,
      receiptId,
      ...toModuleCallVariables(caller, call, result),
    })

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }
    if (isOperationRefusal(error, FULL_REFUSAL)) return { outcome: 'full' }
    if (isOperationRefusal(error, PAYER_REFUSAL)) return { outcome: 'payerNotMember' }
    if (isOperationRefusal(error, RECEIPT_REFUSAL) || isOperationRefusal(error, RECEIPT_TAKEN_REFUSAL)) {
      return { outcome: 'receiptTaken' }
    }

    throw error
  }
}

export default addBill
