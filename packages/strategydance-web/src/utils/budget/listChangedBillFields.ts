import type { BillFormValues } from '~utils/budget/toBillFormValues'

/*
  The fields of a bill's dialog the reader changed since it read the bill: those whose value is no
  longer what the dialog started from, each a string, a boolean or null, so compared as they are
*/
function listChangedBillFields(read: BillFormValues, typed: BillFormValues) {
  return (Object.keys(typed) as (keyof BillFormValues)[]).filter(field => typed[field] !== read[field])
}

export default listChangedBillFields
