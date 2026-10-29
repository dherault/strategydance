import { createFileRoute, notFound } from '@tanstack/react-router'

import useBills from '~hooks/budget/useBills'

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
  starts it anew, and the bouncer by whether the bills' first read failed too, so a read retried
  after failing is judged as it lands rather than from the failure
*/
function BillRoute() {
  const { billId } = Route.useParams()
  const { hasFailed } = useBills()

  return (
    <BillBouncer
      key={`${billId}:${hasFailed}`}
      billId={billId}
    >
      <BillDialog
        key={billId}
        billId={billId}
      />
    </BillBouncer>
  )
}
