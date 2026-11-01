import { MODULES } from 'strategydance-core'

function findKnowledgeModule() {
  const found = MODULES.find(module => module.name === 'knowledge')

  if (!found) throw new Error('MODULES lists no knowledge module')

  return found
}

// The Knowledge module's entry in `MODULES`: its name, path, title and scopes
const knowledgeModule = findKnowledgeModule()

export default knowledgeModule
