import { MAX_INTEGRATIONS } from 'strategydance-core'

import toCanonicalUuid from '~utils/toCanonicalUuid'

/*
  The backend connector's integration operations over tables in memory, each mirroring its
  namesake's conditions and refusals in the words the routes read, beside the reads the routes'
  middleware makes: the membership's role and whether the caller is staff. `check:integrations` is
  what keeps these conditions the SQL's.

  An operation checks everything before it changes anything, so it applies whole or not at all, as a
  transaction does. Times are the clock's, which a test moves with `setSystemTime`. Ids are kept as
  Data Connect keeps them, dashless
*/

export const IntegrationAuthentication = { OAUTH: 'OAUTH', API_KEY: 'API_KEY', NONE: 'NONE' } as const

export const IntegrationApiKeyScheme = { BEARER: 'BEARER', HEADER: 'HEADER' } as const

export const IntegrationError = {
  ADDRESS_REFUSED: 'ADDRESS_REFUSED',
  UNREACHABLE: 'UNREACHABLE',
  TIMED_OUT: 'TIMED_OUT',
  KEY_REFUSED: 'KEY_REFUSED',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  NOT_MCP_SERVER: 'NOT_MCP_SERVER',
  DISCOVERY_FAILED: 'DISCOVERY_FAILED',
  TOO_MANY_TOOLS: 'TOO_MANY_TOOLS',
} as const

export const OrganizationRole = { ADMINISTRATOR: 'ADMINISTRATOR', MEMBER: 'MEMBER' } as const

export type FakeIntegration = {
  id: string
  organizationId: string
  name: string
  normalizedName: string
  url: string
  catalogueSlug: string | null
  authentication: string
  isEnabled: boolean
  configRevision: number
  encryptedApiKey: string | null
  apiKeyLastFour: string | null
  keyGeneration: number
  apiKeyScheme: string
  apiKeyHeader: string | null
  issuer: string | null
  tools: string | null
  toolCount: number | null
  toolDefinitionHashes: string[]
  autoApprovedTools: string[]
  lastError: string | null
  deletedAt: string | null
}

// What a test reads the variables of an operation as
type AnyVariables = Record<string, any>

const DAY_MS = 24 * 60 * 60 * 1000

