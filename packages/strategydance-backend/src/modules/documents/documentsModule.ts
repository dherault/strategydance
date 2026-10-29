import { MODULES } from 'strategydance-core'

function findDocumentsModule() {
  const found = MODULES.find(module => module.name === 'documents')

  if (!found) throw new Error('MODULES lists no documents module')

  return found
}

// The Documents module's entry in `MODULES`: its name, path, title and scopes
const documentsModule = findDocumentsModule()

export default documentsModule
