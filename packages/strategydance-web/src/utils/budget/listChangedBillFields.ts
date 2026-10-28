import type { BillFormValues } from '~utils/budget/toBillFormValues'

/*
  The fields that mean something only together: an amount is typed in its currency, and a
  recurrence and its end hold only while the bill recurs, so one laid over another's change to its
  partner would name another sum, or a schedule hidden and dropped on the next save
*/
const BILL_FIELD_GROUPS: (keyof BillFormValues)[][] = [
  ['amount', 'currency'],
  ['isRecurring', 'recurrence', 'endsOn'],
]

/*
  The fields of a bill's dialog the reader changed since it read the bill: those whose value is no
  longer what the dialog started from, each a string, a boolean or null, so compared as they are,
  with the whole group of any of them that goes with others
*/
function listChangedBillFields(read: BillFormValues, typed: BillFormValues) {
  const fields = Object.keys(typed) as (keyof BillFormValues)[]
  const changed = new Set(fields.filter(field => typed[field] !== read[field]))

  for (const group of BILL_FIELD_GROUPS) {
    if (group.some(field => changed.has(field))) for (const field of group) changed.add(field)
  }

  return fields.filter(field => changed.has(field))
}

export default listChangedBillFields
