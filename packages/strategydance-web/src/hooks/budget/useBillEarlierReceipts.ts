import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import type { BillReceiptData } from 'strategydance-core'
import { getBillEarlierReceiptsRef } from 'strategydance-database/web'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const NO_RECEIPTS: BillReceiptData[] = []

/*
  A bill's earlier receipts, which an edit replaced or removed and the bill keeps until it is
  pruned, newest first, for its dialog to take one back. Read each time the dialog opens rather than
  kept live: the save that lets a receipt go closes the dialog. Nothing while they load, or should
  the read fail, since the dialog works without them
*/
function useBillEarlierReceipts(billId: string | null) {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data } = useQuery({
    queryKey: ['GetBillEarlierReceipts', organizationId, billId],
    queryFn: async () => {
      const { data: result } = await executeQuery(
        getBillEarlierReceiptsRef(dataConnect, { organizationId: organizationId!, billId: billId! }),
      )

      return result
    },
    enabled: Boolean(organizationId && billId),
  })

  return data?.billReceipts ?? NO_RECEIPTS
}

export default useBillEarlierReceipts
