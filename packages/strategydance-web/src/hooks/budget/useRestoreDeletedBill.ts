import { useRestoreBill as useRestoreBillMutation } from 'strategydance-database/web/react'

import useReloadBills from '~hooks/budget/useReloadBills'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  Brings a bill deleted within a day back, its receipt with it, as `RestoreBill` does, then reads the
  bills again from the server, so the Bills tab and a conversation's thread show it back at once
  rather than once the live query pushes it. Throws when the restore is refused, past the day or at
  the organization's 2000 bills, for its caller to say so
*/
function useRestoreDeletedBill() {
  const { organization } = useCurrentOrganization()
  const { mutateAsync: restoreBill } = useRestoreBillMutation(dataConnect)
  const reloadBills = useReloadBills()

  const organizationId = organization?.id ?? null

  return async function restoreDeletedBill(id: string) {
    await restoreBill({ organizationId: organizationId!, id })

    reloadBills().catch((error: unknown) => console.error('Failed to read the bills again', error))
  }
}

export default useRestoreDeletedBill
