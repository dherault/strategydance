// What `CreateBill` and `UpdateBill` refuse a receipt with once it can no longer be attached, and a
// bill past the organization's 2000 with, in strategydance-database's web connector: change each
// with its check
const RECEIPT_REFUSAL = 'attach it again'
const CAPACITY_REFUSAL = 'An organization keeps at most 2000 bills'

// Why a save was refused, when it is something the bill's dialog says: a receipt to attach again,
// or the organization holding every bill it may
type BillSaveRefusal = 'receipt' | 'full'

function readBillSaveRefusal(error: unknown): BillSaveRefusal | null {
  if (!(error instanceof Error)) return null
  if (error.message.includes(RECEIPT_REFUSAL)) return 'receipt'
  if (error.message.includes(CAPACITY_REFUSAL)) return 'full'

  return null
}

export { type BillSaveRefusal }

export default readBillSaveRefusal
