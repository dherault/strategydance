import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import {
  addCalendarDays,
  BILL_DAYS_AHEAD,
  BILL_RECURRENCES,
  type BillReceiptFields,
  Currency,
  CURRENCIES,
  FIRST_BILL_DAY,
  isCalendarDay,
  isCurrency,
  MAX_BILL_COMPANY_LENGTH,
  MAX_BILL_DESCRIPTION_LENGTH,
  MAX_BILL_NAME_LENGTH,
  parseMoney,
} from 'strategydance-core'
import { z } from 'zod'

const answerSchema = z.object({
  name: z.string(),
  description: z.string(),
  company: z.string(),
  amount: z.string().nullable(),
  currency: z.string().nullable(),
  paidOn: z.string().nullable(),
  recurrence: z.string().nullable(),
})

/*
  What the receipt reader's request answered, as `buildBillReceiptReadRequest`'s schema has it,
  clamped as the prototype's `bgExtract` clamps it, so the bill dialog takes every field:
  - the name, the description and the company on one line, trimmed, within a bill's lengths;
  - the amount as the receipt wrote it, or null when `parseMoney` refuses it in its currency, or as
    one of two decimals when it has none, or when it is not above 0: "1,500.00" is no amount;
  - a currency or a recurrence it does not know, null;
  - a day that is not one, or one a bill cannot be paid on, today.

  Null when it answered nothing the schema holds: a refusal, an answer cut at its `max_tokens`, or
  text that is not the schema's JSON, which is a read that failed
*/
function readBillReceiptFields(message: BetaMessage, { today }: { today: string }): BillReceiptFields | null {
  if (message.stop_reason !== 'end_turn') return null

  const text = message.content.map(block => (block.type === 'text' ? block.text : '')).join('')
  let answer: unknown

  try {
    answer = JSON.parse(text)
  } catch {
    return null
  }

  const parsed = answerSchema.safeParse(answer)

  if (!parsed.success) return null

  const { name, description, company, amount, currency, paidOn, recurrence } = parsed.data
  const knownCurrency = isCurrency(currency) ? currency : null

  return {
    name: toOneLine(name, MAX_BILL_NAME_LENGTH),
    description: toOneLine(description, MAX_BILL_DESCRIPTION_LENGTH),
    company: toOneLine(company, MAX_BILL_COMPANY_LENGTH),
    amount: readAmount(amount, knownCurrency),
    currency: knownCurrency,
    paidOn: readDay(paidOn, today),
    recurrence: BILL_RECURRENCES.find(known => known === recurrence) ?? null,
  }
}

// On one line, its runs of spaces and line breaks made one space, trimmed, and cut to a length in
// characters, between two of them
function toOneLine(text: string, maxLength: number) {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, maxLength).join('').trim()
}

/*
  US dollars stand in for a currency of two decimals, the bill dialog checking it again in its own.
  Decimals of zeros past the currency's own are dropped, as the prompt's "1500.00" written for a
  currency with none, the yen, the won or the króna, means 1500
*/
function readAmount(amount: string | null, currency: Currency | null) {
  const known = currency ?? Currency.USD
  const trimmed = dropZeroDecimals(amount?.trim() ?? '', CURRENCIES[known].exponent)
  const minor = parseMoney(trimmed, known)

  return minor !== null && minor > 0 ? trimmed : null
}

// An amount without the zeros past a currency's decimals: "1500.00" with none is "1500"
function dropZeroDecimals(amount: string, exponent: number) {
  const match = /^(\d+)\.(\d+)$/.exec(amount)

  if (!match || match[2]!.length <= exponent || !/^0+$/.test(match[2]!.slice(exponent))) return amount

  return exponent === 0 ? match[1]! : `${match[1]}.${match[2]!.slice(0, exponent)}`
}

function readDay(day: string | null, today: string) {
  if (!day || !isCalendarDay(day)) return today

  return day >= FIRST_BILL_DAY && day <= addCalendarDays(today, BILL_DAYS_AHEAD) ? day : today
}

export default readBillReceiptFields
