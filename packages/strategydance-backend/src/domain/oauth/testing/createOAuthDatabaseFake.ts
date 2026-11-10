import { MAX_AGENT_CONNECTION_ORGANIZATIONS, MAX_AGENT_CONNECTIONS } from 'strategydance-core'

import { OAUTH_REFRESH_GRACE_SECONDS } from '~constants'

import type { AnyVariables, ModuleDatabaseFakeBase } from '~domain/modules/testing/createModuleDatabaseFakeBase'

/*
  The backend connector's authorization server operations, over tables kept in memory, added to a
  module database fake's base, whose memberships they reference, for the OAuth tests. Each operation
  mirrors the conditions of its namesake in the connector and throws the same messages, a foreign
  key's included where Data Connect reports one first, so a test reads as the behaviour it checks.
  `check:oauth` checks those conditions against the emulators, which is what keeps the two alike:
  change one with the other.

  Times are the clock's, which a test moves with `setSystemTime`, as the database's are. A
  connection references the account alone, so removing a member leaves it, listing an organization
  it reaches no more
*/

export type FakeOAuthClient = {
  id: string
  name: string | null
  redirectUris: string[]
  createdAt: string
  lastUsedAt: string | null
}

export type FakeOAuthAuthorizationRequest = {
  id: string
  clientId: string
  registeredClientId: string | null
  redirectUri: string
  codeChallenge: string
  resource: string
  scopes: string[]
  state: string | null
  expiresAt: string
  decidedAt: string | null
  isApproved: boolean | null
  connectionId: string | null
  codeHash: string | null
  codeExpiresAt: string | null
  codeUsedAt: string | null
  createdAt: string
}

export type FakeAgentConnection = {
  id: string
  userId: string
  organizationIds: string[]
  grantedAt: string
  clientId: string
  registeredClientId: string | null
  clientName: string | null
  module: string
  scopes: string[]
  createdAt: string
  lastUsedAt: string | null
}

export type FakeAgentConnectionToken = {
  id: string
  connectionId: string
  kind: 'ACCESS' | 'REFRESH'
  hash: string
  resource: string
  scopes: string[]
  issuedFrom: string
  expiresAt: string
  usedAt: string | null
  successorKeyVersion: number | null
  createdAt: string
}

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const AgentConnectionTokenKind = { ACCESS: 'ACCESS', REFRESH: 'REFRESH' } as const

