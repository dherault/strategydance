import { randomUUID } from 'node:crypto'

import { approveOAuthAuthorizationRequest as approveRequest } from 'strategydance-database/backend'

import { OAUTH_ISSUER } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import buildAuthorizationResponseUrl from '~domain/oauth/buildAuthorizationResponseUrl'
import createOpaqueToken from '~domain/oauth/createOpaqueToken'
import hashOAuthToken from '~domain/oauth/hashOAuthToken'
import isMembershipRefusal from '~domain/oauth/isMembershipRefusal'
import loadOAuthAuthorizationRequest from '~domain/oauth/loadOAuthAuthorizationRequest'

type Approval = {
  requestId: string
  // The member allowing it, as the backend verified them
  userId: string
  // The organization the member chose, among theirs
  organizationId: string
  // The access the member allows, read alone or read and write
  scopes: string[]
}

type Approved =
  | { outcome: 'approved'; redirectUrl: string }
  | { outcome: 'unknown' }
  | { outcome: 'refused'; reason: string }
  | { outcome: 'invalid'; reason: string }
  | { outcome: 'forbidden' }

/*
  A member allows an external agent to act as them on one module in one organization: the client
  and its redirect address are checked again, the access allowed never exceeds what was asked for,
  read always among it, and the request is decided once, making the connection and a code valid for
  a minute, which goes back to the client with its `state` and the issuer. Consenting again with the
  same client, organization and module replaces the earlier connection with its tokens. The
  database refuses anybody who is not the organization's member, and a request decided already or
  expired
*/
async function approveOAuthAuthorizationRequest({
  requestId,
  userId,
  organizationId,
  scopes,
}: Approval): Promise<Approved> {
  const loaded = await loadOAuthAuthorizationRequest(requestId)

  if (loaded.outcome === 'unknown') return loaded
  if (loaded.outcome === 'refused') return { outcome: 'refused', reason: loaded.reason }

  const { request, client, module } = loaded
  const granted = [...new Set(scopes)]

  if (!granted.includes(module.scopes.read) || granted.some(scope => !request.scopes.includes(scope))) {
    return { outcome: 'invalid', reason: `Allow ${module.scopes.read}, alone or with the access the request asked for` }
  }

  const code = createOpaqueToken()

  try {
    await approveRequest(dataConnect, {
      id: request.id,
      userId,
      organizationId: toCanonicalUuid(organizationId),
      connectionId: randomUUID().replaceAll('-', ''),
      clientId: request.clientId,
      registeredClientId: client.registeredClientId,
      clientName: client.name,
      module: module.name,
      resource: request.resource,
      scopes: [module.scopes.read, module.scopes.write].filter(scope => granted.includes(scope)),
      codeHash: hashOAuthToken(code),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (isMembershipRefusal(message)) return { outcome: 'forbidden' }
    if (message.includes('The authorization request was decided already or has expired')) return { outcome: 'unknown' }

    throw error
  }

  return {
    outcome: 'approved',
    redirectUrl: buildAuthorizationResponseUrl(request.redirectUri, { code, state: request.state, iss: OAUTH_ISSUER }),
  }
}

export default approveOAuthAuthorizationRequest
