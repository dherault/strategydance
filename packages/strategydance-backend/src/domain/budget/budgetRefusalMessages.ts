// The messages the Budget module's operations refuse with, as each `@check` writes it, which the
// module reads a refusal by
export const FULL_REFUSAL = 'An organization keeps at most'
export const PAYER_REFUSAL = 'A bill is paid by a member of its organization'
export const RECEIPT_REFUSAL = 'The receipt can no longer be attached to this bill'
// The receipt's unique reference, which an update reports before its receipt's check
export const RECEIPT_TAKEN_REFUSAL = 'bill_receiptId_uidx'
export const CHANGED_REFUSAL = 'The bill was deleted or changed elsewhere since it was read'
export const NOT_FOUND_REFUSAL = 'No bill by that id in the organization'
export const GONE_REFUSAL = 'The bill is gone for good'
