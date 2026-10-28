import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import type { BillReceiptData } from 'strategydance-core'
import { getBillEarlierReceiptsRef } from 'strategydance-database/web'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const NO_RECEIPTS: BillReceiptData[] = []

/*
  A bill's newest earlier receipts, as many as `count`, which an edit replaced or removed and the
  bill keeps until it is pruned, for its dialog to take one back, and whether it keeps older ones,
  read by asking for one more. Read each time the dialog opens rather than kept live: the save that
  lets a receipt go closes the dialog. Asking for more keeps those read meanwhile. Nothing while
  they load, or should the read fail, since the dialog works without them
*/
function useBillEarlierReceipts(billId: string, count: number) {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data } = useQuery({
    queryKey: ['GetBillEarlierReceipts', organizationId, billId, count],
    queryFn: async () => {
      const { data: result } = await executeQuery(
        getBillEarlierReceiptsRef(dataConnect, { organizationId: organizationId!, billId, limit: count + 1 }),
      )

      return result
    },
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
  })

  const receipts = data?.billReceipts ?? NO_RECEIPTS

  return { receipts: receipts.slice(0, count), hasOlder: receipts.length > count }
}

export default useBillEarlierReceipts
