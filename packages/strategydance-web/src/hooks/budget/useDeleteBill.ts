import { useIntl } from 'react-intl'
import {
  useDeleteBill as useDeleteBillMutation,
  useRestoreBill as useRestoreBillMutation,
} from 'strategydance-database/web/react'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { Bill } from '~types'

import useReloadBills from '~hooks/budget/useReloadBills'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'
import budgetMessages from '~data/intl/messages/budget'

/*
  Deletes a bill, which any member may, then offers to take it back, its receipt with it, which
  `RestoreBill` does within a day. Either failing says so. The bill goes from the table as soon as
  the delete lands, read again from the server rather than waited for
*/
function useDeleteBill() {
  const { formatMessage } = useIntl()
  const { organization } = useCurrentOrganization()
  const { mutateAsync: deleteBill } = useDeleteBillMutation(dataConnect)
  const { mutateAsync: restoreBill } = useRestoreBillMutation(dataConnect)
  const reloadBills = useReloadBills()

  const organizationId = organization?.id ?? null

  function reload() {
    reloadBills().catch((error: unknown) => console.error('Failed to read the bills again', error))
  }

  async function restore(id: string) {
    try {
      await restoreBill({ organizationId: organizationId!, id })
      reload()
    } catch (error) {
      console.error('Failed to restore a bill', error)
      toast.error(formatMessage(budgetMessages.billRestoreFailed))
    }
  }

  return async function remove({ id, name }: Pick<Bill, 'id' | 'name'>) {
    try {
      await deleteBill({ organizationId: organizationId!, id })
    } catch (error) {
      console.error('Failed to delete a bill', error)
      toast.error(formatMessage(budgetMessages.billDeleteFailed))

      return
    }

    reload()
    toast(formatMessage(budgetMessages.billDeleted, { name }), {
      action: { label: formatMessage(budgetMessages.undo), onClick: () => restore(id) },
    })
  }
}

export default useDeleteBill