function createIntegrationDatabaseFake() {
  // Each member's role, by user and organization
  const roles = new Map<string, string>()
  const staff = new Set<string>()
  const integrations = new Map<string, FakeIntegration>()
  // Every operation called, by name, in order, with its variables
  const calls: { name: string; variables: AnyVariables }[] = []

  function id(value: unknown) {
    return toCanonicalUuid(String(value))
  }

  function membershipKey(userId: unknown, organizationId: unknown) {
    return `${userId}:${id(organizationId)}`
  }

  function refuse(message: string): never {
    throw new Error(`${message} (aborted)`)
  }

  function checkAdministrator({ userId, organizationId }: AnyVariables, action: string) {
    const role = roles.get(membershipKey(userId, organizationId))

    if (!role) refuse(`Only a member of an organization can ${action}`)
    if (role !== OrganizationRole.ADMINISTRATOR) refuse(`Only an administrator can ${action}`)
  }

  function live(organizationId: unknown) {
    return [...integrations.values()].filter(row => row.organizationId === id(organizationId) && !row.deletedAt)
  }

  function checkNameFree({ organizationId, normalizedName, integrationId }: AnyVariables) {
    const isTaken = live(organizationId).some(
      row => row.normalizedName === normalizedName && row.id !== id(integrationId ?? ''),
    )

    if (isTaken) refuse('Another server of the organization has this name')
  }

  // The live row a write is matched on, by its id, its organization and what else the write names
  function findLive({ integrationId, organizationId }: AnyVariables, matches: Partial<FakeIntegration> = {}) {
    const row = integrations.get(id(integrationId))

    if (!row || row.organizationId !== id(organizationId) || row.deletedAt) return null

    for (const [field, value] of Object.entries(matches)) {
      if (row[field as keyof FakeIntegration] !== value) return null
    }

    return row
  }

  const operations: Record<string, (variables: AnyVariables) => unknown> = {
    GetOrganizationMembership: ({ userId, organizationId }) => {
      const role = roles.get(membershipKey(userId, organizationId))

      return { userOrganization: role ? { role } : null }
    },
    GetUserStaffStatus: ({ userId }) => ({ user: { isAdministrator: staff.has(userId) } }),
    GetOrganizationIntegrationForAdministrator: ({ organizationId, integrationId }) => {
      const row = integrations.get(id(integrationId))

      return { organizationIntegrations: row && row.organizationId === id(organizationId) ? [{ ...row }] : [] }
    },
    CreateOrganizationIntegration: variables => {
      checkAdministrator(variables, 'add a server')

      if (live(variables.organizationId).length >= MAX_INTEGRATIONS) refuse('An organization adds at most 50 servers')

      checkNameFree({ ...variables, integrationId: null })
      integrations.set(id(variables.integrationId), {
        id: id(variables.integrationId),
        organizationId: id(variables.organizationId),
        name: variables.name,
        normalizedName: variables.normalizedName,
        url: variables.url,
        catalogueSlug: variables.catalogueSlug ?? null,
        authentication: variables.authentication,
        isEnabled: true,
        configRevision: 0,
        encryptedApiKey: variables.encryptedApiKey ?? null,
        apiKeyLastFour: variables.apiKeyLastFour ?? null,
        keyGeneration: 0,
        apiKeyScheme: variables.apiKeyScheme,
        apiKeyHeader: variables.apiKeyHeader ?? null,
        issuer: variables.issuer ?? null,
        tools: variables.tools ?? null,
        toolCount: variables.toolCount ?? null,
        toolDefinitionHashes: variables.toolDefinitionHashes,
        autoApprovedTools: [],
        lastError: null,
        deletedAt: null,
      })

      return { organizationIntegration_insert: { id: id(variables.integrationId) } }
    },
    RenameOrganizationIntegration: variables => {
      checkAdministrator(variables, 'change a server')
      checkNameFree(variables)

      const row = findLive(variables) ?? refuse('The server is gone')

      Object.assign(row, { name: variables.name, normalizedName: variables.normalizedName })

      return { organizationIntegration_updateMany: 1 }
    },
    ReconfigureOrganizationIntegration: variables => {
      checkAdministrator(variables, 'change a server')
      checkNameFree(variables)

      const row =
        findLive(variables, { configRevision: variables.configRevision, keyGeneration: variables.keyGeneration })
        ?? refuse('The server was changed or deleted meanwhile')

      // Every variable is passed, as the mutation's comment asks: one left out would keep its column
      for (const field of ['encryptedApiKey', 'apiKeyLastFour', 'apiKeyHeader', 'issuer', 'tools', 'toolCount']) {
        if (!(field in variables)) throw new Error(`ReconfigureOrganizationIntegration was called without ${field}`)
      }

      Object.assign(row, {
        name: variables.name,
        normalizedName: variables.normalizedName,
        url: variables.url,
        authentication: variables.authentication,
        encryptedApiKey: variables.encryptedApiKey,
        apiKeyLastFour: variables.apiKeyLastFour,
        apiKeyScheme: variables.apiKeyScheme,
        apiKeyHeader: variables.apiKeyHeader,
        issuer: variables.issuer,
        tools: variables.tools,
        toolCount: variables.toolCount,
        toolDefinitionHashes: variables.toolDefinitionHashes,
        autoApprovedTools: [],
        configRevision: row.configRevision + 1,
        keyGeneration: row.keyGeneration + 1,
        lastError: null,
      })

      return { organizationIntegration_updateMany: 1 }
    },
    UpdateOrganizationIntegrationKey: variables => {
      checkAdministrator(variables, 'change a server')
      checkNameFree(variables)

      const row =
        findLive(variables, {
          authentication: IntegrationAuthentication.API_KEY,
          configRevision: variables.configRevision,
          keyGeneration: variables.keyGeneration,
        }) ?? refuse('The server was changed or deleted meanwhile')

      Object.assign(row, {
        name: variables.name,
        normalizedName: variables.normalizedName,
        encryptedApiKey: variables.encryptedApiKey,
        apiKeyLastFour: variables.apiKeyLastFour,
        apiKeyScheme: variables.apiKeyScheme,
        apiKeyHeader: variables.apiKeyHeader ?? null,
        tools: variables.tools,
        toolCount: variables.toolCount,
        toolDefinitionHashes: variables.toolDefinitionHashes,
        autoApprovedTools: row.autoApprovedTools.filter(hash => !variables.removedToolDefinitionHashes.includes(hash)),
        configRevision: row.configRevision + variables.configRevisionIncrement,
        keyGeneration: row.keyGeneration + variables.keyGenerationIncrement,
        lastError: null,
      })

      return { organizationIntegration_updateMany: 1 }
    },
    RecordOrganizationIntegrationTools: variables => {
      checkAdministrator(variables, 'change a server')

      const row =
        findLive(variables, { configRevision: variables.configRevision, keyGeneration: variables.keyGeneration })
        ?? refuse('The server was changed or deleted meanwhile')

      Object.assign(row, {
        tools: variables.tools,
        toolCount: variables.toolCount,
        toolDefinitionHashes: variables.toolDefinitionHashes,
        autoApprovedTools: row.autoApprovedTools.filter(hash => !variables.removedToolDefinitionHashes.includes(hash)),
        lastError: null,
      })

      return { organizationIntegration_updateMany: 1 }
    },
    RecordOrganizationIntegrationIssuer: variables => {
      checkAdministrator(variables, 'change a server')

      const row =
        findLive(variables, { configRevision: variables.configRevision, issuer: variables.issuer })
        ?? refuse('The server was changed or deleted meanwhile')

      row.lastError = null

      return { organizationIntegration_updateMany: 1 }
    },
    ChangeOrganizationIntegrationIssuer: variables => {
      checkAdministrator(variables, 'change a server')

      const row =
        findLive(variables, {
          authentication: IntegrationAuthentication.OAUTH,
          configRevision: variables.configRevision,
        }) ?? refuse('The server was changed or deleted meanwhile')

      Object.assign(row, {
        issuer: variables.issuer,
        tools: null,
        toolCount: null,
        toolDefinitionHashes: [],
        autoApprovedTools: [],
        configRevision: row.configRevision + 1,
        lastError: null,
      })

      return { organizationIntegration_updateMany: 1 }
    },
    RecordOrganizationIntegrationError: variables => {
      checkAdministrator(variables, 'change a server')

      const row =
        findLive(variables, { configRevision: variables.configRevision, keyGeneration: variables.keyGeneration })
        ?? refuse('The server was changed or deleted meanwhile')

      row.lastError = variables.error

      return { organizationIntegration_updateMany: 1 }
    },
    SetOrganizationIntegrationEnabled: variables => {
      checkAdministrator(variables, 'change a server')

      const row = findLive(variables) ?? refuse('The server is gone')

      row.isEnabled = variables.isEnabled

      return { organizationIntegration_updateMany: 1 }
    },
    AllowOrganizationIntegrationTool: variables => {
      checkAdministrator(variables, 'change a server')

      const row = findLive(variables)

      if (!row || !row.toolDefinitionHashes.includes(variables.definitionHash)) {
        refuse('The server no longer lists this tool')
      }

      if (!row.autoApprovedTools.includes(variables.definitionHash))
        row.autoApprovedTools.push(variables.definitionHash)

      return { organizationIntegration_updateMany: 1 }
    },
    DisallowOrganizationIntegrationTool: variables => {
      checkAdministrator(variables, 'change a server')

      const row = findLive(variables) ?? refuse('The server is gone')

      row.autoApprovedTools = row.autoApprovedTools.filter(hash => hash !== variables.definitionHash)

      return { organizationIntegration_updateMany: 1 }
    },
    DeleteOrganizationIntegration: variables => {
      checkAdministrator(variables, 'delete a server')

      const row = findLive(variables) ?? refuse('The server is gone')

      row.deletedAt = new Date().toISOString()

      for (const [key, other] of integrations) {
        const isExpired = other.deletedAt && Date.parse(other.deletedAt) < Date.now() - DAY_MS

        if (other.organizationId === id(variables.organizationId) && isExpired) integrations.delete(key)
      }

      return { organizationIntegration_updateMany: 1, organizationIntegration_deleteMany: 0 }
    },
    RestoreOrganizationIntegration: variables => {
      checkAdministrator(variables, 'restore a server')

      if (live(variables.organizationId).length >= MAX_INTEGRATIONS) refuse('An organization adds at most 50 servers')

      checkNameFree({ ...variables, integrationId: null })

      const row = integrations.get(id(variables.integrationId))
      const isRestorable =
        row
        && row.organizationId === id(variables.organizationId)
        && row.normalizedName === variables.normalizedName
        && row.deletedAt
        && Date.parse(row.deletedAt) > Date.now() - DAY_MS

      if (!isRestorable) refuse('The server is gone for good')

      row.deletedAt = null

      return { organizationIntegration_updateMany: 1 }
    },
  }

  const sdk: Record<string, unknown> = {
    IntegrationAuthentication,
    IntegrationApiKeyScheme,
    IntegrationError,
    OrganizationRole,
  }

  for (const [name, operation] of Object.entries(operations)) {
    sdk[name.charAt(0).toLowerCase() + name.slice(1)] = async (_dataConnect: unknown, variables: AnyVariables) => {
      calls.push({ name, variables })

      return { data: operation(variables) }
    }
  }

  return {
    sdk,
    roles,
    staff,
    integrations,
    calls,
    addMember(userId: string, organizationId: string, role: string = OrganizationRole.MEMBER) {
      roles.set(membershipKey(userId, organizationId), role)
    },
    reset() {
      roles.clear()
      staff.clear()
      integrations.clear()
      calls.length = 0
    },
  }
}

export default createIntegrationDatabaseFake
