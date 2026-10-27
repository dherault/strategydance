import {
  ERROR_CODE_CONVERSATIONS_SUSPENDED,
  ERROR_CODE_EMAIL_NOT_VERIFIED,
  ERROR_CODE_RECEIPT_READS_CAPPED,
} from 'strategydance-core'

import { ApiError } from '~data/api'

/*
  Why a receipt could not be read, as the upload dialog answers it: at the reader's daily caps, for
  an address not confirmed yet, or for a member whose conversations staff suspended, each of which
  asking again would not change, so the bill's form opens empty with the receipt attached; or a read
  that failed otherwise, which the member can ask again
*/
type BillReceiptReadFailure = 'capped' | 'unverified' | 'suspended' | 'failed'

function readBillReceiptReadFailure(error: unknown): BillReceiptReadFailure {
  const code = error instanceof ApiError ? error.code : null

  if (code === ERROR_CODE_RECEIPT_READS_CAPPED) return 'capped'
  if (code === ERROR_CODE_EMAIL_NOT_VERIFIED) return 'unverified'
  if (code === ERROR_CODE_CONVERSATIONS_SUSPENDED) return 'suspended'

  return 'failed'
}

export { type BillReceiptReadFailure }

export default readBillReceiptReadFailure
