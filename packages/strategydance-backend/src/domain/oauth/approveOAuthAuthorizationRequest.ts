import { randomUUID } from 'node:crypto'

import { MAX_AGENT_CONNECTION_ORGANIZATIONS, toModuleScopesInOrder } from 'strategydance-core'
import { approveOAuthAuthorizationRequest as approveRequest } from 'strategydance-database/backend'

import { OAUTH_ISSUER } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import buildAuthorizationResponseUrl from '~domain/oauth/buildAuthorizationResponseUrl'
import checkModuleScopes from '~domain/oauth/checkModuleScopes'
import createOpaqueToken from '~domain/oauth/createOpaqueToken'
import describeModuleScopes from '~domain/oauth/describeModuleScopes'
import hashOAuthToken from '~domain/oauth/hashOAuthToken'
import isMembershipRefusal from '~domain/oauth/isMembershipRefusal'
import loadOAuthAuthorizationRequest from '~domain/oauth/loadOAuthAuthorizationRequest'

type Approval = {
  requestId: string
  // The member allowing it, as the backend verified them
  userId: string
  // The organizations the member chose, among theirs, in either form and maybe twice
  organizationIds: string[]
  // The access the member allows, for each module read alone, read and write, or neither
  scopes: string[]
}

type Approved =
  | { outcome: 'approved'; redirectUrl: string }
  | { outcome: 'unknown' }
  | { outcome: 'refused'; reason: string }
  | { outcome: 'invalid'; reason: string }
  | { outcome: 'forbidden' }
  | { outcome: 'full' }

/*
  A member allows an external agent to act as them at an address in the organizations they chose:
  the client and its redirect address are checked again, and the request is decided once, making
  the connection and a code valid for a minute, which goes back to the client with its `state` and
  the issuer. Consenting again with the same client at the same address replaces the earlier
  connection with its tokens, and what it reached with the organizations chosen now.

  The access allowed holds at least one module read and no write without its read, each scope asked
  for or held by the connection it replaces, so a consent never grants what neither the agent asked
  for nor the member granted before: what was asked for goes as `scopes`, which the database checks
  against the request, and what only the connection held as `heldScopes`, which it checks against
  the connection after the member's lock, so a narrowing that committed meanwhile is seen, and which
  nothing reads before, since that check is the one that counts.

  The organizations go canonical and once each, since the database counts the memberships it locks
  against the list. The database refuses anybody who is not a member of each of them, more of them
  than a connection reaches (`MAX_AGENT_CONNECTION_ORGANIZATIONS`), a member who connected as many
  agents as they may (`MAX_AGENT_CONNECTIONS`), and a request decided already or expired
*/
async function approveOAuthAuthorizationRequest({
  requestId,
  userId,
  organizationIds,
  scopes,
}: Approval): Promise<Approved> {
  const loaded = await loadOAuthAuthorizationRequest(requestId)

  if (loaded.outcome === 'unknown') return loaded
  if (loaded.outcome === 'refused') return { outcome: 'refused', reason: loaded.reason }

  const { request, client, address, modules } = loaded

  if (!checkModuleScopes(modules, scopes)) {
    return { outcome: 'invalid', reason: `Allow ${describeModuleScopes(modules)}` }
  }

  // What the request asked for, which the database checks against it, and what the member keeps
  // beyond it, which it checks against the connection this consent replaces, after the lock
  const granted = toModuleScopesInOrder(scopes)
  const asked = granted.filter(scope => request.scopes.includes(scope))
  const kept = granted.filter(scope => !request.scopes.includes(scope))

  const chosen = [...new Set(organizationIds.map(toCanonicalUuid))]

  if (!chosen.length || chosen.length > MAX_AGENT_CONNECTION_ORGANIZATIONS) {
    return {
      outcome: 'invalid',
      reason: `Allow the agent in 1 to ${MAX_AGENT_CONNECTION_ORGANIZATIONS} of your organizations`,
    }
  }

  const code = createOpaqueToken()

  try {
    await approveRequest(dataConnect, {
      id: request.id,
      userId,
      organizationIds: chosen,
      connectionId: randomUUID().replaceAll('-', ''),
      clientId: request.clientId,
      registeredClientId: client.registeredClientId,
      clientName: client.name,
      module: address.name,
      resource: request.resource,
      scopes: asked,
      heldScopes: kept,
      codeHash: hashOAuthToken(code),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (isMembershipRefusal(message)) return { outcome: 'forbidden' }
    if (message.includes('A member connects at most')) return { outcome: 'full' }
    if (message.includes('The authorization request was decided already or has expired')) return { outcome: 'unknown' }
    if (message.includes('The connection this consent replaces holds no such access')) {
      return {
        outcome: 'invalid',
        reason: 'Allow only the access the request asked for, or that the connection it replaces holds',
      }
    }

    throw error
  }

  return {
    outcome: 'approved',
    redirectUrl: buildAuthorizationResponseUrl(request.redirectUri, { code, state: request.state, iss: OAUTH_ISSUER }),
  }
}

export default approveOAuthAuthorizationRequest
