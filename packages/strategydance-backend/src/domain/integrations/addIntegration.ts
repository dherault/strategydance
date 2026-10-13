import { randomUUID } from 'node:crypto'

import { normalizeIntegrationName } from 'strategydance-core'
import { createOrganizationIntegration, IntegrationAuthentication } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import encryptIntegrationKey from '~domain/integrations/encryptIntegrationKey'
import IntegrationFailure from '~domain/integrations/IntegrationFailure'
import {
  type IntegrationSettings,
  toIntegrationCredential,
  toStoredKeyFields,
} from '~domain/integrations/integrationSettings'
import reachIntegration from '~domain/integrations/reachIntegration'
import runIntegrationWrite from '~domain/integrations/runIntegrationWrite'

type AddIntegrationParameters = {
  organizationId: string
  userId: string
  settings: IntegrationSettings
  // The external MCP server it was added from, or null for one added by its address
  catalogueSlug: string | null
}

/*
  Adds an MCP server to an organization, once reaching it found what it serves: its tools, or an
  OAuth server's issuer. Nothing is saved when it cannot be reached, so the administrator fixes what
  the failure names. Its id is made here, since its key's ciphertext is bound to it, and the key is
  encrypted only once the server took it
*/
async function addIntegration({ organizationId, userId, settings, catalogueSlug }: AddIntegrationParameters) {
  const integrationId = randomUUID()
  const key = settings.authentication === IntegrationAuthentication.API_KEY ? settings.apiKey : null
  let reach

  try {
    reach = await reachIntegration({
      url: settings.url,
      authentication: settings.authentication,
      credential: key === null ? null : toIntegrationCredential(settings, key),
    })
  } catch (error) {
    if (!(error instanceof IntegrationFailure)) throw error

    logger.info(`Integrations: adding failed, ${error.message}`)

    return { outcome: 'failed', kind: error.kind } as const
  }

  let encryptedApiKey: string | null = null

  if (key !== null) {
    try {
      encryptedApiKey = await encryptIntegrationKey(key, { organizationId, integrationId })
    } catch (error) {
      logger.error('Integrations: a key could not be encrypted', error)

      return { outcome: 'keyUnavailable' } as const
    }
  }

  const refusal = await runIntegrationWrite(() =>
    createOrganizationIntegration(dataConnect, {
      organizationId,
      userId,
      integrationId,
      name: settings.name.trim(),
      normalizedName: normalizeIntegrationName(settings.name),
      url: settings.url,
      catalogueSlug,
      authentication: settings.authentication,
      encryptedApiKey,
      ...toStoredKeyFields(settings, key),
      issuer: reach.issuer,
      tools: reach.tools,
      toolCount: reach.toolCount,
      toolDefinitionHashes: reach.toolDefinitionHashes,
    }),
  )

  if (refusal) return refusal

  return { outcome: 'added', integrationId, toolCount: reach.toolCount ?? 0 } as const
}

export default addIntegration
