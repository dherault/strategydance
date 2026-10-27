import { notFound, useNavigate, useSearch } from '@tanstack/react-router'
import { type ReactNode, useEffect, useState } from 'react'

import useBills from '~hooks/budget/useBills'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

type Props = {
  billId: string
  children: ReactNode
}

/*
  Lets through an address naming one of the organization's bills. Under the Budget page's waiter,
  so the bills are read by the time it judges. One naming no bill as it opens is a page that does
  not exist; one deleted while it is open, by another member or its own dialog, goes back to the
  page, on the tab it lay over. While the bills could not be read it shows nothing, the page under
  it saying so
*/
function BillBouncer({ billId, children }: Props) {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/_app/$organizationSlug/budget/$billId' })
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: bills, hasFailed } = useBills()

  const isThere = bills.some(({ id }) => id === billId)
  // Whether the bill was there as the address opened, which tells a wrong address from a deletion
  const [wasThere] = useState(isThere)
  const isGone = wasThere && !isThere && !hasFailed
  const view = search.view ?? 'bills'

  useEffect(() => {
    if (!isGone) return

    navigate({
      to: '/$organizationSlug/budget',
      params: { organizationSlug },
      search: { view: view === 'expenses' ? undefined : view },
      replace: true,
      resetScroll: false,
    })
  }, [isGone, organizationSlug, view, navigate])

  if (!wasThere && !hasFailed) throw notFound()

  if (isGone || hasFailed) return null

  return children
}

export default BillBouncer
