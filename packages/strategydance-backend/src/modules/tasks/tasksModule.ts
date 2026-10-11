import { MODULES } from 'strategydance-core'

function findTasksModule() {
  const found = MODULES.find(module => module.name === 'tasks')

  if (!found) throw new Error('MODULES lists no tasks module')

  return found
}

// The Tasks module's entry in `MODULES`: its name, path, title and scopes
const tasksModule = findTasksModule()

export default tasksModule
