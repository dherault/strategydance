import { MODULES } from 'strategydance-core'

function findSubagentsModule() {
  const found = MODULES.find(module => module.name === 'subagents')

  if (!found) throw new Error('MODULES lists no subagents module')

  return found
}

// The Subagents module's entry in `MODULES`: its name, path, title and scopes
const subagentsModule = findSubagentsModule()

export default subagentsModule
