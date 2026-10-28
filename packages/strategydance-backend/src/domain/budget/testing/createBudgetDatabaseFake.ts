import {
  BILL_RECEIPT_CONTENT_TYPES,
  type BillRecurrence,
  type BudgetPeriod,
  type Currency,
  CURRENCIES,
  MAX_AGENT_BILL_RECEIPT_SIZE,
  MAX_BILL_COMPANY_LENGTH,
  MAX_BILL_DESCRIPTION_LENGTH,
  MAX_BILL_NAME_LENGTH,
  MAX_BILL_RECEIPT_NAME_LENGTH,
  MAX_BILL_RECEIPT_SIZE,
  MAX_BILLS,
  MAX_DAILY_RECEIPT_READS_PER_MEMBER,
  MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION,
  MAX_MONEY_MINOR,
} from 'strategydance-core'

import { BILL_RECEIPT_READ_CLAIM_MS } from '~domain/budget/billReceiptReadSettings'
import type { AnyVariables, ModuleDatabaseFakeBase } from '~domain/modules/testing/createModuleDatabaseFakeBase'

export const BillReceiptStatus = {
  UPLOADING: 'UPLOADING',
  READY: 'READY',
} as const

// The enums the generated SDK exports, which the domain crosses core's values into
const DatabaseCurrency = Object.fromEntries(Object.keys(CURRENCIES).map(code => [code, code]))
const DatabaseBillRecurrence = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
} as const
const DatabaseBudgetPeriod = { MONTHLY: 'MONTHLY', QUARTERLY: 'QUARTERLY', YEARLY: 'YEARLY' } as const

export type FakeBillReceipt = {
  id: string
  organizationId: string
  // Null once its uploader's account went
  userId: string | null
  status: (typeof BillReceiptStatus)[keyof typeof BillReceiptStatus]
  name: string
  contentType: string
  size: number
  // When the receipt reader claimed it, and what its read found, as JSON text
  readAt: string | null
  readFields: string | null
  createdAt: string
}

