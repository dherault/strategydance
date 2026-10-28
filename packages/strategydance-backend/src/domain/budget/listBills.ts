import {
  addCalendarDays,
  BILL_DAYS_AHEAD,
  type Currency,
  FIRST_BILL_DAY,
  getLastBillPayment,
  isBillActive,
  listBillPayments,
  listExchangeRateYears,
} from 'strategydance-core'
import { z } from 'zod'

import type { AgentBill, BudgetRefusal, ModuleBill, ModuleCaller } from '~types'

import { BILL_LIST_PAGE_LENGTH, BILL_LIST_PAGE_SIZE, UUID_PATTERN } from '~constants'

import decodeCursor from '~utils/decodeCursor'
import encodeCursor from '~utils/encodeCursor'

import parseBillPayer from '~domain/budget/parseBillPayer'
import readBudgetRates from '~domain/budget/readBudgetRates'
import readBudgetState from '~domain/budget/readBudgetState'
import toModuleBill from '~domain/budget/toModuleBill'
import recordModuleSearch from '~domain/modules/recordModuleSearch'

// What a cursor holds: the last bill's last payment and its id, which the next page starts after
const cursorSchema = z.object({
  day: z.iso.date(),
  id: z.string().regex(UUID_PATTERN),
})

// Room kept in a page's budget for its cursor, which is written once the page is cut
const CURSOR_ROOM = 200

type ListBillsInput = {
  // Words each of which a bill's name, description or company holds, whatever its case
  query?: string
  // A payment between them, both included
  paidFrom?: string
  paidTo?: string
  // `"me"`, or a member as `member:<id>`
  paidBy?: string
  recurring?: boolean
  active?: boolean
  limit?: number
  cursor?: string
}

// A page of the bills, as `list_bills` answers it
export type ListedBillsPage = {
  bills: ModuleBill[]
  total: number
  budgetCurrency: Currency
  nextCursor?: string
}

type ListBillsResult = { outcome: 'listed'; page: ListedBillsPage } | BudgetRefusal

// A bill beside its last payment, which the list is ordered by
type PlacedBill = { bill: AgentBill; day: string }

/*
  A page of the live bills, by last payment, the latest first, as the Bills tab orders them, then by
  id, so two bills paid on one day are neither skipped nor repeated across a page's end. Up to 50 and
  40000 characters of JSON, with `total` and a cursor while more remain.

  A query matches every word of it, whatever its case, in a bill's name, description or company.
  `paidFrom` and `paidTo` keep the bills with a payment between them, either end alone reaching back
  to 1999 or ahead ten years; `active` the subscriptions with a payment still to come, or, false,
  every other bill. An external agent's query draws on the member's search allowance first, each
  page of it, as `list_tasks`' does, and is refused past it. The query is never logged
*/
async function listBills(
  caller: ModuleCaller,
  { query, paidFrom, paidTo, paidBy, recurring, active, limit = BILL_LIST_PAGE_SIZE, cursor }: ListBillsInput,
  toAddress: (billId: string) => Promise<string | undefined>,
): Promise<ListBillsResult> {
  const after = cursor === undefined ? null : decodeCursor(cursor, cursorSchema)

  if (cursor !== undefined && !after) return { outcome: 'invalidCursor' }

  if (query !== undefined) {
    const recorded = await recordModuleSearch(caller)

    if (recorded.outcome !== 'recorded') return recorded
  }

  const read = await readBudgetState(caller)

  if (read.outcome !== 'read') return read

  const { bills, currency, today } = read.state
  const words = query?.toLowerCase().split(/\s+/).filter(Boolean) ?? []
  const payerId = paidBy === undefined ? undefined : parseBillPayer(paidBy, caller)
  const isDated = paidFrom !== undefined || paidTo !== undefined
  const from = paidFrom ?? FIRST_BILL_DAY
  const to = paidTo ?? addCalendarDays(today, BILL_DAYS_AHEAD)
  const listed = bills
    .filter(bill => {
      const text = `${bill.name}\n${bill.description}\n${bill.company}`.toLowerCase()

      return (
        words.every(word => text.includes(word))
        && (!isDated || listBillPayments(bill, from, to).length > 0)
        && (payerId === undefined || bill.paidById === payerId)
        && (recurring === undefined || (bill.recurrence !== null) === recurring)
        && (active === undefined || isBillActive(bill, today) === active)
      )
    })
    .map(bill => ({ bill, day: getLastBillPayment(bill, today) }))
    .sort(comparePlacedBills)
  const remaining = after ? listed.filter(placed => comparePlacedBills(placed, after) > 0) : listed
  const { rates } = await readBudgetRates(
    bills.map(bill => bill.currency),
    listExchangeRateYears(bills, today),
    currency,
  )
  const frame = { bills: [], total: listed.length, budgetCurrency: currency }
  const page: ModuleBill[] = []
  let length = JSON.stringify(frame).length + CURSOR_ROOM

  for (const { bill } of remaining) {
    if (page.length === limit) break

    const url = await toAddress(bill.id)
    const entry = { ...toModuleBill(bill, { currency, today, rates }), ...(url && { url }) }
    // Each entry counts with the comma before it
    const entryLength = JSON.stringify(entry).length + 1

    if (page.length > 0 && length + entryLength > BILL_LIST_PAGE_LENGTH) break

    page.push(entry)
    length += entryLength
  }

  const last = page.length > 0 ? remaining[page.length - 1] : undefined

  return {
    outcome: 'listed',
    page: {
      ...frame,
      bills: page,
      ...(last && remaining.length > page.length && { nextCursor: encodeCursor({ day: last.day, id: last.bill.id }) }),
    },
  }
}

// The latest last payment first, then by id
function comparePlacedBills(a: PlacedBill | { day: string; id: string }, b: PlacedBill | { day: string; id: string }) {
  if (a.day !== b.day) return a.day < b.day ? 1 : -1

  const aId = 'bill' in a ? a.bill.id : a.id
  const bId = 'bill' in b ? b.bill.id : b.id

  return aId < bId ? -1 : aId > bId ? 1 : 0
}

export default listBills
