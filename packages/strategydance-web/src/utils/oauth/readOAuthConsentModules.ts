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
  // Not allowed only for a module asked for beside the modules of a connection consented to again
  initialAccess: OAuthConsentAccessLevel
  // What the agent asked for beyond where the module starts, which the page marks so the member
  // sees why the agent sent them, or null when the module starts at what was asked or above it
  askedAccess: Exclude<OAuthConsentAccessLevel, 'none'> | null
}

const LEVELS: readonly OAuthConsentAccessLevel[] = ['none', 'read', 'write']

function readLevel(module: ModuleDefinition, scopes: readonly string[]): OAuthConsentAccessLevel {
  if (!scopes.includes(module.scopes.read)) return 'none'

  return scopes.includes(module.scopes.write) ? 'write' : 'read'
}

/*
  Where a module of the request's address starts, from what the agent asked for and what the
  connection replaced held there, as `readOAuthConsentModules` says
*/
function readInitialAccess(
  name: ModuleName,
  {
    asked,
    held,
    isSeveral,
    isConsentingAgain,
  }: {
    asked: OAuthConsentAccessLevel
    held: OAuthConsentAccessLevel
    isSeveral: boolean
    isConsentingAgain: boolean
  },
): OAuthConsentAccessLevel {
  const isWriteOffered = asked === 'write' || held === 'write'

  // A module's own address, a consent of its own
  if (!isSeveral) return isWriteOffered ? 'write' : 'read'

  // A module that touches money writes only by a choice the member made before for that client
  if (MONEY_MODULE_NAMES.includes(name)) {
    if (isConsentingAgain && held === 'none') return 'none'

    return asked === 'write' && held === 'write' ? 'write' : 'read'
  }

  // Consenting again starts as the connection holds
  if (isConsentingAgain) return held

  return asked
}

/*
  The modules a consent page lists, in `MODULES`' order: each module of the request's address the
  agent asked for, and each the connection it replaces holds, so nothing is granted out of the
  member's sight, a write offered when it was asked for or held.

  At an address of several modules, a first consent starts each module with what was asked.
  Consenting again starts each as the connection holds it, what the agent asks beyond it offered,
  never chosen: a module not held starts not allowed, and a write held at read at read. What a
  connection holds cannot tell what the member left out from what the agent never asked for, and a
  member who narrowed it, on an earlier consent or on Connected agents, must not see one click on
  Allow undo that when the agent asks again, as a write's challenge has it do, and as a client does
  once its refresh token expires, most asking for every scope a server lists. Widening is the
  member's own choice on the page. A module that touches money (`MONEY_MODULE_NAMES`) also starts at
  read unless its write was both asked for and held, a choice the member made before for that
  client.

  A module's own address is a consent of its own, and starts its module as held, or as asked when
  that is more
*/
function readOAuthConsentModules({
  address,
  scopes,
  heldScopes,
}: Pick<OAuthAuthorizationRequestSummary, 'address' | 'scopes' | 'heldScopes'>): OAuthConsentModule[] {
  const definition = readModuleAddress(address)
  const served = definition ? readModuleAddressModules(definition) : []
  const isSeveral = served.length > 1
  // A connection is replaced, which holds at least one module's read
  const isConsentingAgain = served.some(module => readLevel(module, heldScopes) !== 'none')

  return served.flatMap((module): OAuthConsentModule[] => {
    const asked = readLevel(module, scopes)
    const held = readLevel(module, heldScopes)

    if (asked === 'none' && held === 'none') return []

    const initialAccess = readInitialAccess(module.name, { asked, held, isSeveral, isConsentingAgain })

    return [
      {
        name: module.name,
        isWriteOffered: asked === 'write' || held === 'write',
        initialAccess,
        askedAccess: asked !== 'none' && LEVELS.indexOf(asked) > LEVELS.indexOf(initialAccess) ? asked : null,
      },
    ]
  })
}

export default readOAuthConsentModules
