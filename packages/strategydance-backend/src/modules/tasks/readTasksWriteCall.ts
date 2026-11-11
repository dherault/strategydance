import createModuleWriteCallReader from '~modules/createModuleWriteCallReader'
import tasksModule from '~modules/tasks/tasksModule'
import toTasksRefusal from '~modules/tasks/toTasksRefusal'

// What every write tool of the Tasks module checks before anything is read or written: the write
// scope, and the idempotency key its call carries, if any
const readTasksWriteCall = createModuleWriteCallReader(tasksModule.scopes.write, toTasksRefusal)

export default readTasksWriteCall
