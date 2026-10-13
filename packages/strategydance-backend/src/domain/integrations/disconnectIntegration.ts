import {
  disconnectIntegration as deleteIntegrationConnection,
  getIntegrationConnectionForMember,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import decryptIntegrationSecret from '~domain/integrations/decryptIntegrationSecret'
import isIntegrationClientAuthenticationMethod from '~domain/integrations/isIntegrationClientAuthenticationMethod'
import revokeIntegrationTokens from '~domain/integrations/revokeIntegrationTokens'

type DisconnectIntegrationParameters = {
  organizationId: string
  userId: string
  integrationId: string
}

/*
  Disconnects a member from one of the organization's servers: deletes the connection it read, by its
  generation, then asks the authorization server to revoke that connection's tokens, best effort, so
  what the member asked for holds whether or not the server answers. A reconnect made meanwhile, from
  another tab, is another generation, left as it is and answered as a change, its tokens unrevoked. A
  member with nothing to disconnect is answered as disconnected all the same
*/
async function disconnectIntegration(caller: DisconnectIntegrationParameters) {
  const {
    data: {
      integrationConnections: [connection],
    },
  } = await getIntegrationConnectionForMember(dataConnect, caller)

  if (!connection) return { outcome: 'disconnected' } as const

  const { data } = await deleteIntegrationConnection(dataConnect, { ...caller, generation: connection.generation })

  if (data.integrationConnection_deleteMany !== 1) return { outcome: 'conflict' } as const
  if (!connection.encryptedAccessToken || !connection.revocationEndpoint) return { outcome: 'disconnected' } as const

  const authenticationMethod = connection.oauthClientAuthenticationMethod

  if (!isIntegrationClientAuthenticationMethod(authenticationMethod)) return { outcome: 'disconnected' } as const

  const tokenOwner = {
    organizationId: caller.organizationId,
    integrationId: caller.integrationId,
    generation: connection.generation,
    userId: caller.userId,
  }

  try {
    const { integration } = connection
    const clientSecret =
      integration.oauthClientId === connection.oauthClientId && integration.encryptedOAuthClientSecret
        ? await decryptIntegrationSecret(integration.encryptedOAuthClientSecret, {
            purpose: 'client-secret',
            organizationId: caller.organizationId,
            integrationId: caller.integrationId,
          })
        : null

    await revokeIntegrationTokens(
      {
        revocationEndpoint: connection.revocationEndpoint,
        client: { clientId: connection.oauthClientId, clientSecret, authenticationMethod },
      },
      {
        accessToken: await decryptIntegrationSecret(connection.encryptedAccessToken, {
          purpose: 'access-token',
          ...tokenOwner,
        }),
        refreshToken: connection.encryptedRefreshToken
          ? await decryptIntegrationSecret(connection.encryptedRefreshToken, {
              purpose: 'refresh-token',
              ...tokenOwner,
            })
          : null,
      },
    )
  } catch (error) {
    logger.error("Integrations: a member's tokens could not be opened to revoke them", error)
  }

  return { outcome: 'disconnected' } as const
}

export default disconnectIntegration
