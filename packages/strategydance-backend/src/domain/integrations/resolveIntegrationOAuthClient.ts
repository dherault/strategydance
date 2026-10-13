import { type FetchLike, registerClient, RegistrationRejectedError } from '@modelcontextprotocol/client'
import {
  forgetOrganizationIntegrationOAuthClient,
  IntegrationError,
  recordOrganizationIntegrationOAuthClient,
} from 'strategydance-database/backend'

import { INTEGRATION_OAUTH_CLIENT_ID, IS_INTEGRATION_CLIENT_METADATA_DOCUMENT_SERVED } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import buildIntegrationClientMetadata from '~domain/integrations/buildIntegrationClientMetadata'
import chooseIntegrationRegistrationMethod from '~domain/integrations/chooseIntegrationRegistrationMethod'
import decryptIntegrationSecret from '~domain/integrations/decryptIntegrationSecret'
import type { IntegrationAuthorizationServer } from '~domain/integrations/discoverIntegrationAuthorizationServer'
import encryptIntegrationSecret from '~domain/integrations/encryptIntegrationSecret'
import IntegrationFailure from '~domain/integrations/IntegrationFailure'
import isIntegrationClientAuthenticationMethod, {
  type IntegrationClientAuthenticationMethod,
} from '~domain/integrations/isIntegrationClientAuthenticationMethod'
import readIntegrationForAdministrator, {
  type StoredIntegration,
} from '~domain/integrations/readIntegrationForAdministrator'
import readIntegrationRefusal from '~domain/integrations/readIntegrationRefusal'
import runIntegrationWrite from '~domain/integrations/runIntegrationWrite'

// The client a member's Connect presents to a server's authorization server, its secret opened
type IntegrationOAuthClient = {
  clientId: string
  clientSecret: string | null
  authenticationMethod: IntegrationClientAuthenticationMethod
}

// Whose a client's secret is: the server's, in its organization
type ClientSecretOwner = { purpose: 'client-secret'; organizationId: string; integrationId: string }

// How long before a registered client's secret stops being taken it is registered again, so a Connect
// never starts with a secret that expires before its finish
const SECRET_EXPIRY_MARGIN_MS = 15 * 60 * 1000

type ResolveIntegrationOAuthClientParameters = {
  caller: { organizationId: string; userId: string; integrationId: string }
  stored: StoredIntegration
  server: IntegrationAuthorizationServer
  fetch: FetchLike
}

