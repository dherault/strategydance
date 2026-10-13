import { normalizeIntegrationName } from 'strategydance-core'
import {
  IntegrationAuthentication,
  reconfigureOrganizationIntegration,
  renameOrganizationIntegration,
  updateOrganizationIntegrationKey,
} from 'strategydance-database/backend'
import { findExternalMcpServerByUrl } from 'strategydance-external-mcp-servers'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import decryptIntegrationKey from '~domain/integrations/decryptIntegrationKey'
import encryptIntegrationKey from '~domain/integrations/encryptIntegrationKey'
import IntegrationFailure from '~domain/integrations/IntegrationFailure'
import {
  type IntegrationSettings,
  toIntegrationCredential,
  toStoredKeyFields,
} from '~domain/integrations/integrationSettings'
import reachIntegration from '~domain/integrations/reachIntegration'
import readIntegrationForAdministrator from '~domain/integrations/readIntegrationForAdministrator'
import runIntegrationWrite from '~domain/integrations/runIntegrationWrite'

type EditIntegrationParameters = {
  organizationId: string
  userId: string
  integrationId: string
  settings: IntegrationSettings
}

/*
  Changes a server as its administrator's form says, in one write, reaching it first unless only its
  name changed:

  - another address or authentication is another server, so everything given for the old one goes:
    a key-based one takes its key again, never sent to the new address, and its tools and approvals
    are listed afresh (`ReconfigureOrganizationIntegration`)
  - a new key, or another way of sending it, at the same address lists the tools with it, keeping
    the approvals of the tools still listed (`UpdateOrganizationIntegrationKey`)
  - a name alone is renamed

  Each write matches the configuration the server was reached with, so an edit made meanwhile wins
  and this one is refused as a conflict, for the administrator to look again
*/
async function editIntegration({ organizationId, userId, integrationId, settings }: EditIntegrationParameters) {
  const stored = await readIntegrationForAdministrator(organizationId, integrationId)

  if (!stored || stored.deletedAt) return { outcome: 'gone' } as const

  const owner = { organizationId, integrationId }
  const name = settings.name.trim()
  const named = { organizationId, userId, integrationId, name, normalizedName: normalizeIntegrationName(name) }
  const isServerChanged = settings.url !== stored.url || settings.authentication !== stored.authentication
  const isKeyed = settings.authentication === IntegrationAuthentication.API_KEY
  const isKeyChanged = isKeyed && settings.apiKey !== null
  const isSchemeChanged =
    isKeyed
    && (settings.apiKeyScheme !== stored.apiKeyScheme || (settings.apiKeyHeader ?? null) !== stored.apiKeyHeader)

  if (!isServerChanged && !isKeyChanged && !isSchemeChanged) {
    if (name === stored.name) return { outcome: 'saved' } as const

    return (await runIntegrationWrite(() => renameOrganizationIntegration(dataConnect, named))) ?? { outcome: 'saved' }
  }

  if (isServerChanged && isKeyed && settings.apiKey === null) return { outcome: 'keyRequired' } as const

  const key = isKeyed ? (settings.apiKey ?? (await decryptIntegrationKey(stored.encryptedApiKey ?? '', owner))) : null
  let reach

  try {
    reach = await reachIntegration({
      url: settings.url,
      authentication: settings.authentication,
      credential: key === null ? null : toIntegrationCredential(settings, key),
    })
  } catch (error) {
    if (!(error instanceof IntegrationFailure)) throw error

    logger.info(`Integrations: editing failed, ${error.message}`)

    return { outcome: 'failed', kind: error.kind } as const
  }

  let encryptedApiKey = stored.encryptedApiKey

  if (isKeyChanged || isServerChanged) {
    try {
      encryptedApiKey = key === null ? null : await encryptIntegrationKey(key, owner)
    } catch (error) {
      logger.error('Integrations: a key could not be encrypted', error)

      return { outcome: 'keyUnavailable' } as const
    }
  }

  const matched = { configRevision: stored.configRevision, keyGeneration: stored.keyGeneration }
  const refusal = isServerChanged
    ? await runIntegrationWrite(() =>
        reconfigureOrganizationIntegration(dataConnect, {
          ...named,
          ...matched,
          url: settings.url,
          // The external MCP server at the new address, whose mark it now draws, or none
          catalogueSlug: findExternalMcpServerByUrl(settings.url)?.slug ?? null,
          authentication: settings.authentication,
          encryptedApiKey,
          ...toStoredKeyFields(settings, key),
          issuer: reach.issuer,
          tools: reach.tools,
          toolCount: reach.toolCount,
          toolDefinitionHashes: reach.toolDefinitionHashes,
        }),
      )
    : await runIntegrationWrite(() =>
        updateOrganizationIntegrationKey(dataConnect, {
          ...named,
          ...matched,
          configRevisionIncrement: isSchemeChanged ? 1 : 0,
          keyGenerationIncrement: isKeyChanged ? 1 : 0,
          encryptedApiKey: encryptedApiKey ?? '',
          ...toStoredKeyFields(settings, key),
          apiKeyLastFour: key?.slice(-4) ?? '',
          tools: reach.tools ?? '[]',
          toolCount: reach.toolCount ?? 0,
          toolDefinitionHashes: reach.toolDefinitionHashes,
          removedToolDefinitionHashes: stored.toolDefinitionHashes.filter(
            hash => !reach.toolDefinitionHashes.includes(hash),
          ),
        }),
      )

  return refusal ?? ({ outcome: 'saved' } as const)
}

export default editIntegration
