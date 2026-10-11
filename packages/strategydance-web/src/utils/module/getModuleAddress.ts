import { MODULES, type ModuleName } from 'strategydance-core'

import { API_URL } from '~data/api'

// The address an external agent calls a module at, on the backend this page talks to: the
// production backend's, or the local one's against the emulators
function getModuleAddress(module: ModuleName) {
  const definition = MODULES.find(({ name }) => name === module)

  if (!definition) throw new Error(`MODULES lists no ${module} module`)

  return `${API_URL}${definition.path}`
}

export default getModuleAddress