/*
  The client a member's Connect presents, in the order MCP's authorization asks for:

  - Strategy Dance's client ID metadata document, its address as the `client_id`, when the
    authorization server reads such documents and the document is served at an https address, which
    production's is
  - the client registered with the server before, whose secret, if it has one, opens for this server
    alone, unless that secret is about to stop being taken
  - a new registration (RFC 7591), asking for a public client wherever the server takes one
    (`chooseIntegrationRegistrationMethod`), recorded for every member where none is recorded yet: a Connect
    that lost the race to another's registration takes the one recorded first, and a server
    reconfigured meanwhile refuses it as changed

  A registration refused, or answered with a way of authenticating Strategy Dance cannot use, is a
  discovery that failed, since the server offers no way to connect; a network failure throws as the
  fetch threw it, for the caller to classify
*/
async function resolveIntegrationOAuthClient({
  caller,
  stored,
  server,
  fetch,
}: ResolveIntegrationOAuthClientParameters) {
  const owner: ClientSecretOwner = {
    purpose: 'client-secret',
    organizationId: caller.organizationId,
    integrationId: caller.integrationId,
  }

  if (
    server.metadata.client_id_metadata_document_supported === true
    && IS_INTEGRATION_CLIENT_METADATA_DOCUMENT_SERVED
  ) {
    return toResolved({ clientId: INTEGRATION_OAUTH_CLIENT_ID, clientSecret: null, authenticationMethod: 'none' })
  }

  if (stored.oauthClientId && !isExpiring(stored.oauthClientSecretExpiresAt)) return openStored(stored, owner)

  if (stored.oauthClientId) {
    const refusal = await runIntegrationWrite(() =>
      forgetOrganizationIntegrationOAuthClient(dataConnect, { ...caller, oauthClientId: stored.oauthClientId ?? '' }),
    )

    if (refusal) return refusal
  }

  const origin = new URL(server.issuer).origin
  let registered

  try {
    registered = await registerClient(server.issuer, {
      metadata: server.metadata,
      clientMetadata: buildIntegrationClientMetadata(
        chooseIntegrationRegistrationMethod(server.metadata.token_endpoint_auth_methods_supported),
      ),
      fetchFn: fetch,
    })
  } catch (error) {
    if (!RegistrationRejectedError.isInstance(error)) throw error

    throw new IntegrationFailure(IntegrationError.DISCOVERY_FAILED, `${origin}: its registration was refused`)
  }

  const authenticationMethod =
    registered.token_endpoint_auth_method ?? (registered.client_secret ? 'client_secret_basic' : 'none')

  if (!isIntegrationClientAuthenticationMethod(authenticationMethod)) {
    throw new IntegrationFailure(IntegrationError.DISCOVERY_FAILED, `${origin}: its client takes another method`)
  }

  const client: IntegrationOAuthClient = {
    clientId: registered.client_id,
    clientSecret: registered.client_secret ?? null,
    authenticationMethod,
  }
  let encryptedSecret: string | null

  try {
    encryptedSecret = client.clientSecret === null ? null : await encryptIntegrationSecret(client.clientSecret, owner)
  } catch (error) {
    logger.error('Integrations: a client secret could not be encrypted', error)

    return { outcome: 'keyUnavailable' } as const
  }

  try {
    const { data } = await recordOrganizationIntegrationOAuthClient(dataConnect, {
      ...caller,
      configRevision: stored.configRevision,
      issuer: server.issuer,
      oauthClientId: client.clientId,
      encryptedOAuthClientSecret: encryptedSecret,
      oauthClientSecretExpiresAt: registered.client_secret_expires_at
        ? new Date(registered.client_secret_expires_at * 1000).toISOString()
        : null,
      oauthClientAuthenticationMethod: client.authenticationMethod,
    })

    if (data.organizationIntegration_updateMany === 1) return toResolved(client)
  } catch (error) {
    const refusal = readIntegrationRefusal(error)

    if (refusal) return { outcome: refusal } as const

    throw error
  }

  // Another member's Connect recorded its client first, or the server changed meanwhile
  const current = await readIntegrationForAdministrator(caller.organizationId, caller.integrationId)
  const isSame =
    current
    && !current.deletedAt
    && current.configRevision === stored.configRevision
    && current.issuer === server.issuer
    && current.oauthClientId

  return isSame ? openStored(current, owner) : ({ outcome: 'conflict' } as const)
}

// The client recorded on the server's row, its secret opened for that server alone
async function openStored(stored: StoredIntegration, owner: ClientSecretOwner) {
  const authenticationMethod = stored.oauthClientAuthenticationMethod ?? 'none'

  if (!stored.oauthClientId || !isIntegrationClientAuthenticationMethod(authenticationMethod)) {
    return { outcome: 'conflict' } as const
  }

  try {
    return toResolved({
      clientId: stored.oauthClientId,
      clientSecret: stored.encryptedOAuthClientSecret
        ? await decryptIntegrationSecret(stored.encryptedOAuthClientSecret, owner)
        : null,
      authenticationMethod,
    })
  } catch (error) {
    logger.error('Integrations: a client secret could not be decrypted', error)

    return { outcome: 'keyUnavailable' } as const
  }
}

function toResolved(client: IntegrationOAuthClient) {
  return { outcome: 'resolved', client } as const
}

function isExpiring(expiresAt: string | null | undefined) {
  return Boolean(expiresAt) && Date.parse(expiresAt ?? '') <= Date.now() + SECRET_EXPIRY_MARGIN_MS
}

export { type IntegrationOAuthClient }

export default resolveIntegrationOAuthClient
