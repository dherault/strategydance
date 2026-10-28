import type { BillReceiptReadData } from 'strategydance-core'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

type BillReceiptRead = {
  receiptId: string
  // The reader's today, `YYYY-MM-DD`, which a day the receipt writes without a year resolves against
  today: string
  signal: AbortSignal
}

/*
  Asks Strategy Dance to read a receipt the reader just uploaded, for the upload dialog to fill a new
  bill in with: the fields it found, which the backend keeps, so asking again costs nothing. Refused
  at the reader's daily caps, for an address not confirmed or a suspended member, and when Claude
  answered nothing the bill takes, each with its own code (`readBillReceiptReadFailure`)
*/
function useReadBillReceipt() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function readBillReceipt({ receiptId, today, signal }: BillReceiptRead) {
    if (!organizationId) throw new Error('No organization is current')

    const { fields } = await requestApi<BillReceiptReadData>({
      method: 'POST',
      path: `/organizations/${organizationId}/budget/receipts/${receiptId}/read`,
      body: { today },
      signal,
    })

    return fields
  }
}

export default useReadBillReceipt
