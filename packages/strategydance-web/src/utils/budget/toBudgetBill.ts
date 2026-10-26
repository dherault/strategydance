import type { GetBillsData } from 'strategydance-database/web'

import type { Bill } from '~types'

/*
  A bill's row as the page computes with it: its amount, which the SDK carries as an `Int64String`,
  becomes a number here, at the edge, exact up to `MAX_MONEY_MINOR`, and the fields a one-time or
  endless bill leaves out become null, as strategydance-core's computations read them
*/
function toBudgetBill(row: GetBillsData['bills'][number]): Bill {
  return {
    ...row,
    amountMinor: Number(row.amountMinor),
    recurrence: row.recurrence ?? null,
    endsOn: row.endsOn ?? null,
  }
}

export default toBudgetBill
