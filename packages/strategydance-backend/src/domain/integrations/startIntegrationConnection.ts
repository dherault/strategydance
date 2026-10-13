import { randomUUID } from 'node:crypto'

import { startAuthorization } from '@modelcontextprotocol/client'
import {
  IntegrationAuthentication,
  IntegrationError,
  startIntegrationAuthorization,
} from 'strategydance-database/backend'

import { INTEGRATION_OAUTH_CALLBACK_URL } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import classifyIntegrationFailure from '~domain/integrations/classifyIntegrationFailure'
import createIntegrationFetch from '~domain/integrations/createIntegrationFetch'
import discoverIntegrationAuthorizationServer from '~domain/integrations/discoverIntegrationAuthorizationServer'
import encryptIntegrationSecret from '~domain/integrations/encryptIntegrationSecret'
import readIntegrationForAdministrator from '~domain/integrations/readIntegrationForAdministrator'
import resolveIntegrationOAuthClient from '~domain/integrations/resolveIntegrationOAuthClient'
import runIntegrationWrite from '~domain/integrations/runIntegrationWrite'
import createOpaqueToken from '~domain/oauth/createOpaqueToken'
import hashOAuthToken from '~domain/oauth/hashOAuthToken'

type StartIntegrationConnectionParameters = {
  organizationId: string
  userId: string
  integrationId: string
}

/*
  Starts a member's Connect to one of the organization's OAuth servers, answering the address of the
  authorization server's sign-in, which their page opens in the window it opened for it, and the
  Connect's id, which a Cancel names:

  - the server, live and taking OAuth, is discovered again, every request through the guarded fetch,
    and has to name the issuer its row holds: another issuer is another authorization server, which
    only an administrator's Retry takes, since it clears everything given for the old one
  - the client is the one `resolveIntegrationOAuthClient` resolves
  - the sign-in's address is the MCP SDK's, with its own PKCE pair, a 256-bit state, the resource and
    the scope discovery chose, and has to be https, since the page loads it in a window of the app's
    own origin
  - the Connect is stored, its state as a hash and its verifier encrypted for this Connect and member,
    replacing any of theirs under way for the server, at the revision and issuer discovered

  A server out of reach, or whose sign-in cannot be used, is answered as the failure it is
*/
async function startIntegrationConnection({
  organizationId,
  userId,
  integrationId,
}: StartIntegrationConnectionParameters) {
  const caller = { organizationId, userId, integrationId }
  const stored = await readIntegrationForAdministrator(organizationId, integrationId)

  if (!stored || stored.deletedAt) return { outcome: 'gone' } as const
  if (stored.authentication !== IntegrationAuthentication.OAUTH || !stored.issuer) {
    return { outcome: 'notOAuth' } as const
  }

  const origin = new URL(stored.url).origin
  const fetch = createIntegrationFetch()
  let server
  let resolved

  try {
    server = await discoverIntegrationAuthorizationServer(stored.url, fetch)

    if (server.issuer !== stored.issuer) return { outcome: 'issuerChanged' } as const

    resolved = await resolveIntegrationOAuthClient({ caller, stored, server, fetch })
  } catch (error) {
    const failure = classifyIntegrationFailure(error, { hasKey: false, origin, isDiscovery: true })

    logger.info(`Integrations: a Connect could not start, ${failure.message}`)

    return { outcome: 'failed', kind: failure.kind } as const
  }

  if (resolved.outcome !== 'resolved') return resolved

  const { client } = resolved
  const state = createOpaqueToken()
  let started

  try {
    started = await startAuthorization(server.issuer, {
      metadata: server.metadata,
      clientInformation: { client_id: client.clientId },
      redirectUrl: INTEGRATION_OAUTH_CALLBACK_URL,
      scope: server.scope,
      state,
      resource: server.resource,
    })
  } catch {
    return { outcome: 'failed', kind: IntegrationError.DISCOVERY_FAILED } as const
  }

  const { authorizationUrl, codeVerifier } = started

  if (authorizationUrl.protocol !== 'https:') {
    logger.info(`Integrations: ${origin} names a sign-in that is not https`)

    return { outcome: 'failed', kind: IntegrationError.DISCOVERY_FAILED } as const
  }

  const authorizationId = randomUUID()
  let encryptedCodeVerifier

  try {
    encryptedCodeVerifier = await encryptIntegrationSecret(codeVerifier, {
      purpose: 'code-verifier',
      organizationId,
      integrationId,
      authorizationId,
      userId,
    })
  } catch (error) {
    logger.error('Integrations: a Connect could not be encrypted', error)

    return { outcome: 'keyUnavailable' } as const
  }

  const refusal = await runIntegrationWrite(() =>
    startIntegrationAuthorization(dataConnect, {
      ...caller,
      configRevision: stored.configRevision,
      authorizationId,
      stateHash: hashOAuthToken(state),
      encryptedCodeVerifier,
      oauthClientId: client.clientId,
      oauthClientAuthenticationMethod: client.authenticationMethod,
      resource: server.resource,
      scope: server.scope ?? null,
      issuer: server.issuer,
      isIssuerParameterSupported: server.metadata.authorization_response_iss_parameter_supported === true,
      tokenEndpoint: server.metadata.token_endpoint,
      revocationEndpoint: readRevocationEndpoint(server.metadata),
    }),
  )

  if (refusal) return refusal

  return {
    outcome: 'started',
    authorizationUrl: authorizationUrl.href,
    authorizationId: toCanonicalUuid(authorizationId),
  } as const
}

// The revocation endpoint (RFC 7009) the authorization server names, an https one alone
function readRevocationEndpoint(metadata: object) {
  const endpoint = 'revocation_endpoint' in metadata ? metadata.revocation_endpoint : null

  return typeof endpoint === 'string' && endpoint.startsWith('https://') ? endpoint : null
}

export default startIntegrationConnection
