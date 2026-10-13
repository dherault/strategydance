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

export const IntegrationConnectionStatus = {
  CONNECTED: 'CONNECTED',
  NEEDS_AUTHENTICATION: 'NEEDS_AUTHENTICATION',
} as const

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
  oauthClientId: string | null
  encryptedOAuthClientSecret: string | null
  oauthClientSecretExpiresAt: string | null
  oauthClientAuthenticationMethod: string | null
  tools: string | null
  toolCount: number | null
  toolDefinitionHashes: string[]
  autoApprovedTools: string[]
  lastError: string | null
  deletedAt: string | null
}

// What a Connect and a connection share: the client, the resource and the authorization server's
// metadata they were made with
type FakeOAuthFields = {
  oauthClientId: string
  oauthClientAuthenticationMethod: string
  resource: string
  issuer: string
  isIssuerParameterSupported: boolean
  tokenEndpoint: string
  revocationEndpoint: string | null
}

export type FakeAuthorization = FakeOAuthFields & {
  id: string
  integrationId: string
  membershipUserId: string
  membershipOrganizationId: string
  stateHash: string
  encryptedCodeVerifier: string
  encryptedCode: string | null
  codeExpiresAt: string | null
  configRevision: number
  scope: string | null
  expiresAt: string
}

export type FakeConnection = FakeOAuthFields & {
  id: string
  integrationId: string
  membershipUserId: string
  membershipOrganizationId: string
  generation: string
  configRevision: number
  status: string
  accountLabel: string | null
  encryptedAccessToken: string | null
  encryptedRefreshToken: string | null
  accessTokenExpiresAt: string | null
  scope: string | null
  refreshingUntil: string | null
  refreshLeaseId: string | null
  createdAt: string
}

// What a test reads the variables of an operation as
type AnyVariables = Record<string, any>

const DAY_MS = 24 * 60 * 60 * 1000

const MINUTE_MS = 60 * 1000

// The client columns a server's row clears with its issuer
const NO_CLIENT = {
  oauthClientId: null,
  encryptedOAuthClientSecret: null,
  oauthClientSecretExpiresAt: null,
  oauthClientAuthenticationMethod: null,
}

