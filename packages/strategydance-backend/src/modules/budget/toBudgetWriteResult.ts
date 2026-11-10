import toBudgetRefusal from '~modules/budget/toBudgetRefusal'
import createModuleWriteResult from '~modules/createModuleWriteResult'

/*
  What a write answers: its result, or the one stored under its key when the call was sent before,
  with the bill's web address for an external caller, read afresh rather than stored, or a refusal
  as a sentence
*/
const toBudgetWriteResult = createModuleWriteResult(toBudgetRefusal)

export default toBudgetWriteResult
