import {
  IntegrationApiKeyScheme,
  IntegrationAuthentication,
  IntegrationError,
  markIntegrationConnectionTokenRefused,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import IntegrationFailure from '~domain/integrations/IntegrationFailure'
import reachIntegration from '~domain/integrations/reachIntegration'
import readIntegrationAccessToken, { type IntegrationAccess } from '~domain/integrations/readIntegrationAccessToken'

type IntegrationCaller = { organizationId: string; userId: string; integrationId: string }

type ReadyAccess = Extract<IntegrationAccess, { outcome: 'ready' }>

/*
  An OAuth server's tools, listed with a member's own token, as remote MCP servers list the same tools
  for every account: their token read, refreshed first when it expires, and refreshed once more when
  the server refuses it, as a token revoked before its expiry is, after which a refusal means the
  member has to connect again, which the connection is marked as, so their page offers it. A member
  who never connected lists nothing; a server out of reach throws, as reaching it does
*/
async function listIntegrationToolsAsMember(caller: IntegrationCaller) {
  const access = await readIntegrationAccessToken(caller)

  if (access.outcome !== 'ready') return toRefusal(access)

  const listed = await listWith(access)

  if (listed !== 'refused') return listed

  const refreshed = await readIntegrationAccessToken(caller, { refusedAccessToken: access.encryptedAccessToken })

  if (refreshed.outcome !== 'ready') return toRefusal(refreshed)

  const again = await listWith(refreshed)

  if (again !== 'refused') return again

  // Even the refreshed token is refused: the connection needs the member, which their page shows
  await markIntegrationConnectionTokenRefused(dataConnect, {
    ...caller,
    generation: refreshed.generation,
    encryptedAccessToken: refreshed.encryptedAccessToken,
  })

  return { outcome: 'connectionExpired' } as const
}

// The tools, or `refused` when the server refused the token
async function listWith({ url, accessToken }: ReadyAccess) {
  try {
    const reach = await reachIntegration({
      url,
      authentication: IntegrationAuthentication.OAUTH,
      credential: { key: accessToken, scheme: IntegrationApiKeyScheme.BEARER, header: null },
    })

    return { outcome: 'listed', reach } as const
  } catch (error) {
    if (error instanceof IntegrationFailure && error.kind === IntegrationError.KEY_REFUSED) return 'refused'

    throw error
  }
}

// Why a member's token could not be read, a connection needing them answered as theirs to connect again
function toRefusal(access: Exclude<IntegrationAccess, ReadyAccess>) {
  switch (access.outcome) {
    case 'needsAuthentication':
      return { outcome: 'connectionExpired' } as const
    case 'failed':
      return { outcome: 'failed', kind: access.kind } as const
    case 'notConnected':
      return { outcome: 'notConnected' } as const
    case 'busy':
      return { outcome: 'busy' } as const
    case 'keyUnavailable':
      return { outcome: 'keyUnavailable' } as const
  }
}

export default listIntegrationToolsAsMember
