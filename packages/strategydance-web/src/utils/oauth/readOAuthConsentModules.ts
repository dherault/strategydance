import {
  type ModuleDefinition,
  MONEY_MODULE_NAMES,
  type ModuleName,
  type OAuthAuthorizationRequestSummary,
  readModuleAddress,
  readModuleAddressModules,
} from 'strategydance-core'

// What a consent allows an agent in one module: nothing, read, or read and write
export type OAuthConsentAccessLevel = 'none' | 'read' | 'write'

export type OAuthConsentModule = {
  name: ModuleName
  // Read and write is offered when the agent asked for it or the connection replaced held it
  isWriteOffered: boolean
  initialAccess: Exclude<OAuthConsentAccessLevel, 'none'>
}

function readLevel(module: ModuleDefinition, scopes: readonly string[]): OAuthConsentAccessLevel {
  if (!scopes.includes(module.scopes.read)) return 'none'

  return scopes.includes(module.scopes.write) ? 'write' : 'read'
}

/*
  The modules a consent page lists, in `MODULES`' order: each module of the request's address the
  agent asked for, and each the connection it replaces holds, so nothing is granted out of the
  member's sight. A module only asked for starts with what was asked, and one the connection held
  starts as held, its write offered whenever it was asked for too.

  At an address of several modules, a write the connection held at read starts at read even when
  the agent asks for it: the member chose read, on an earlier consent or on Connected agents, and
  the agent asking again, as a write's challenge has it do, is not the member choosing otherwise.
  A module that touches money (`MONEY_MODULE_NAMES`) starts at read unless its write was both asked
  for and held, a choice the member made before for that client, since many clients ask for every
  scope a server lists. A module's own address is a consent of its own, and starts a module as held,
  or as asked when that is more
*/
function readOAuthConsentModules({
  address,
  scopes,
  heldScopes,
}: Pick<OAuthAuthorizationRequestSummary, 'address' | 'scopes' | 'heldScopes'>): OAuthConsentModule[] {
  const definition = readModuleAddress(address)
  const served = definition ? readModuleAddressModules(definition) : []
  const isSeveral = served.length > 1

  return served.flatMap(module => {
    const asked = readLevel(module, scopes)
    const held = readLevel(module, heldScopes)

    if (asked === 'none' && held === 'none') return []

    const isWriteOffered = asked === 'write' || held === 'write'
    const isWriteChosen = !isSeveral
      ? isWriteOffered
      : MONEY_MODULE_NAMES.includes(module.name)
        ? asked === 'write' && held === 'write'
        : held === 'write' || (held === 'none' && asked === 'write')

    return [{ name: module.name, isWriteOffered, initialAccess: isWriteChosen ? 'write' : 'read' }]
  })
}

export default readOAuthConsentModules
