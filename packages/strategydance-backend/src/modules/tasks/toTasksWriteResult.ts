import createModuleWriteResult from '~modules/createModuleWriteResult'
import toTasksRefusal from '~modules/tasks/toTasksRefusal'

/*
  What a write tool of the Tasks module answers: its result, the same whether the write ran now or
  was answered from its idempotency key, a task's web address added for an external caller, or the
  refusal worded for the model
*/
const toTasksWriteResult = createModuleWriteResult(toTasksRefusal)

export default toTasksWriteResult
