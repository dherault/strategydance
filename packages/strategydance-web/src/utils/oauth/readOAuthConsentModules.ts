import {
  MODULES,
  MONEY_MODULE_NAMES,
  type ModuleName,
  type OAuthAuthorizationRequestSummary,
  readModuleAddress,
} from 'strategydance-core'

// What a consent allows an agent in one module: nothing, read, or read and write
export type OAuthConsentAccessLevel = 'none' | 'read' | 'write'

export type OAuthConsentModule = {
  name: ModuleName
  // Read and write is offered when the agent asked for it or the connection replaced held it
  isWriteOffered: boolean
  initialAccess: Exclude<OAuthConsentAccessLevel, 'none'>
}

function readLevel(module: (typeof MODULES)[number], scopes: readonly string[]): OAuthConsentAccessLevel {
  if (!scopes.includes(module.scopes.read)) return 'none'

  return scopes.includes(module.scopes.write) ? 'write' : 'read'
}

/*
  The modules a consent page lists, in `MODULES`' order: each module of the request's address the
  agent asked for, and each the connection it replaces holds, so nothing is granted out of the
  member's sight. A module starts as the connection held it, or with what was asked for when that is
  more, and one only asked for with what was asked. At an address of several modules, a module
  that touches money (`MONEY_MODULE_NAMES`) starts at read unless its write was both asked for and
  held, a choice the member made before for that client, since many clients ask for every scope a
  server lists. A module's own address is a consent of its own, and starts it as any other
*/
function readOAuthConsentModules({
  address,
  scopes,
  heldScopes,
}: Pick<OAuthAuthorizationRequestSummary, 'address' | 'scopes' | 'heldScopes'>): OAuthConsentModule[] {
  const served = readModuleAddress(address)?.modules ?? []
  const isSeveral = served.length > 1

  return MODULES.filter(({ name }) => served.includes(name)).flatMap(module => {
    const asked = readLevel(module, scopes)
    const held = readLevel(module, heldScopes)

    if (asked === 'none' && held === 'none') return []

    const isWriteOffered = asked === 'write' || held === 'write'
    const isWriteGuarded = isSeveral && MONEY_MODULE_NAMES.includes(module.name)
    const isWriteChosen = isWriteGuarded ? asked === 'write' && held === 'write' : isWriteOffered

    return [{ name: module.name, isWriteOffered, initialAccess: isWriteChosen ? 'write' : 'read' }]
  })
}

export default readOAuthConsentModules
