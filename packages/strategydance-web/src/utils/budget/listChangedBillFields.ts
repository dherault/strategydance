import type { BillFormValues } from '~utils/budget/toBillFormValues'

/*
  The fields of a bill's dialog the reader changed since it read the bill: those whose value is no
  longer what the dialog started from, each a string, a boolean or null, so compared as they are.
  The amount and the currency go together, since an amount is typed in its currency: laid over a
  currency somebody else changed, it would name another sum
*/
function listChangedBillFields(read: BillFormValues, typed: BillFormValues) {
  const fields = Object.keys(typed) as (keyof BillFormValues)[]
  const changed = new Set(fields.filter(field => typed[field] !== read[field]))

  if (changed.has('amount') || changed.has('currency')) {
    changed.add('amount')
    changed.add('currency')
  }

  return fields.filter(field => changed.has(field))
}

export default listChangedBillFields
