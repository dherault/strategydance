import { OAUTH_REFRESH_GRACE_SECONDS } from '~constants'

import type { AnyVariables, ModuleDatabaseFakeBase } from '~domain/modules/testing/createModuleDatabaseFakeBase'

/*
  The backend connector's authorization server operations, over tables kept in memory, added to a
  module database fake's base, whose memberships they reference, for the OAuth tests. Each operation
  mirrors the conditions of its namesake in the connector and throws the same messages, a foreign
  key's included where Data Connect reports one first, so a test reads as the behaviour it checks.
  `check:oauth` checks those conditions against the emulators, which is what keeps the two alike:
  change one with the other.

  Times are the clock's, which a test moves with `setSystemTime`, as the database's are. Removing a
  member deletes their connections with the tokens, as the reference to the membership cascades
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
  organizationId: string
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
  // The accounts that are Strategy Dance's administrators
  const staff = new Set<string>()

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

  // Whether the account is Strategy Dance's administrator, as a test sets it
  function setStaff(userId: string, isStaff = true) {
    if (isStaff) staff.add(userId)
    else staff.delete(userId)
  }

  function connectionsOf(userId: string, organizationId: string) {
    return [...connections.values()].filter(
      connection => connection.userId === userId && connection.organizationId === id(organizationId),
    )
  }

  function tokensOf(connectionId: string) {
    return [...tokens.values()].filter(token => token.connectionId === connectionId)
  }

  base.onRemoveMember((userId, organizationId) => {
    for (const connection of connectionsOf(userId, organizationId)) deleteConnection(connection.id)
  })

  base.addOperations({
    GetUserStaffStatus: variables => ({ user: { isAdministrator: staff.has(String(variables.userId)) } }),

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
            connection: { id: connection.id, clientId: connection.clientId, scopes: [...connection.scopes] },
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
      const membership = membershipOf(connection.userId, connection.organizationId)!

      return {
        agentConnectionTokens: [
          {
            resource: token.resource,
            scopes: [...token.scopes],
            expiresAt: token.expiresAt,
            connection: {
              id: connection.id,
              clientId: connection.clientId,
              module: connection.module,
              scopes: [...connection.scopes],
              membership: {
                userId: connection.userId,
                organizationId: connection.organizationId,
                createdAt: membership.createdAt,
                user: { isAdministrator: staff.has(connection.userId) },
              },
            },
          },
        ],
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

      // Data Connect reports the connection's reference to the membership before the lock's check
      if (!membershipOf(variables.userId, variables.organizationId)) {
        refuse('violates SQL foreign key constraint: agent_connection_membership_fkey (aborted)')
      }
      if (registeredClientId && !clients.has(registeredClientId)) {
        refuse('violates SQL foreign key constraint: agent_connection_registered_client_id_fkey (aborted)')
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

      for (const connection of connectionsOf(String(variables.userId), String(variables.organizationId))) {
        if (connection.clientId === variables.clientId && connection.module === variables.module) {
          deleteConnection(connection.id)
        }
      }

      const connection: FakeAgentConnection = {
        id: id(variables.connectionId),
        userId: variables.userId,
        organizationId: id(variables.organizationId),
        clientId: variables.clientId,
        registeredClientId,
        clientName: variables.clientName ?? null,
        module: variables.module,
        scopes: [...scopes],
        createdAt: stamp(),
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
    for (const table of [clients, requests, connections, tokens, staff]) table.clear()
  })

  return Object.assign(base, {
    clients,
    requests,
    connections,
    tokens,
    staff,
    setStaff,
    connectionsOf,
    tokensOf,
  })
}

export type OAuthDatabaseFake = ReturnType<typeof createOAuthDatabaseFake<ModuleDatabaseFakeBase>>

export default createOAuthDatabaseFake
