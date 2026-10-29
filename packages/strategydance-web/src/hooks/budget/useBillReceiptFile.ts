import { useQuery } from '@tanstack/react-query'

import type { BillReceiptFile } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getBillReceiptQueryKey from '~utils/budget/getBillReceiptQueryKey'
import readBillReceiptFile from '~utils/budget/readBillReceiptFile'

import { ApiError, requestApiFile } from '~data/api'

/*
  A bill's receipt, as its dialog draws it: its bytes, read from the backend with the reader's
  token, since nothing else may read them, and a text file's text. Kept, since a receipt never
  changes, and left here by the upload of one just attached, so it is drawn without being read back.
  A receipt the backend says is gone, or not the reader's to read, is kept as none, so neither a
  remount, a focus nor a reconnection asks for it again; any other failure is tried again on `retry`
*/
function useBillReceiptFile(receiptId: string) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)

  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: getBillReceiptQueryKey(organizationId, receiptId, viewerId),
    queryFn: async ({ signal }): Promise<BillReceiptFile | null> => {
      try {
        return await readBillReceiptFile(
          await requestApiFile({ path: `/organizations/${organizationId}/budget/receipts/${receiptId}`, signal }),
        )
      } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null

        throw error
      }
    },
    enabled: isEnabled,
    staleTime: Infinity,
    retry: 2,
  })

  return {
    file: data ?? null,
    isLoading: isEnabled && data === undefined && !isError,
    hasFailed: isEnabled && ((isError && data === undefined) || data === null),
    isRetrying: isFetching && isError,
    retry: () => {
      refetch().catch(() => {})
    },
  }
}

export default useBillReceiptFile
