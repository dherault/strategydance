import {
  convertMoney,
  type Currency,
  type ExchangeRateTable,
  formatMoneyAmount,
  getLastBillPayment,
  getNextBillPayment,
  isBillActive,
} from 'strategydance-core'

import type { AgentBill, ModuleBill, ModuleBillPayment } from '~types'

// What a bill is converted with: the budget's currency, the member's today and the rates
export type ModuleBillConversion = {
  currency: Currency
  today: string
  rates: ExchangeRateTable
}

/*
  A bill as the Budget module answers it: its amount as typed, a decimal string in its own currency,
  its payer as the module names a member, and its last payment, on or before today, else its first,
  still ahead, and its next, after today and within two years, each converted at its own day's rate
  into the budget's currency, as the page converts them
*/
function toModuleBill(bill: AgentBill, conversion: ModuleBillConversion): ModuleBill {
  const next = getNextBillPayment(bill, conversion.today)

  return {
    id: bill.id,
    name: bill.name,
    description: bill.description,
    company: bill.company,
    amount: formatMoneyAmount(bill.amountMinor, bill.currency),
    currency: bill.currency,
    paidOn: bill.paidOn,
    recurrence: bill.recurrence,
    endsOn: bill.endsOn,
    paidBy: bill.paidById ? `member:${bill.paidById}` : null,
    paidByName: bill.paidByName,
    hasReceipt: bill.receiptId !== null,
    lastPayment: toPayment(bill, getLastBillPayment(bill, conversion.today), conversion),
    nextPayment: next ? toPayment(bill, next, conversion) : null,
    isActive: isBillActive(bill, conversion.today),
  }
}

function toPayment(bill: AgentBill, day: string, { currency, rates }: ModuleBillConversion): ModuleBillPayment {
  const converted = convertMoney(bill.amountMinor, bill.currency, currency, day, rates)

  return { day, convertedAmount: converted === null ? null : formatMoneyAmount(converted, currency) }
}

export default toModuleBill
