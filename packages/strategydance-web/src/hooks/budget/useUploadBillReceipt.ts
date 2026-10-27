import { useQueryClient } from '@tanstack/react-query'
import type { BillReceiptData } from 'strategydance-core'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getBillReceiptQueryKey from '~utils/budget/getBillReceiptQueryKey'
import readBillReceiptFile from '~utils/budget/readBillReceiptFile'

import { uploadApiFile } from '~data/api'

type BillReceiptUpload = {
  // Made by the browser, and kept for every try of the same upload, which the backend stores once
  receiptId: string
  name: string
  contentType: string
  file: Blob
  // Told the share of the file sent so far, from 0 to 1
  onProgress: (share: number) => void
  signal: AbortSignal
}

/*
  Uploads a receipt the reader attaches to a bill, before the bill is saved. The backend reserves
  the receipt's row before it reads a byte, checks the file is what its type says, and answers once
  it is stored. Its name travels URL-encoded in a header, so any character does. The bytes are left
  where the receipt's dialog reads them, so viewing it reads nothing back.

  It goes up as the account that attached it, the one signed in when this was drawn: a receipt
  whose upload starts after a sign-out, another account signed in since, is refused
*/
function useUploadBillReceipt() {
  const queryClient = useQueryClient()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null

  return async function uploadBillReceipt({
    receiptId,
    name,
    contentType,
    file,
    onProgress,
    signal,
  }: BillReceiptUpload) {
    if (!organizationId || !viewerId) throw new Error('Nobody is signed in, or no organization is current')

    // Typed as the receipt goes up, whatever type the browser gave the file, without a copy
    const typed = file.slice(0, file.size, contentType)
    const receipt = await uploadApiFile<BillReceiptData>({
      method: 'PUT',
      path: `/organizations/${organizationId}/budget/receipts/${receiptId}`,
      file: typed,
      headers: { 'X-File-Name': encodeURIComponent(name) },
      onProgress,
      userId: viewerId,
      signal,
    })

    queryClient.setQueryData(
      getBillReceiptQueryKey(organizationId, receipt.id, viewerId),
      await readBillReceiptFile(typed),
    )

    return receipt
  }
}

export default useUploadBillReceipt