// A bill, as its table keeps it, its amount a number of minor units
export type FakeBill = {
  id: string
  organizationId: string
  name: string
  description: string
  company: string
  amountMinor: number
  currency: Currency
  paidOn: string
  recurrence: BillRecurrence | null
  endsOn: string | null
  paidById: string | null
  receiptId: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// An organization's budget: its currency always, its amount and period both or neither
export type FakeBudget = {
  currency: Currency
  amountMinor: number | null
  period: BudgetPeriod | null
}

const DAY_MS = 24 * 60 * 60 * 1000

// The operations' bound on a first payment, ten years after the database's clock: 87672 hours
const BILL_HOURS_AHEAD = 87672

// A name or a company: one line with no space at either end, as the operations' pattern holds it
const ONE_LINE_PATTERN = /^\S(.*\S)?$/

/*
  The Budget's tables for the tests, added to a module fake's base, as the Tasks module's are: the
  budgets, the bills, their receipts and the exchange rates, with the members' time zones. Each
  operation keeps its connector namesake's conditions and messages, in the same order, which
  `check:budget` and `check:budget-module` check against the emulators, so the two stay alike
*/
function createBudgetDatabaseFake<Base extends ModuleDatabaseFakeBase>(base: Base) {
  const { stamp, id, hasMember, isMember, membersOf, insertResult, storeResult, checkKey } = base
  const receipts = new Map<string, FakeBillReceipt>()
  const bills = new Map<string, FakeBill>()
  // Each organization's budget, by its id, the members' time zones, by their uid, the members' names,
  // which a payer who left keeps, and the rates, by currency and year, as the ECB's JSON text
  const budgets = new Map<string, FakeBudget>()
  const timezones = new Map<string, string>()
  const names = new Map<string, string>()
  const rateYears = new Map<string, string>()
  // An organization's name, which the receipt reader quotes, by its id, and the accounts and
  // organizations whose conversations staff suspended, which the reader's route refuses too
  const organizationNames = new Map<string, string>()
  const suspended = new Set<string>()

  // Declared here rather than read off the base, so a call narrows what follows it
  function refuse(message: string): never {
    throw new Error(message)
  }

  function isHeld(receiptId: string) {
    return [...bills.values()].some(bill => bill.receiptId === receiptId)
  }

  // Whether the sweep deletes a receipt: no bill holds it, deleted bills included, and it is over two
  // days old
  function isPrunable(receipt: FakeBillReceipt) {
    return !isHeld(receipt.id) && Date.parse(receipt.createdAt) < Date.now() - 2 * DAY_MS
  }

  // A receipt written straight into its table, as an upload would have stored it
  function insertReceipt(fields: Partial<FakeBillReceipt> & { organizationId: string; userId: string | null }) {
    const receipt: FakeBillReceipt = {
      id: id(crypto.randomUUID()),
      status: BillReceiptStatus.READY,
      name: 'Invoice.pdf',
      contentType: 'application/pdf',
      size: 1000,
      readAt: null,
      readFields: null,
      createdAt: stamp(),
      ...fields,
    }

    receipt.id = id(receipt.id)
    receipt.organizationId = id(receipt.organizationId)
    receipts.set(receipt.id, receipt)

    return receipt
  }

  // A bill written straight into its table, as a page would have stored it
  function insertBill(fields: Partial<FakeBill> & { organizationId: string }) {
    const createdAt = stamp()
    const bill: FakeBill = {
      id: id(crypto.randomUUID()),
      name: 'Figma',
      description: '',
      company: 'Figma',
      amountMinor: 1500,
      currency: 'USD',
      paidOn: '2026-01-15',
      recurrence: null,
      endsOn: null,
      paidById: null,
      receiptId: null,
      createdById: null,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      ...fields,
    }

    bill.id = id(bill.id)
    bill.organizationId = id(bill.organizationId)
    bill.receiptId = bill.receiptId === null ? null : id(bill.receiptId)
    bills.set(bill.id, bill)

    return bill
  }

  // A member's save landing in between, which moves the bill's `updatedAt`
  function changeBill(billId: string, fields: Partial<FakeBill> = {}) {
    const bill = bills.get(id(billId))

    if (!bill) throw new Error(`No bill ${billId}`)

    Object.assign(bill, fields, { updatedAt: stamp() })

    return bill
  }

  function setBudget(organizationId: string, budget: FakeBudget) {
    budgets.set(id(organizationId), budget)
  }

  function setTimezone(userId: string, timezone: string) {
    timezones.set(userId, timezone)
  }

  // An account's name, which its memberships' fall back to and a payer who left keeps
  function setName(userId: string, name: string) {
    names.set(userId, name)
  }

  // A year of a currency's rates, units to one euro by ECB day
  function insertRates(currency: Currency, year: number, rates: Record<string, number>) {
    rateYears.set(`${currency}:${year}`, JSON.stringify(rates))
  }

  // A user's name, from their account, else from any of their memberships
  function nameOf(userId: string | null) {
    if (userId === null) return null

    const named = names.get(userId)

    if (named !== undefined) return named

    for (const [key, membership] of base.memberships) {
      if (key.startsWith(`${userId}:`) && membership.displayName !== null) return membership.displayName
    }

    return null
  }

  // The live bills of an organization, by when they were added, as the reads order them
  function liveBillsOf(organizationId: unknown) {
    return [...bills.values()]
      .filter(bill => bill.organizationId === id(organizationId) && bill.deletedAt === null)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1))
  }

  function toBillRow(bill: FakeBill) {
    return {
      id: bill.id,
      name: bill.name,
      description: bill.description,
      company: bill.company,
      amountMinor: String(bill.amountMinor),
      currency: bill.currency,
      paidOn: bill.paidOn,
      recurrence: bill.recurrence,
      endsOn: bill.endsOn,
      paidById: bill.paidById,
      paidBy: bill.paidById === null ? null : { displayName: nameOf(bill.paidById) },
      updatedAt: bill.updatedAt,
    }
  }

  // A bill's fields checked as `CreateBill` and the agent's operations check them, with their messages
  function checkBillVariables(variables: AnyVariables) {
    const name = String(variables.name)
    const company = String(variables.company)
    const amountMinor = Number(variables.amountMinor)
    const paidOn = String(variables.paidOn)

    if (
      !(
        [...name].length <= MAX_BILL_NAME_LENGTH
        && ONE_LINE_PATTERN.test(name)
        && [...company].length <= MAX_BILL_COMPANY_LENGTH
        && ONE_LINE_PATTERN.test(company)
        && [...String(variables.description)].length <= MAX_BILL_DESCRIPTION_LENGTH
      )
    ) {
      refuse(
        "A bill's name and company are one line of at most 80 and 60 characters, with no space at either end, and its description at most 140 characters",
      )
    }

    if (!(amountMinor >= 1 && amountMinor <= MAX_MONEY_MINOR)) refuse("A bill's amount is 1 to 10^15 minor units")

    if (paidOn < '1999-01-01' || Date.parse(paidOn) > Date.now() + BILL_HOURS_AHEAD * 60 * 60 * 1000) {
      refuse('A bill is paid from 1999 to ten years ahead')
    }

    if (variables.endsOn != null && (variables.recurrence == null || variables.endsOn < paidOn)) {
      refuse('A bill ends only when it recurs, on or after its first payment')
    }
  }

  // Whether a receipt is one a bill may take: `READY`, the caller's, under two days old and held by
  // no bill, as `CreateBill` takes one, or, for an update, the bill's own already
  function isAttachable(variables: AnyVariables, billId?: string) {
    if (variables.receiptId == null) return true

    const receipt = receipts.get(id(variables.receiptId))

    if (!receipt || receipt.organizationId !== id(variables.organizationId)) return false
    if (billId !== undefined && bills.get(billId)?.receiptId === receipt.id) return true

    return (
      receipt.status === BillReceiptStatus.READY
      && receipt.userId === variables.userId
      && Date.parse(receipt.createdAt) > Date.now() - 2 * DAY_MS
      && !isHeld(receipt.id)
    )
  }

  function writeBillVariables(bill: FakeBill, variables: AnyVariables) {
    Object.assign(bill, {
      name: String(variables.name),
      description: String(variables.description),
      company: String(variables.company),
      amountMinor: Number(variables.amountMinor),
      currency: variables.currency,
      paidOn: String(variables.paidOn),
      recurrence: variables.recurrence ?? null,
      endsOn: variables.endsOn ?? null,
      paidById: String(variables.paidById),
      receiptId: variables.receiptId == null ? null : id(variables.receiptId),
    })
  }

  // Whether a receipt is the caller's, in the organization named, as the operations match it
  function isOwnReceipt(receipt: FakeBillReceipt | undefined, variables: AnyVariables): receipt is FakeBillReceipt {
    return receipt?.userId === variables.userId && receipt?.organizationId === id(variables.organizationId)
  }

  // The receipts the reader claimed in the last 24 hours but the one asked for, the caller's in the
  // organization or the organization's, newest first, as `ClaimBillReceiptRead` counts them
  function listReads(variables: AnyVariables, { isMember }: { isMember: boolean }) {
    return [...receipts.values()]
      .filter(
        receipt =>
          receipt.organizationId === id(variables.organizationId)
          && (!isMember || receipt.userId === variables.userId)
          && receipt.id !== id(variables.receiptId)
          && receipt.readAt !== null
          && Date.parse(receipt.readAt) > Date.now() - DAY_MS,
      )
      .sort((a, b) => (a.readAt! < b.readAt! ? 1 : -1))
      .slice(0, isMember ? MAX_DAILY_RECEIPT_READS_PER_MEMBER : MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION)
  }

  // The enums the generated SDK exports, which the domain reads a status against and crosses core's
  // values into
  base.sdk.BillReceiptStatus = BillReceiptStatus
  base.sdk.Currency = DatabaseCurrency
  base.sdk.BillRecurrence = DatabaseBillRecurrence
  base.sdk.BudgetPeriod = DatabaseBudgetPeriod

  base.addOperations({
    ReserveBillReceipt: variables => {
      const name = String(variables.name)
      // In code points, as CEL's `size` counts them
      const nameLength = [...name].length

      if (!hasMember(variables)) refuse('Only a member of an organization can upload a receipt to it')

      if (
        !(
          nameLength >= 1
          && nameLength <= MAX_BILL_RECEIPT_NAME_LENGTH
          && !/[\r\n]/.test(name)
          && variables.size >= 1
          && variables.size <= MAX_BILL_RECEIPT_SIZE
          && BILL_RECEIPT_CONTENT_TYPES.includes(variables.contentType)
        )
      ) {
        refuse('A receipt has a name on one line of at most 200 characters, a type a bill takes, and at most 10 MiB')
      }

      if (receipts.has(id(variables.receiptId))) refuse('violates SQL unique constraint: bill_receipt_pkey')

      insertReceipt({
        id: id(variables.receiptId),
        organizationId: id(variables.organizationId),
        userId: String(variables.userId),
        status: BillReceiptStatus.UPLOADING,
        name,
        contentType: String(variables.contentType),
        size: Number(variables.size),
      })

      return { billReceipt_insert: { id: id(variables.receiptId) } }
    },

    CompleteBillReceiptUpload: variables => {
      const receipt = receipts.get(id(variables.receiptId))

      if (!isOwnReceipt(receipt, variables) || receipt.status !== BillReceiptStatus.UPLOADING) {
        refuse('The receipt is no longer being uploaded')
      }

      receipt.status = BillReceiptStatus.READY

      return { billReceipt_updateMany: 1 }
    },

    GetBillReceiptForMember: variables => {
      const receipt = receipts.get(id(variables.receiptId))

      return {
        userOrganization: hasMember(variables) ? { role: 'MEMBER' } : null,
        billReceipt: receipt
          ? {
              organizationId: receipt.organizationId,
              userId: receipt.userId,
              status: receipt.status,
              name: receipt.name,
              contentType: receipt.contentType,
              size: receipt.size,
              createdAt: receipt.createdAt,
            }
          : null,
      }
    },

    GetBillReceiptForReader: variables => {
      const receipt = receipts.get(id(variables.receiptId))
      const organizationId = id(variables.organizationId)

      return {
        userOrganization: hasMember(variables)
          ? { role: 'MEMBER', organization: { name: organizationNames.get(organizationId) ?? 'Acme Studio' } }
          : null,
        billReceipt: receipt
          ? {
              organizationId: receipt.organizationId,
              userId: receipt.userId,
              status: receipt.status,
              name: receipt.name,
              contentType: receipt.contentType,
              size: receipt.size,
              readAt: receipt.readAt,
              readFields: receipt.readFields,
            }
          : null,
      }
    },

    GetBillReceiptReads: variables => ({
      memberReads: listReads(variables, { isMember: true }).map(({ id, readAt }) => ({ id, readAt })),
      organizationReads: listReads(variables, { isMember: false }).map(({ id, readAt }) => ({ id, readAt })),
    }),

    ClaimBillReceiptRead: variables => {
      const isCapped = variables.isUsageCapped !== false
      const receipt = receipts.get(id(variables.receiptId))

      if (!hasMember(variables)) refuse('Only a member of an organization can have its receipts read')

      if (isCapped && listReads(variables, { isMember: true }).length >= MAX_DAILY_RECEIPT_READS_PER_MEMBER) {
        refuse('Somebody has at most 50 receipts read in 24 hours in an organization')
      }

      if (isCapped && listReads(variables, { isMember: false }).length >= MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION) {
        refuse('An organization has at most 200 receipts read in 24 hours')
      }

      if (
        !isOwnReceipt(receipt, variables)
        || receipt.status !== BillReceiptStatus.READY
        || !(
          receipt.readAt === null
          || (receipt.readFields === null && Date.parse(receipt.readAt) < Date.now() - BILL_RECEIPT_READ_CLAIM_MS)
        )
      ) {
        refuse('The receipt is being read, or was read already')
      }

      receipt.readAt = stamp()

      return { billReceipt_updateMany: 1 }
    },

    RecordBillReceiptRead: variables => {
      const receipt = receipts.get(id(variables.receiptId))
      const readFields = String(variables.readFields)

      if (!isOwnReceipt(receipt, variables) || receipt.readAt === null || receipt.readFields !== null) {
        refuse('The receipt is no longer being read')
      }

      if ([...readFields].length > 2000) refuse("What a receipt's read found fits in 2000 characters")

      receipt.readFields = readFields

      return { billReceipt_updateMany: 1 }
    },

    ReleaseBillReceiptRead: variables => {
      const receipt = receipts.get(id(variables.receiptId))

      if (!isOwnReceipt(receipt, variables) || receipt.readFields !== null) return { billReceipt_updateMany: 0 }

      receipt.readAt = null

      return { billReceipt_updateMany: 1 }
    },

    // The suspension `conversationsSuspensionMiddleware` reads, which the reader's route mounts
    GetConversationsSuspension: variables => ({
      user: { conversationsSuspendedAt: suspended.has(String(variables.userId)) ? stamp() : null },
      organization: { conversationsSuspendedAt: suspended.has(id(variables.organizationId)) ? stamp() : null },
    }),

    PruneDeletedBills: () => {
      let deleted = 0

      for (const bill of bills.values()) {
        if (bill.deletedAt !== null && Date.parse(bill.deletedAt) < Date.now() - DAY_MS) {
          bills.delete(bill.id)
          deleted++
        }
      }

      return { bill_deleteMany: deleted }
    },

    GetPrunableBillReceipts: () => ({
      billReceipts: [...receipts.values()]
        .filter(isPrunable)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .slice(0, 100)
        .map(receipt => ({ id: receipt.id, organizationId: receipt.organizationId })),
    }),

    DeleteBillReceipts: variables => {
      let deleted = 0

      for (const receiptId of variables.ids as string[]) {
        const receipt = receipts.get(id(receiptId))

        if (receipt && isPrunable(receipt)) {
          receipts.delete(receipt.id)
          deleted++
        }
      }

      return { billReceipt_deleteMany: deleted }
    },
  })

  // The Budget module's operations, in their connector's order of checks
  base.addOperations({
    GetBudgetForAgent: variables => {
      const isCaller = isMember(variables)
      const budget = budgets.get(id(variables.organizationId))

      return {
        membership: isCaller
          ? [{ userId: variables.userId, user: { timezone: timezones.get(variables.userId) ?? null } }]
          : [],
        budgets:
          isCaller && budget
            ? [
                {
                  currency: budget.currency,
                  amountMinor: budget.amountMinor === null ? null : String(budget.amountMinor),
                  period: budget.period,
                },
              ]
            : [],
        members: isCaller
          ? membersOf(variables.organizationId).map(member => ({
              userId: member.userId,
              user: { displayName: member.displayName ?? nameOf(member.userId) },
            }))
          : [],
        bills: isCaller
          ? liveBillsOf(variables.organizationId)
              .slice(0, MAX_BILLS)
              .map(bill => ({ ...toBillRow(bill), receiptId: bill.receiptId }))
          : [],
      }
    },

    GetBillForAgent: variables => {
      const isCaller = isMember(variables)
      const bill = bills.get(id(variables.id))
      const budget = budgets.get(id(variables.organizationId))
      const receipt = bill?.receiptId ? receipts.get(bill.receiptId) : undefined

      return {
        membership: isCaller
          ? [{ userId: variables.userId, user: { timezone: timezones.get(variables.userId) ?? null } }]
          : [],
        budgets: isCaller && budget ? [{ currency: budget.currency }] : [],
        bills:
          isCaller && bill && bill.organizationId === id(variables.organizationId)
            ? [
                {
                  ...toBillRow(bill),
                  receipt: receipt
                    ? { id: receipt.id, name: receipt.name, contentType: receipt.contentType, size: receipt.size }
                    : null,
                  createdById: bill.createdById,
                  createdBy: bill.createdById === null ? null : { displayName: nameOf(bill.createdById) },
                  createdAt: bill.createdAt,
                  deletedAt: bill.deletedAt,
                },
              ]
            : [],
      }
    },

    GetExchangeRatesForAgent: variables => ({
      exchangeRateYears: [...rateYears.entries()]
        .map(([key, rates]) => {
          const [currency, year] = key.split(':')

          return { currency: currency as Currency, year: Number(year), rates }
        })
        .filter(
          row =>
            (variables.currencies as string[]).includes(row.currency)
            && (variables.years as number[]).includes(row.year),
        ),
    }),

    CreateBillForAgent: variables => {
      if (!base.organizations.has(id(variables.organizationId)))
        refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      checkBillVariables(variables)
      insertResult(variables)

      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')
      if (liveBillsOf(variables.organizationId).length >= MAX_BILLS) refuse('An organization keeps at most 2000 bills')
      if (!hasMember({ userId: variables.paidById, organizationId: variables.organizationId })) {
        refuse('A bill is paid by a member of its organization')
      }
      if (!isAttachable(variables)) refuse('The receipt can no longer be attached to this bill: attach it again')
      if (bills.has(id(variables.id))) refuse('violates SQL unique constraint: bill_pkey')

      storeResult(variables)

      const bill = insertBill({
        id: id(variables.id),
        organizationId: id(variables.organizationId),
        createdById: String(variables.userId),
      })

      writeBillVariables(bill, variables)

      return { bill_insert: { id: bill.id } }
    },

    UpdateBillForAgent: variables => {
      const billId = id(variables.id)
      const bill = bills.get(billId)

      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      checkBillVariables(variables)

      const isPayer =
        hasMember({ userId: variables.paidById, organizationId: variables.organizationId })
        || bill?.paidById === variables.paidById

      if (!isPayer) refuse('A bill is paid by a member of its organization, or by whoever paid it')

      // A receipt another bill holds is refused by this check, as the emulator answers it
      if (!isAttachable(variables, billId))
        refuse('The receipt can no longer be attached to this bill: attach it again')

      insertResult(variables)

      if (
        !bill
        || bill.organizationId !== id(variables.organizationId)
        || bill.deletedAt !== null
        || bill.updatedAt !== variables.updatedAt
      ) {
        refuse('The bill was deleted or changed elsewhere since it was read')
      }

      storeResult(variables)
      writeBillVariables(bill, variables)
      bill.updatedAt = stamp()

      return { bill_updateMany: 1 }
    },

    DeleteBillForAgent: variables => {
      const bill = bills.get(id(variables.id))

      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      insertResult(variables)

      if (!bill || bill.organizationId !== id(variables.organizationId) || bill.deletedAt !== null) {
        refuse('No bill by that id in the organization')
      }

      storeResult(variables)
      bill.deletedAt = stamp()

      return { bill_updateMany: 1 }
    },

    RestoreBillForAgent: variables => {
      const bill = bills.get(id(variables.id))

      if (!base.organizations.has(id(variables.organizationId)))
        refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      insertResult(variables)

      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')
      if (liveBillsOf(variables.organizationId).length >= MAX_BILLS) refuse('An organization keeps at most 2000 bills')

      if (
        !bill
        || bill.organizationId !== id(variables.organizationId)
        || bill.deletedAt === null
        || Date.parse(bill.deletedAt) <= Date.now() - DAY_MS
      ) {
        refuse('The bill is gone for good')
      }

      storeResult(variables)
      bill.deletedAt = null

      return { bill_updateMany: 1 }
    },

    ReserveBillReceiptForAgent: variables => {
      const name = String(variables.name)
      const nameLength = [...name].length

      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      if (
        !(
          nameLength >= 1
          && nameLength <= MAX_BILL_RECEIPT_NAME_LENGTH
          && !/[\r\n]/.test(name)
          && variables.size >= 1
          && variables.size <= MAX_AGENT_BILL_RECEIPT_SIZE
          && BILL_RECEIPT_CONTENT_TYPES.includes(variables.contentType)
        )
      ) {
        refuse('A receipt has a name on one line of at most 200 characters, a type a bill takes, and at most 700 KiB')
      }

      if (receipts.has(id(variables.receiptId))) refuse('violates SQL unique constraint: bill_receipt_pkey')

      insertReceipt({
        id: id(variables.receiptId),
        organizationId: id(variables.organizationId),
        userId: String(variables.userId),
        status: BillReceiptStatus.UPLOADING,
        name,
        contentType: String(variables.contentType),
        size: Number(variables.size),
      })

      return { billReceipt_insert: { id: id(variables.receiptId) } }
    },
  })

  base.onReset(() => {
    receipts.clear()
    bills.clear()
    budgets.clear()
    timezones.clear()
    names.clear()
    rateYears.clear()
    organizationNames.clear()
    suspended.clear()
  })

  return Object.assign(base, {
    receipts,
    bills,
    budgets,
    timezones,
    rateYears,
    organizationNames,
    suspended,
    insertReceipt,
    insertBill,
    changeBill,
    setBudget,
    setTimezone,
    setName,
    insertRates,
  })
}

export type BudgetDatabaseFake = ReturnType<typeof createBudgetDatabaseFake<ModuleDatabaseFakeBase>>

export default createBudgetDatabaseFake
