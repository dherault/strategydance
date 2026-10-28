import { notFound } from '@tanstack/react-router'
import { type ReactNode, useEffect, useState } from 'react'

import useBills from '~hooks/budget/useBills'
import useCloseBill from '~hooks/budget/useCloseBill'

type Props = {
  billId: string
  children: ReactNode
}

/*
  Lets through an address naming one of the organization's bills. Under the Budget page's waiter,
  so the bills are read by the time it judges. One naming no bill as it opens is a page that does
  not exist; one deleted while it is open, by another member or its own dialog, goes back to the
  page, on the tab it lay over, as its dialog closes (`useCloseBill`). While the bills could not be
  read it shows nothing, the page under it saying so, and its route mounts it anew once they are,
  so it judges the bills as read rather than as missing
*/
function BillBouncer({ billId, children }: Props) {
  const close = useCloseBill()
  const { data: bills, hasFailed } = useBills()

  const isThere = bills.some(({ id }) => id === billId)
  // Whether the bill was there as the address opened, which tells a wrong address from a deletion
  const [wasThere] = useState(isThere)
  const isGone = wasThere && !isThere && !hasFailed

  useEffect(() => {
    if (isGone) close()
  }, [isGone, close])

  if (!wasThere && !hasFailed) throw notFound()

  if (isGone || hasFailed) return null

  return children
}

export default BillBouncer
