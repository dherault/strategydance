import { MODULES, type ModuleName, type ModuleScope } from 'strategydance-core'

import type { OAuthConsentAccessLevel } from '~utils/oauth/readOAuthConsentModules'

/*
  The scopes Allow sends for the access the member chose in each module, in `MODULES`' order: a
  module's read, alone or with its write, and nothing for a module not allowed
*/
function toOAuthConsentScopes(accesses: Partial<Record<ModuleName, OAuthConsentAccessLevel>>): ModuleScope[] {
  return MODULES.flatMap(({ name, scopes }) => {
    const access = accesses[name] ?? 'none'

    if (access === 'none') return []

    return access === 'write' ? [scopes.read, scopes.write] : [scopes.read]
  })
}

export default toOAuthConsentScopes