function createIntegrationDatabaseFake() {
  // Each member's role, by user and organization
  const roles = new Map<string, string>()
  const staff = new Set<string>()
  const integrations = new Map<string, FakeIntegration>()
  // Members' Connects under way, by id, and their connections, by server and member
  const authorizations = new Map<string, FakeAuthorization>()
  const connections = new Map<string, FakeConnection>()
  // Every operation called, by name, in order, with its variables
  const calls: { name: string; variables: AnyVariables }[] = []
  // What a test does once, right before the operation named runs, as another caller would meanwhile
  const before = new Map<string, () => void>()

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

  function checkMember({ userId, organizationId }: AnyVariables) {
    if (!roles.has(membershipKey(userId, organizationId))) {
      refuse('Only a member of an organization can connect an account to its servers')
    }
  }

  // A reference to a membership that is gone, which Data Connect reports by its constraint
  function checkMembershipReference({ userId, organizationId }: AnyVariables, constraint: string) {
    if (!roles.has(membershipKey(userId, organizationId))) refuse(`violates foreign key constraint "${constraint}"`)
  }

  function connectionKey({ integrationId, userId }: AnyVariables) {
    return `${id(integrationId)}:${userId}`
  }

  // The member's own connection to the server, matched as the operations match it
  function findConnection(variables: AnyVariables) {
    const connection = connections.get(connectionKey(variables))

    return connection && connection.membershipOrganizationId === id(variables.organizationId) ? connection : null
  }

  // Deletes everything given for a server's old configuration: its members' connections and Connects
  function clearMembers(integrationId: string) {
    for (const [key, connection] of connections) {
      if (connection.integrationId === integrationId) connections.delete(key)
    }

    for (const [key, authorization] of authorizations) {
      if (authorization.integrationId === integrationId) authorizations.delete(key)
    }
  }

  // Deletes a member's Connect under way for a server, and says how many went
  function deleteAuthorizations(matches: (authorization: FakeAuthorization) => boolean) {
    let count = 0

    for (const [key, authorization] of authorizations) {
      if (!matches(authorization)) continue

      authorizations.delete(key)
      count++
    }

    return count
  }

  function isMember(row: { membershipUserId: string; membershipOrganizationId: string }, variables: AnyVariables) {
    return (
      row.membershipUserId === variables.userId
      && row.membershipOrganizationId === id(variables.organizationId)
      && ('integrationId' in row ? row.integrationId === id(variables.integrationId) : true)
    )
  }

  function isLater(time: string | null) {
    return time !== null && Date.parse(time) > Date.now()
  }

  // The lock a member's Connect takes on the server's row, at the revision and issuer it started under
  function lockServer(variables: AnyVariables) {
    const row = findLive(variables, {
      authentication: IntegrationAuthentication.OAUTH,
      configRevision: variables.configRevision,
      issuer: variables.issuer,
    })

    if (!row) refuse('The server was changed or deleted meanwhile')
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
        ...NO_CLIENT,
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

      const row =
        findLive(variables, { name: variables.readName }) ?? refuse('The server was changed or deleted meanwhile')

      Object.assign(row, { name: variables.name, normalizedName: variables.normalizedName })

      return { organizationIntegration_updateMany: 1 }
    },
    ReconfigureOrganizationIntegration: variables => {
      checkAdministrator(variables, 'change a server')
      checkNameFree(variables)

      const row =
        findLive(variables, {
          name: variables.readName,
          configRevision: variables.configRevision,
          keyGeneration: variables.keyGeneration,
        }) ?? refuse('The server was changed or deleted meanwhile')

      // Every variable is passed, as the mutation's comment asks: one left out would keep its column
      for (const field of [
        'catalogueSlug',
        'encryptedApiKey',
        'apiKeyLastFour',
        'apiKeyHeader',
        'issuer',
        'tools',
        'toolCount',
      ]) {
        if (!(field in variables)) throw new Error(`ReconfigureOrganizationIntegration was called without ${field}`)
      }

      Object.assign(row, {
        name: variables.name,
        normalizedName: variables.normalizedName,
        url: variables.url,
        catalogueSlug: variables.catalogueSlug,
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
        ...NO_CLIENT,
        configRevision: row.configRevision + 1,
        keyGeneration: row.keyGeneration + 1,
        lastError: null,
      })
      clearMembers(row.id)

      return { organizationIntegration_updateMany: 1 }
    },
    UpdateOrganizationIntegrationKey: variables => {
      checkAdministrator(variables, 'change a server')
      checkNameFree(variables)

      const row =
        findLive(variables, {
          authentication: IntegrationAuthentication.API_KEY,
          name: variables.readName,
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
        ...NO_CLIENT,
        configRevision: row.configRevision + 1,
        lastError: null,
      })
      clearMembers(row.id)

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

      const row = findLive(variables, { configRevision: variables.configRevision })

      if (!row || !row.toolDefinitionHashes.includes(variables.definitionHash)) {
        refuse('The server no longer lists this tool')
      }

      if (!row.autoApprovedTools.includes(variables.definitionHash))
        row.autoApprovedTools.push(variables.definitionHash)

      return { organizationIntegration_updateMany: 1 }
    },
    DisallowOrganizationIntegrationTool: variables => {
      checkAdministrator(variables, 'change a server')

      const row =
        findLive(variables, { configRevision: variables.configRevision })
        ?? refuse('The server was changed or deleted meanwhile')

      row.autoApprovedTools = row.autoApprovedTools.filter(hash => hash !== variables.definitionHash)

      return { organizationIntegration_updateMany: 1 }
    },
    DeleteOrganizationIntegration: variables => {
      checkAdministrator(variables, 'delete a server')

      const row = findLive(variables) ?? refuse('The server is gone')

      row.deletedAt = new Date().toISOString()

      for (const [key, other] of integrations) {
        const isExpired = other.deletedAt && Date.parse(other.deletedAt) < Date.now() - DAY_MS

        if (other.organizationId === id(variables.organizationId) && isExpired) {
          integrations.delete(key)
          clearMembers(key)
        }
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
    RecordOrganizationIntegrationOAuthClient: variables => {
      checkMember(variables)

      const row = findLive(variables, {
        authentication: IntegrationAuthentication.OAUTH,
        configRevision: variables.configRevision,
        issuer: variables.issuer,
        oauthClientId: null,
      })

      if (!row) return { organizationIntegration_updateMany: 0 }

      for (const field of ['encryptedOAuthClientSecret', 'oauthClientSecretExpiresAt']) {
        if (!(field in variables))
          throw new Error(`RecordOrganizationIntegrationOAuthClient was called without ${field}`)
      }

      Object.assign(row, {
        oauthClientId: variables.oauthClientId,
        encryptedOAuthClientSecret: variables.encryptedOAuthClientSecret,
        oauthClientSecretExpiresAt: variables.oauthClientSecretExpiresAt,
        oauthClientAuthenticationMethod: variables.oauthClientAuthenticationMethod,
      })

      return { organizationIntegration_updateMany: 1 }
    },
    ForgetOrganizationIntegrationOAuthClient: variables => {
      checkMember(variables)

      const row = integrations.get(id(variables.integrationId))

      if (
        !row
        || row.organizationId !== id(variables.organizationId)
        || row.oauthClientId !== variables.oauthClientId
      ) {
        return { organizationIntegration_updateMany: 0 }
      }

      Object.assign(row, NO_CLIENT)

      return { organizationIntegration_updateMany: 1 }
    },
    StartIntegrationAuthorization: variables => {
      lockServer(variables)
      checkMember(variables)

      if ([...authorizations.values()].some(other => other.stateHash === variables.stateHash)) {
        refuse('duplicate key value violates unique constraint')
      }

      deleteAuthorizations(authorization => isMember(authorization, variables))
      authorizations.set(id(variables.authorizationId), {
        id: id(variables.authorizationId),
        integrationId: id(variables.integrationId),
        membershipUserId: variables.userId,
        membershipOrganizationId: id(variables.organizationId),
        stateHash: variables.stateHash,
        encryptedCodeVerifier: variables.encryptedCodeVerifier,
        encryptedCode: null,
        codeExpiresAt: null,
        configRevision: variables.configRevision,
        oauthClientId: variables.oauthClientId,
        oauthClientAuthenticationMethod: variables.oauthClientAuthenticationMethod,
        resource: variables.resource,
        scope: variables.scope ?? null,
        issuer: variables.issuer,
        isIssuerParameterSupported: variables.isIssuerParameterSupported,
        tokenEndpoint: variables.tokenEndpoint,
        revocationEndpoint: variables.revocationEndpoint ?? null,
        expiresAt: new Date(Date.now() + 10 * MINUTE_MS).toISOString(),
      })

      return { integrationAuthorization_insert: { id: id(variables.authorizationId) } }
    },
    GetIntegrationAuthorizationByState: ({ stateHash }) => ({
      integrationAuthorizations: [...authorizations.values()]
        .filter(authorization => authorization.stateHash === stateHash)
        .map(authorization => ({ ...authorization })),
    }),
    ReceiveIntegrationAuthorizationCode: ({ authorizationId, stateHash, encryptedCode }) => {
      const authorization = authorizations.get(id(authorizationId))
      const isTaken =
        authorization
        && authorization.stateHash === stateHash
        && authorization.encryptedCode === null
        && isLater(authorization.expiresAt)

      if (!isTaken) refuse('The sign-in was finished already or has expired')

      authorization.encryptedCode = encryptedCode
      authorization.codeExpiresAt = new Date(Date.now() + 2 * MINUTE_MS).toISOString()

      return { integrationAuthorization_updateMany: 1 }
    },
    DeleteIntegrationAuthorizationByState: ({ authorizationId, stateHash }) => ({
      integrationAuthorization_deleteMany: deleteAuthorizations(
        authorization =>
          authorization.id === id(authorizationId)
          && authorization.stateHash === stateHash
          && authorization.encryptedCode === null,
      ),
    }),
    GetIntegrationAuthorizationForMember: ({ organizationId, integrationId, authorizationId }) => {
      const authorization = authorizations.get(id(authorizationId))
      const isFound =
        authorization
        && authorization.integrationId === id(integrationId)
        && authorization.membershipOrganizationId === id(organizationId)

      return { integrationAuthorizations: isFound ? [{ ...authorization }] : [] }
    },
    ConsumeIntegrationAuthorization: variables => {
      const count = deleteAuthorizations(
        authorization =>
          authorization.id === id(variables.authorizationId)
          && isMember(authorization, variables)
          && authorization.encryptedCode !== null
          && isLater(authorization.codeExpiresAt),
      )

      if (count !== 1) refuse('The sign-in was finished already or has expired')

      return { integrationAuthorization_deleteMany: count }
    },
    CancelIntegrationAuthorization: variables => ({
      integrationAuthorization_deleteMany: deleteAuthorizations(
        authorization => authorization.id === id(variables.authorizationId) && isMember(authorization, variables),
      ),
    }),
    ConnectIntegration: variables => {
      lockServer(variables)
      checkMembershipReference(variables, 'integration_connection_membership_fkey')
      checkMember(variables)

      for (const field of [
        'accountLabel',
        'revocationEndpoint',
        'encryptedRefreshToken',
        'accessTokenExpiresAt',
        'scope',
      ]) {
        if (!(field in variables)) throw new Error(`ConnectIntegration was called without ${field}`)
      }

      connections.set(connectionKey(variables), {
        id: crypto.randomUUID().replaceAll('-', ''),
        integrationId: id(variables.integrationId),
        membershipUserId: variables.userId,
        membershipOrganizationId: id(variables.organizationId),
        generation: id(variables.generation),
        configRevision: variables.configRevision,
        status: IntegrationConnectionStatus.CONNECTED,
        accountLabel: variables.accountLabel,
        oauthClientId: variables.oauthClientId,
        oauthClientAuthenticationMethod: variables.oauthClientAuthenticationMethod,
        resource: variables.resource,
        issuer: variables.issuer,
        isIssuerParameterSupported: variables.isIssuerParameterSupported,
        tokenEndpoint: variables.tokenEndpoint,
        revocationEndpoint: variables.revocationEndpoint,
        encryptedAccessToken: variables.encryptedAccessToken,
        encryptedRefreshToken: variables.encryptedRefreshToken,
        accessTokenExpiresAt: variables.accessTokenExpiresAt,
        scope: variables.scope,
        refreshingUntil: null,
        refreshLeaseId: null,
        createdAt: new Date().toISOString(),
      })

      return { organizationIntegration_updateMany: 1 }
    },
    RecordFirstIntegrationTools: variables => {
      checkMember(variables)

      const row = findLive(variables, {
        authentication: IntegrationAuthentication.OAUTH,
        configRevision: variables.configRevision,
        toolCount: null,
      })

      if (!row) return { organizationIntegration_updateMany: 0 }

      Object.assign(row, {
        tools: variables.tools,
        toolCount: variables.toolCount,
        toolDefinitionHashes: variables.toolDefinitionHashes,
      })

      return { organizationIntegration_updateMany: 1 }
    },
    GetIntegrationConnectionForMember: variables => {
      const connection = findConnection(variables)
      const row = connection && integrations.get(connection.integrationId)

      if (!connection || !row) return { integrationConnections: [] }

      const { url, authentication, configRevision, isEnabled, oauthClientId, encryptedOAuthClientSecret, deletedAt } =
        row

      return {
        integrationConnections: [
          {
            ...connection,
            integration: {
              url,
              authentication,
              configRevision,
              isEnabled,
              oauthClientId,
              encryptedOAuthClientSecret,
              deletedAt,
            },
          },
        ],
      }
    },
    ClaimIntegrationConnectionRefresh: variables => {
      const connection = findConnection(variables)
      const isClaimed =
        connection
        && connection.generation === id(variables.generation)
        && connection.encryptedRefreshToken === variables.encryptedRefreshToken
        && connection.status === IntegrationConnectionStatus.CONNECTED
        && !isLater(connection.refreshingUntil)

      if (!isClaimed) return { integrationConnection_updateMany: 0 }

      connection.refreshingUntil = new Date(Date.now() + 2 * MINUTE_MS).toISOString()
      connection.refreshLeaseId = id(variables.refreshLeaseId)

      return { integrationConnection_updateMany: 1 }
    },
    RecordIntegrationConnectionTokens: variables => {
      const connection = findConnection(variables)

      if (!connection || connection.refreshLeaseId !== id(variables.refreshLeaseId)) {
        refuse('The refresh lost its lease')
      }

      for (const field of ['encryptedRefreshToken', 'accessTokenExpiresAt', 'scope']) {
        if (!(field in variables)) throw new Error(`RecordIntegrationConnectionTokens was called without ${field}`)
      }

      Object.assign(connection, {
        encryptedAccessToken: variables.encryptedAccessToken,
        encryptedRefreshToken: variables.encryptedRefreshToken,
        accessTokenExpiresAt: variables.accessTokenExpiresAt,
        scope: variables.scope,
        refreshingUntil: null,
        refreshLeaseId: null,
      })

      return { integrationConnection_updateMany: 1 }
    },
    ReleaseIntegrationConnectionRefresh: variables => {
      const connection = findConnection(variables)

      if (!connection || connection.refreshLeaseId !== id(variables.refreshLeaseId)) {
        return { integrationConnection_updateMany: 0 }
      }

      Object.assign(connection, { refreshingUntil: null, refreshLeaseId: null })

      return { integrationConnection_updateMany: 1 }
    },
    MarkIntegrationConnectionNeedsAuthentication: variables => {
      const connection = findConnection(variables)
      const isMarked =
        connection
        && connection.generation === id(variables.generation)
        && connection.encryptedAccessToken === variables.encryptedAccessToken
        && connection.refreshLeaseId === id(variables.refreshLeaseId)

      if (!isMarked) return { integrationConnection_updateMany: 0 }

      Object.assign(connection, {
        status: IntegrationConnectionStatus.NEEDS_AUTHENTICATION,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshingUntil: null,
        refreshLeaseId: null,
      })

      return { integrationConnection_updateMany: 1 }
    },
    MarkIntegrationConnectionTokenRefused: variables => {
      const connection = findConnection(variables)
      const isMarked =
        connection
        && connection.generation === id(variables.generation)
        && connection.encryptedAccessToken === variables.encryptedAccessToken
        && !isLater(connection.refreshingUntil)

      if (!isMarked) return { integrationConnection_updateMany: 0 }

      Object.assign(connection, {
        status: IntegrationConnectionStatus.NEEDS_AUTHENTICATION,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshingUntil: null,
        refreshLeaseId: null,
      })

      return { integrationConnection_updateMany: 1 }
    },
    DisconnectIntegration: variables => {
      const connection = findConnection(variables)
      const isDeleted = connection !== null && connection.generation === id(variables.generation)

      if (isDeleted) connections.delete(connectionKey(variables))

      return { integrationConnection_deleteMany: isDeleted ? 1 : 0 }
    },
    PruneIntegrationAuthorizations: () => ({
      integrationAuthorization_deleteMany: deleteAuthorizations(
        authorization => Date.parse(authorization.expiresAt) < Date.now() - 60 * MINUTE_MS,
      ),
    }),
  }

  const sdk: Record<string, unknown> = {
    IntegrationAuthentication,
    IntegrationApiKeyScheme,
    IntegrationError,
    OrganizationRole,
    IntegrationConnectionStatus,
  }

  for (const [name, operation] of Object.entries(operations)) {
    sdk[name.charAt(0).toLowerCase() + name.slice(1)] = async (_dataConnect: unknown, variables: AnyVariables) => {
      const meanwhile = before.get(name)

      before.delete(name)
      meanwhile?.()
      calls.push({ name, variables })

      return { data: operation(variables) }
    }
  }

  return {
    sdk,
    roles,
    staff,
    integrations,
    authorizations,
    connections,
    calls,
    before,
    addMember(userId: string, organizationId: string, role: string = OrganizationRole.MEMBER) {
      roles.set(membershipKey(userId, organizationId), role)
    },
    // Removes a member, their connections and Connects going with the membership they reference
    removeMember(userId: string, organizationId: string) {
      roles.delete(membershipKey(userId, organizationId))

      for (const [key, connection] of connections) {
        if (isMember(connection, { userId, organizationId, integrationId: connection.integrationId })) {
          connections.delete(key)
        }
      }

      deleteAuthorizations(authorization =>
        isMember(authorization, { userId, organizationId, integrationId: authorization.integrationId }),
      )
    },
    reset() {
      roles.clear()
      staff.clear()
      integrations.clear()
      authorizations.clear()
      connections.clear()
      calls.length = 0
      before.clear()
    },
  }
}

export default createIntegrationDatabaseFake
