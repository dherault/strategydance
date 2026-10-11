import registerAddTaskDependency from '~modules/tasks/tools/registerAddTaskDependency'
import registerCreateTask from '~modules/tasks/tools/registerCreateTask'
import registerDeleteTask from '~modules/tasks/tools/registerDeleteTask'
import registerListTasks from '~modules/tasks/tools/registerListTasks'
import registerReadTask from '~modules/tasks/tools/registerReadTask'
import registerRemoveTaskDependency from '~modules/tasks/tools/registerRemoveTaskDependency'
import registerRestoreTask from '~modules/tasks/tools/registerRestoreTask'
import registerUpdateTask from '~modules/tasks/tools/registerUpdateTask'

/*
  The Tasks module's tools, in the order `tools/list` gives them, which is the order Strategy Dance's
  agent puts them in its own list, after Knowledge's: reads, then writes. Reordering them changes that
  list, which costs every conversation its earlier reasoning once
*/
const TASKS_TOOLS = [
  registerListTasks,
  registerReadTask,
  registerCreateTask,
  registerUpdateTask,
  registerAddTaskDependency,
  registerRemoveTaskDependency,
  registerDeleteTask,
  registerRestoreTask,
]

export default TASKS_TOOLS
