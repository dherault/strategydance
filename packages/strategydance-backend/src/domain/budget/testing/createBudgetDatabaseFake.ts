import { BILL_RECEIPT_CONTENT_TYPES, MAX_BILL_RECEIPT_NAME_LENGTH, MAX_BILL_RECEIPT_SIZE } from 'strategydance-core'

import type { AnyVariables, ModuleDatabaseFakeBase } from '~domain/modules/testing/createModuleDatabaseFakeBase'

export const BillReceiptStatus = {
  UPLOADING: 'UPLOADING',
  READY: 'READY',
} as const

export type FakeBillReceipt = {
  id: string
  organizationId: string
  // Null once its uploader's account went
  userId: string | null
  status: (typeof BillReceiptStatus)[keyof typeof BillReceiptStatus]
  name: string
  contentType: string
  size: number
  createdAt: string
}

// What the backend's operations read of a bill: whether it holds a receipt, and whether it is deleted
export type FakeBill = {
  id: string
  organizationId: string
  receiptId: string | null
  deletedAt: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/*
  The Budget's tables for the tests, added to a module fake's base, as the Tasks module's are: the
  receipts, and as much of the bills as the backend's operations read. Each operation keeps its
  connector namesake's conditions and messages, which `check:budget` checks against the emulators, so
  the two stay alike
*/
function createBudgetDatabaseFake<Base extends ModuleDatabaseFakeBase>(base: Base) {
  const { stamp, id, hasMember } = base
  const receipts = new Map<string, FakeBillReceipt>()
  const bills = new Map<string, FakeBill>()

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
    const bill: FakeBill = { id: id(crypto.randomUUID()), receiptId: null, deletedAt: null, ...fields }

    bill.id = id(bill.id)
    bill.organizationId = id(bill.organizationId)
    bill.receiptId = bill.receiptId === null ? null : id(bill.receiptId)
    bills.set(bill.id, bill)

    return bill
  }

  // Whether a receipt is the caller's, in the organization named, as the operations match it
  function isOwnReceipt(receipt: FakeBillReceipt | undefined, variables: AnyVariables): receipt is FakeBillReceipt {
    return receipt?.userId === variables.userId && receipt?.organizationId === id(variables.organizationId)
  }

  // The enum the generated SDK exports, which the domain reads a status against
  base.sdk.BillReceiptStatus = BillReceiptStatus

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

  base.onReset(() => {
    receipts.clear()
    bills.clear()
  })

  return Object.assign(base, { receipts, bills, insertReceipt, insertBill })
}

export type BudgetDatabaseFake = ReturnType<typeof createBudgetDatabaseFake<ModuleDatabaseFakeBase>>

export default createBudgetDatabaseFake
