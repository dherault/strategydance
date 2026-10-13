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
  goes (`ChangeOrganizationIntegrationIssuer`). A failure is recorded as its error, which the page
  shows, and answered as one
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

  if (issuer !== null) {
    const refusal = await runIntegrationWrite(() =>
      issuer === stored.issuer
        ? recordOrganizationIntegrationIssuer(dataConnect, { ...caller, configRevision: stored.configRevision, issuer })
        : changeOrganizationIntegrationIssuer(dataConnect, {
            ...caller,
            configRevision: stored.configRevision,
            issuer,
          }),
    )

    return refusal ?? ({ outcome: 'reached', toolCount: 0 } as const)
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
