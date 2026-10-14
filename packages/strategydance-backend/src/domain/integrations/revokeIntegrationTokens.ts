import { INTEGRATION_REVOCATION_TIMEOUT_MS } from '~constants'

import logger from '~utils/logger'

import applyIntegrationClientAuthentication from '~domain/integrations/applyIntegrationClientAuthentication'
import createIntegrationFetch from '~domain/integrations/createIntegrationFetch'
import type { IntegrationOAuthClient } from '~domain/integrations/resolveIntegrationOAuthClient'

type RevocationEndpoint = {
  revocationEndpoint: string | null | undefined
  client: IntegrationOAuthClient
}

/*
  Revokes a member's tokens at their authorization server (RFC 7009), when it names a revocation
  endpoint: the refresh token, which revokes the grant with it at most servers, else the access token,
  the client authenticated as its token requests are. Best effort and within five seconds, through the
  guarded fetch, which follows no redirect: a disconnect has deleted the tokens already, and a server
  that keeps them anyway keeps tokens nothing holds. A failure is logged by the endpoint's origin alone
*/
async function revokeIntegrationTokens(
  { revocationEndpoint, client }: RevocationEndpoint,
  { accessToken, refreshToken }: { accessToken: string | null; refreshToken: string | null },
) {
  const token = refreshToken ?? accessToken

  if (!revocationEndpoint || !token) return

  const body = new URLSearchParams({ token, token_type_hint: refreshToken ? 'refresh_token' : 'access_token' })
  const headers = new Headers({ 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' })

  applyIntegrationClientAuthentication(client, headers, body)

  const fetch = createIntegrationFetch(undefined, AbortSignal.timeout(INTEGRATION_REVOCATION_TIMEOUT_MS))

  try {
    const response = await fetch(revocationEndpoint, { method: 'POST', headers, body })

    await response.body?.cancel().catch(() => {})

    if (!response.ok)
      logger.info(`Integrations: ${new URL(revocationEndpoint).origin} answered a revocation ${response.status}`)
  } catch {
    logger.info(`Integrations: ${new URL(revocationEndpoint).origin} could not be asked to revoke a token`)
  }
}

export default revokeIntegrationTokens
