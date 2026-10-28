import type { BillFormValues } from '~utils/budget/toBillFormValues'

/*
  What a changed field means only beside: an amount is typed in its currency, which names its sum,
  and a recurrence or an end holds only while the bill recurs, so laid over a bill somebody else
  stopped, it would be hidden behind the switch and dropped on the next save. The switch needs
  neither, so turning it alone keeps the recurrence and the end somebody else picked
*/
const BILL_FIELD_PARTNERS: Partial<Record<keyof BillFormValues, (keyof BillFormValues)[]>> = {
  amount: ['currency'],
  currency: ['amount'],
  recurrence: ['isRecurring'],
  endsOn: ['isRecurring'],
}

/*
  The fields of a bill's dialog the reader changed since it read the bill: those whose value is no
  longer what the dialog started from, each a string, a boolean or null, so compared as they are,
  with the fields each of them means something only beside
*/
function listChangedBillFields(read: BillFormValues, typed: BillFormValues) {
  const fields = Object.keys(typed) as (keyof BillFormValues)[]
  const changed = fields.filter(field => typed[field] !== read[field])
  const laid = new Set(changed.flatMap(field => [field, ...(BILL_FIELD_PARTNERS[field] ?? [])]))

  return fields.filter(field => laid.has(field))
}

export default listChangedBillFields
