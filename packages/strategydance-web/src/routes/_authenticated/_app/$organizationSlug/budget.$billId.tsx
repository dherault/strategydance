import { createFileRoute, notFound } from '@tanstack/react-router'

import isBillId from '~utils/budget/isBillId'

import BillBouncer from '~components/budget/BillBouncer'
import BillDialog from '~components/budget/BillDialog'

export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/budget/$billId')({
  beforeLoad: ({ params }) => {
    if (!isBillId(params.billId)) throw notFound()
  },
  component: BillRoute,
})

/*
  A bill of the current organization, open in its dialog over the Budget page, under the page's
  waiter, at an address the Budget module answers with. An address naming no bill is a page that
  does not exist. The bouncer and the dialog are keyed by the bill, so opening another judges it and
  starts it anew
*/
function BillRoute() {
  const { billId } = Route.useParams()

  return (
    <BillBouncer
      key={billId}
      billId={billId}
    >
      <BillDialog
        key={billId}
        billId={billId}
      />
    </BillBouncer>
  )
}