function createOAuthDatabaseFake<Base extends ModuleDatabaseFakeBase>(base: Base) {
  const { stamp, id, memberships } = base
  const clients = new Map<string, FakeOAuthClient>()
  const requests = new Map<string, FakeOAuthAuthorizationRequest>()
  const connections = new Map<string, FakeAgentConnection>()
  const tokens = new Map<string, FakeAgentConnectionToken>()

  // Declared here rather than read off the base, so a call narrows what follows it
  function refuse(message: string): never {
    throw new Error(message)
  }

  function now() {
    return Date.now()
  }

  function at(time: number) {
    return new Date(time).toISOString()
  }

  function isPast(time: string | null) {
    return time !== null && Date.parse(time) <= now()
  }

  function isFuture(time: string | null) {
    return time !== null && Date.parse(time) > now()
  }

  function membershipOf(userId: unknown, organizationId: unknown) {
    return memberships.get(`${userId}:${id(organizationId)}`) ?? null
  }

  // An organization's slug and name, as a read through its membership selects them
  function organizationOf(organizationId: unknown) {
    const { slug = null, name = '' } = base.organizations.get(id(organizationId)) ?? {}

    return { slug, name }
  }

  // A member's memberships, in joined order, the organization's id breaking a tie, as
  // `userOrganizations_on_user` reads them
  function membershipsOfUser(userId: unknown) {
    return [...memberships.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([key, { createdAt }]) => ({ organizationId: key.slice(String(userId).length + 1), createdAt }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.organizationId.localeCompare(b.organizationId))
  }

  // Deletes a connection with its tokens, and lets go of the requests that named it, as the
  // references cascade and set null
  function deleteConnection(connectionId: string) {
    if (!connections.delete(connectionId)) return 0

    for (const [tokenId, token] of tokens) if (token.connectionId === connectionId) tokens.delete(tokenId)
    for (const request of requests.values()) if (request.connectionId === connectionId) request.connectionId = null

    return 1
  }

  function tokenByHash(hash: unknown) {
    return [...tokens.values()].find(token => token.hash === hash) ?? null
  }

  function insertToken(fields: Omit<FakeAgentConnectionToken, 'id' | 'usedAt' | 'successorKeyVersion' | 'createdAt'>) {
    const token: FakeAgentConnectionToken = {
      id: id(crypto.randomUUID()),
      usedAt: null,
      successorKeyVersion: null,
      createdAt: stamp(),
      ...fields,
    }

    tokens.set(token.id, token)
  }

  // Refuses a token whose hash is taken, as the column's unique index does
  function checkHashes(...hashes: unknown[]) {
    if (new Set(hashes).size !== hashes.length || hashes.some(hash => tokenByHash(hash))) {
      refuse('violates SQL unique constraint: agent_connection_token_hash_uidx (aborted)')
    }
  }

  function connectionsOf(userId: string) {
    return [...connections.values()].filter(connection => connection.userId === userId)
  }

  function tokensOf(connectionId: string) {
    return [...tokens.values()].filter(token => token.connectionId === connectionId)
  }

  base.addOperations({
    GetOAuthClient: variables => ({ oAuthClient: clients.get(id(variables.id)) ?? null }),

    GetPendingOAuthAuthorizationRequest: variables => {
      const request = requests.get(id(variables.id))

      return {
        oAuthAuthorizationRequests:
          request && request.decidedAt === null && isFuture(request.expiresAt) ? [{ ...request }] : [],
      }
    },

    GetOAuthAuthorizationRequestByCode: variables => {
      const request = [...requests.values()].find(({ codeHash }) => codeHash === variables.codeHash)

      if (!request) return { oAuthAuthorizationRequests: [] }

      const connection = request.connectionId ? connections.get(request.connectionId) : undefined

      return {
        oAuthAuthorizationRequests: [
          { ...request, connection: connection ? { id: connection.id, scopes: [...connection.scopes] } : null },
        ],
      }
    },

    GetAgentConnectionRefreshToken: variables => {
      const token = tokenByHash(variables.hash)

      if (!token || token.kind !== 'REFRESH' || !isFuture(token.expiresAt)) return { token: [], recentlySpent: [] }

      const connection = connections.get(token.connectionId)!
      const isRecentlySpent =
        token.usedAt !== null && Date.parse(token.usedAt) >= now() - OAUTH_REFRESH_GRACE_SECONDS * SECOND_MS

      return {
        token: [
          {
            id: token.id,
            resource: token.resource,
            scopes: [...token.scopes],
            usedAt: token.usedAt,
            successorKeyVersion: token.successorKeyVersion,
            connection: {
              id: connection.id,
              clientId: connection.clientId,
              scopes: [...connection.scopes],
              organizationIds: [...connection.organizationIds],
              grantedAt: connection.grantedAt,
              user: { userOrganizations_on_user: membershipsOfUser(connection.userId) },
            },
          },
        ],
        recentlySpent: isRecentlySpent ? [{ id: token.id }] : [],
      }
    },

    GetAgentConnectionTokens: variables => ({
      agentConnectionTokens: [...tokens.values()]
        .filter(token => (variables.hashes as string[]).includes(token.hash) && isFuture(token.expiresAt))
        .map(({ hash, kind, scopes, expiresAt, connectionId, usedAt, successorKeyVersion }) => ({
          hash,
          kind,
          scopes: [...scopes],
          expiresAt,
          connectionId,
          usedAt,
          successorKeyVersion,
        })),
    }),

    GetAgentConnectionAccessToken: variables => {
      const token = tokenByHash(variables.hash)

      if (!token || token.kind !== 'ACCESS' || !isFuture(token.expiresAt)) return { agentConnectionTokens: [] }

      const connection = connections.get(token.connectionId)!

      return {
        agentConnectionTokens: [
          {
            resource: token.resource,
            scopes: [...token.scopes],
            expiresAt: token.expiresAt,
            connection: {
              id: connection.id,
              userId: connection.userId,
              clientId: connection.clientId,
              module: connection.module,
              scopes: [...connection.scopes],
              organizationIds: [...connection.organizationIds],
              grantedAt: connection.grantedAt,
              user: {
                userOrganizations_on_user: membershipsOfUser(connection.userId).map(membership => ({
                  ...membership,
                  organization: organizationOf(membership.organizationId),
                })),
              },
            },
          },
        ],
      }
    },

    GetAgentConnectionForConsent: variables => {
      const connection = connectionsOf(String(variables.userId)).find(
        ({ clientId, module }) => clientId === variables.clientId && module === variables.module,
      )

      return {
        agentConnections: connection
          ? [
              {
                organizationIds: [...connection.organizationIds],
                grantedAt: connection.grantedAt,
                scopes: [...connection.scopes],
              },
            ]
          : [],
        userOrganizations: membershipsOfUser(variables.userId),
      }
    },

    GetAgentConnectionTokenForRevocation: variables => {
      const token = tokenByHash(variables.hash)

      if (!token) return { agentConnectionTokens: [] }

      const connection = connections.get(token.connectionId)!

      return {
        agentConnectionTokens: [
          { id: token.id, kind: token.kind, connection: { id: connection.id, clientId: connection.clientId } },
        ],
      }
    },

    CreateOAuthClient: variables => {
      const registeredToday = [...clients.values()].filter(({ createdAt }) => Date.parse(createdAt) > now() - DAY_MS)
      const name = variables.name as string | null | undefined
      const redirectUris = variables.redirectUris as string[]

      if (registeredToday.length >= 1000) refuse('Strategy Dance takes no more registrations today')
      if (name !== undefined && name !== null && (name.length < 1 || name.length > 80)) {
        refuse("A client's name is 1 to 80 characters")
      }
      if (redirectUris.length < 1 || redirectUris.length > 10) refuse('A client registers 1 to 10 redirect addresses')

      const client: FakeOAuthClient = {
        id: id(crypto.randomUUID()),
        name: name ?? null,
        redirectUris: [...redirectUris],
        createdAt: stamp(),
        lastUsedAt: null,
      }

      clients.set(client.id, client)

      return { oAuthClient_insert: { id: client.id } }
    },

    CreateOAuthAuthorizationRequest: (variables: AnyVariables) => {
      const recent = [...requests.values()].filter(({ createdAt }) => Date.parse(createdAt) > now() - 10 * MINUTE_MS)
      const registeredClientId = variables.registeredClientId ? id(variables.registeredClientId) : null

      if (recent.length >= 1000) refuse('Strategy Dance takes no more authorization requests for now')
      if (registeredClientId && !clients.has(registeredClientId)) {
        refuse('violates SQL foreign key constraint: o_auth_authorization_request_registered_client_id_fkey')
      }

      const request: FakeOAuthAuthorizationRequest = {
        id: id(crypto.randomUUID()),
        clientId: variables.clientId,
        registeredClientId,
        redirectUri: variables.redirectUri,
        codeChallenge: variables.codeChallenge,
        resource: variables.resource,
        scopes: [...variables.scopes],
        state: variables.state ?? null,
        expiresAt: at(now() + 10 * MINUTE_MS),
        decidedAt: null,
        isApproved: null,
        connectionId: null,
        codeHash: null,
        codeExpiresAt: null,
        codeUsedAt: null,
        createdAt: stamp(),
      }

      requests.set(request.id, request)

      return { oAuthAuthorizationRequest_insert: { id: request.id } }
    },

    RecordOAuthClientUse: variables => {
      const client = clients.get(id(variables.id))

      if (client) client.lastUsedAt = at(now())

      return { oAuthClient_update: client ? { id: client.id } : null }
    },

    ApproveOAuthAuthorizationRequest: (variables: AnyVariables) => {
      const request = requests.get(id(variables.id))
      const registeredClientId = variables.registeredClientId ? id(variables.registeredClientId) : null
      const scopes = variables.scopes as string[]
      // Left out by the backend before the one address, and then nothing beyond `$scopes`
      const heldScopes = (variables.heldScopes as string[] | null | undefined) ?? []

      const organizationIds = (variables.organizationIds as string[]).map(id)

      if (organizationIds.length < 1 || organizationIds.length > MAX_AGENT_CONNECTION_ORGANIZATIONS) {
        refuse("An agent reaches 1 to 20 of the member's organizations")
      }
      // The memberships locked, counted against the list, so one named twice fails as a stranger's
      if (
        new Set(organizationIds).size !== organizationIds.length
        || organizationIds.some(organizationId => !membershipOf(variables.userId, organizationId))
      ) {
        refuse('Only a member of an organization can connect an agent to it')
      }
      if (registeredClientId && !clients.has(registeredClientId)) {
        refuse('violates SQL foreign key constraint: agent_connection_registered_client_id_fkey (aborted)')
      }
      // Counted after the lock, leaving out the connection this one replaces
      if (
        connectionsOf(String(variables.userId)).filter(
          connection => !(connection.clientId === variables.clientId && connection.module === variables.module),
        ).length >= MAX_AGENT_CONNECTIONS
      ) {
        refuse('A member connects at most 100 agents')
      }
      // Read after the lock, before the delete: each scope kept beyond the request's held by the
      // connection this consent replaces
      const replaced = connectionsOf(String(variables.userId)).find(
        connection => connection.clientId === variables.clientId && connection.module === variables.module,
      )

      if (heldScopes.some(scope => !replaced?.scopes.includes(scope))) {
        refuse('The connection this consent replaces holds no such access')
      }
      if (
        !request
        || request.clientId !== variables.clientId
        || request.resource !== variables.resource
        || !scopes.every(scope => request.scopes.includes(scope))
        || request.decidedAt !== null
        || !isFuture(request.expiresAt)
      ) {
        refuse('The authorization request was decided already or has expired')
      }
      if ([...requests.values()].some(({ codeHash }) => codeHash === variables.codeHash)) {
        refuse('violates SQL unique constraint: o_auth_authorization_request_codeHash_uidx (aborted)')
      }

      for (const connection of connectionsOf(String(variables.userId))) {
        if (connection.clientId === variables.clientId && connection.module === variables.module) {
          deleteConnection(connection.id)
        }
      }

      const time = stamp()
      const connection: FakeAgentConnection = {
        id: id(variables.connectionId),
        userId: variables.userId,
        organizationIds,
        grantedAt: time,
        clientId: variables.clientId,
        registeredClientId,
        clientName: variables.clientName ?? null,
        module: variables.module,
        // Appended once inserted, as the mutation's step of its own does
        scopes: [...scopes, ...heldScopes],
        createdAt: time,
        lastUsedAt: null,
      }

      connections.set(connection.id, connection)
      Object.assign(request, {
        decidedAt: at(now()),
        isApproved: true,
        connectionId: connection.id,
        codeHash: variables.codeHash,
        codeExpiresAt: at(now() + MINUTE_MS),
      })

      return { agentConnection_insert: { id: connection.id }, oAuthAuthorizationRequest_updateMany: 1 }
    },

    DenyOAuthAuthorizationRequest: variables => {
      const request = requests.get(id(variables.id))

      if (!request || request.decidedAt !== null || !isFuture(request.expiresAt)) {
        refuse('The authorization request was decided already or has expired')
      }

      Object.assign(request, { decidedAt: at(now()), isApproved: false })

      return { oAuthAuthorizationRequest_updateMany: 1 }
    },

    ExchangeOAuthAuthorizationCode: (variables: AnyVariables) => {
      const request = requests.get(id(variables.id))
      const connectionId = id(variables.connectionId)
      const scopes = variables.scopes as string[]
      const connection = connections.get(connectionId)

      // The new tokens' reference to a connection gone meanwhile, which Data Connect reports first
      if (!connection)
        refuse('violates SQL foreign key constraint: agent_connection_token_connection_id_fkey (aborted)')

      if (
        !request
        || request.codeHash !== variables.codeHash
        || request.connectionId !== connectionId
        || !connection
        || !scopes.every(scope => connection.scopes.includes(scope))
        || request.codeUsedAt !== null
        || !isFuture(request.codeExpiresAt)
      ) {
        refuse('The code was used already or has expired')
      }

      checkHashes(variables.accessTokenHash, variables.refreshTokenHash)

      request.codeUsedAt = at(now())
      insertToken({
        connectionId,
        kind: 'ACCESS',
        hash: variables.accessTokenHash,
        resource: variables.resource,
        scopes: [...scopes],
        issuedFrom: request.id,
        expiresAt: at(now() + HOUR_MS),
      })
      insertToken({
        connectionId,
        kind: 'REFRESH',
        hash: variables.refreshTokenHash,
        resource: variables.resource,
        scopes: [...scopes],
        issuedFrom: request.id,
        expiresAt: at(now() + 30 * DAY_MS),
      })

      return { oAuthAuthorizationRequest_updateMany: 1 }
    },

    RotateAgentConnectionRefreshToken: (variables: AnyVariables) => {
      const token = tokens.get(id(variables.id))
      const connectionId = id(variables.connectionId)
      const accessScopes = variables.accessScopes as string[]
      const refreshScopes = variables.refreshScopes as string[]

      // The new tokens' reference to a connection gone meanwhile, which Data Connect reports first
      if (!connections.has(connectionId)) {
        refuse('violates SQL foreign key constraint: agent_connection_token_connection_id_fkey (aborted)')
      }

      if (
        !token
        || token.connectionId !== connectionId
        || token.kind !== 'REFRESH'
        || token.usedAt !== null
        || !isFuture(token.expiresAt)
        || ![...accessScopes, ...refreshScopes].every(scope => token.scopes.includes(scope))
      ) {
        refuse('The refresh token was used already or has expired')
      }

      checkHashes(variables.accessTokenHash, variables.refreshTokenHash)

      Object.assign(token, { usedAt: at(now()), successorKeyVersion: variables.successorKeyVersion })
      insertToken({
        connectionId,
        kind: 'ACCESS',
        hash: variables.accessTokenHash,
        resource: variables.resource,
        scopes: [...accessScopes],
        issuedFrom: token.id,
        expiresAt: at(now() + HOUR_MS),
      })
      insertToken({
        connectionId,
        kind: 'REFRESH',
        hash: variables.refreshTokenHash,
        resource: variables.resource,
        scopes: [...refreshScopes],
        issuedFrom: token.id,
        expiresAt: at(now() + 30 * DAY_MS),
      })

      return { agentConnectionToken_updateMany: 1 }
    },

    RevokeAgentConnection: variables => ({ agentConnection_deleteMany: deleteConnection(id(variables.id)) }),

    DeleteAgentConnectionAccessToken: variables => {
      const token = tokens.get(id(variables.id))
      const deleted = token?.kind === 'ACCESS' && tokens.delete(token.id)

      return { agentConnectionToken_deleteMany: deleted ? 1 : 0 }
    },

    RecordAgentConnectionUse: variables => {
      const connection = connections.get(id(variables.id))

      if (!connection || connection.userId !== variables.userId) return { agentConnection_updateMany: 0 }
      if (connection.lastUsedAt !== null && Date.parse(connection.lastUsedAt) >= now() - MINUTE_MS) {
        return { agentConnection_updateMany: 0 }
      }

      connection.lastUsedAt = stamp()

      return { agentConnection_updateMany: 1 }
    },

    PruneOAuthAuthorizationRequests: () => {
      let deleted = 0

      for (const [requestId, request] of requests) {
        if (Date.parse(request.expiresAt) < now() - DAY_MS) {
          requests.delete(requestId)
          deleted++
        }
      }

      return { oAuthAuthorizationRequest_deleteMany: deleted }
    },

    PruneUnservedAgentConnections: variables => {
      let deleted = 0

      for (const [connectionId, connection] of connections) {
        const isUnserved = !(variables.modules as string[]).includes(connection.module)
        const isOld = Date.parse(connection.createdAt) < now() - 7 * DAY_MS
        const isIdle = connection.lastUsedAt === null || Date.parse(connection.lastUsedAt) < now() - 7 * DAY_MS

        if (isUnserved && isOld && isIdle) deleted += deleteConnection(connectionId)
      }

      return { agentConnection_deleteMany: deleted }
    },

    PruneAgentConnectionTokens: () => {
      let deleted = 0

      for (const [tokenId, token] of tokens) {
        if (isPast(token.expiresAt)) {
          tokens.delete(tokenId)
          deleted++
        }
      }

      return { agentConnectionToken_deleteMany: deleted }
    },

    PruneOAuthClients: () => {
      let deleted = 0

      for (const [clientId, client] of clients) {
        const isOld = Date.parse(client.createdAt) < now() - DAY_MS
        const isUnused = client.lastUsedAt === null || Date.parse(client.lastUsedAt) < now() - DAY_MS
        const isConnected = [...connections.values()].some(({ registeredClientId }) => registeredClientId === clientId)

        if (isOld && isUnused && !isConnected) {
          clients.delete(clientId)

          for (const request of requests.values()) {
            if (request.registeredClientId === clientId) request.registeredClientId = null
          }

          deleted++
        }
      }

      return { oAuthClient_deleteMany: deleted }
    },
  })

  Object.assign(base.sdk, { AgentConnectionTokenKind })

  base.onReset(() => {
    for (const table of [clients, requests, connections, tokens]) table.clear()
  })

  return Object.assign(base, {
    clients,
    requests,
    connections,
    tokens,
    connectionsOf,
    tokensOf,
    membershipsOfUser,
    deleteConnection,
  })
}

export type OAuthDatabaseFake = ReturnType<typeof createOAuthDatabaseFake<ModuleDatabaseFakeBase>>

export default createOAuthDatabaseFake
