import {
  changeOrganizationIntegrationIssuer,
  IntegrationAuthentication,
  recordOrganizationIntegrationError,
  recordOrganizationIntegrationIssuer,
  recordOrganizationIntegrationTools,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import decryptIntegrationKey from '~domain/integrations/decryptIntegrationKey'
import IntegrationFailure from '~domain/integrations/IntegrationFailure'
import listIntegrationToolsAsMember from '~domain/integrations/listIntegrationToolsAsMember'
import reachIntegration from '~domain/integrations/reachIntegration'
import readIntegrationForAdministrator from '~domain/integrations/readIntegrationForAdministrator'
import runIntegrationWrite from '~domain/integrations/runIntegrationWrite'

type RetryIntegrationParameters = {
  organizationId: string
  userId: string
  integrationId: string
}

/*
  Reaches a server again as it is configured, and records what it found: a key-based or open
  server's tools, the approvals of those it no longer lists dropped, or an OAuth server's issuer,
  which, when it is another, is another authorization server, so everything given for the old one
  goes (`ChangeOrganizationIntegrationIssuer`). An OAuth server whose issuer holds lists its tools
  again with the administrator's own token, when they connected an account, as the first member's
  connection did, the tools being the same for every account: a token the server no longer takes is
  answered as theirs to connect again, never as the server's error. A failure is recorded as its
  error, which the page shows, and answered as one
*/
async function retryIntegration({ organizationId, userId, integrationId }: RetryIntegrationParameters) {
  const stored = await readIntegrationForAdministrator(organizationId, integrationId)

  if (!stored || stored.deletedAt) return { outcome: 'gone' } as const

  const caller = { organizationId, userId, integrationId }
  const matched = { configRevision: stored.configRevision, keyGeneration: stored.keyGeneration }
  let key: string | null = null

  try {
    key =
      stored.authentication === IntegrationAuthentication.API_KEY
        ? await decryptIntegrationKey(stored.encryptedApiKey ?? '', { organizationId, integrationId })
        : null
  } catch (error) {
    logger.error('Integrations: a key could not be decrypted', error)

    return { outcome: 'keyUnavailable' } as const
  }

  let reach

  try {
    reach = await reachIntegration({
      url: stored.url,
      authentication: stored.authentication,
      credential: key === null ? null : { key, scheme: stored.apiKeyScheme, header: stored.apiKeyHeader ?? null },
    })
  } catch (error) {
    if (!(error instanceof IntegrationFailure)) throw error

    logger.info(`Integrations: a retry failed, ${error.message}`)

    const refusal = await runIntegrationWrite(() =>
      recordOrganizationIntegrationError(dataConnect, { ...caller, ...matched, error: error.kind }),
    )

    return refusal ?? ({ outcome: 'failed', kind: error.kind } as const)
  }

  const { issuer } = reach

  if (issuer !== null && issuer !== stored.issuer) {
    const refusal = await runIntegrationWrite(() =>
      changeOrganizationIntegrationIssuer(dataConnect, { ...caller, configRevision: stored.configRevision, issuer }),
    )

    return refusal ?? ({ outcome: 'reached', toolCount: 0 } as const)
  }

  if (issuer !== null) {
    const refusal = await runIntegrationWrite(() =>
      recordOrganizationIntegrationIssuer(dataConnect, { ...caller, configRevision: stored.configRevision, issuer }),
    )

    if (refusal) return refusal

    // The tools again, with the administrator's own token when they connected an account
    let listed

    try {
      listed = await listIntegrationToolsAsMember(caller)
    } catch (error) {
      if (!(error instanceof IntegrationFailure)) throw error

      logger.info(`Integrations: a retry could not list an OAuth server's tools, ${error.message}`)

      const recorded = await runIntegrationWrite(() =>
        recordOrganizationIntegrationError(dataConnect, { ...caller, ...matched, error: error.kind }),
      )

      return recorded ?? ({ outcome: 'failed', kind: error.kind } as const)
    }

    if (listed.outcome === 'notConnected') return { outcome: 'reached', toolCount: stored.toolCount ?? 0 } as const
    if (listed.outcome !== 'listed') return listed

    reach = listed.reach
  }

  const refusal = await runIntegrationWrite(() =>
    recordOrganizationIntegrationTools(dataConnect, {
      ...caller,
      ...matched,
      tools: reach.tools ?? '[]',
      toolCount: reach.toolCount ?? 0,
      toolDefinitionHashes: reach.toolDefinitionHashes,
      removedToolDefinitionHashes: stored.toolDefinitionHashes.filter(
        hash => !reach.toolDefinitionHashes.includes(hash),
      ),
    }),
  )

  return refusal ?? ({ outcome: 'reached', toolCount: reach.toolCount ?? 0 } as const)
}

export default retryIntegration
