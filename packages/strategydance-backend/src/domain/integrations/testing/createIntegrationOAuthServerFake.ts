import { createHash, randomBytes } from 'node:crypto'

import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { OutboundRequest, OutboundStream, ResolvedAddress } from '~utils/requestOutbound'

// The MCP server and the authorization server it names, at public addresses the guard lets through
export const FAKE_MCP_URL = 'https://mcp.example.com/mcp'
export const FAKE_ISSUER = 'https://auth.example.com'

const PUBLIC_ADDRESS = { address: '93.184.215.14', family: 4 }

type FakeOAuthServerOptions = {
  // Whether the authorization server reads client ID metadata documents
  isClientMetadataDocumentSupported?: boolean
  // Whether it sends `iss` back with a sign-in (RFC 9207)
  isIssuerParameterSupported?: boolean
  /*
    How a registration authenticates at the token endpoint, as the server chooses whatever the
    registration asked: as a public client, or with a secret. Left out, it is the method asked for
  */
  registeredAuthenticationMethod?: 'none' | 'client_secret_basic' | 'client_secret_post'
  /*
    The methods its metadata lists, as most MCP servers' do, or null to list none, which means
    `client_secret_basic` alone: a registration asking for a method it does not take is refused
  */
  tokenEndpointAuthMethodsSupported?: string[] | null
  // Whether its token answers carry an ID token naming the account
  isOpenIdProvider?: boolean
  // Whether refreshing rotates the refresh token, spending the one presented
  isRotating?: boolean
  // How long an access token lasts, in seconds, or null to say nothing
  accessTokenLifetime?: number | null
  // The type its token answers name
  tokenType?: string
  // Its sign-in's address, https unless a test says otherwise
  authorizationEndpoint?: string
  // The scopes its metadata and the protected resource's list
  scopesSupported?: string[]
}

type Grant = {
  clientId: string
  account: string
  resource: string | null
}

/*
  An OAuth MCP server and its authorization server, for the tests of members' connections: the
  network the guarded fetch reaches (`resolve`, `send`), and what a browser does in between, a member
  allowing or denying a sign-in (`approve`, `deny`), which answers the query the callback receives.

  The MCP server answers a token its authorization server issued, and challenges anything else. The
  authorization server registers clients, exchanges a code once, for the client and the verifier it
  was issued to, refreshes, spending a rotating refresh token, so one presented again is refused as
  `invalid_grant`, and records every token request, revocation and listing for the tests to read
*/
function createIntegrationOAuthServerFake({
  isClientMetadataDocumentSupported = false,
  isIssuerParameterSupported = false,
  registeredAuthenticationMethod,
  tokenEndpointAuthMethodsSupported = ['client_secret_basic', 'client_secret_post', 'none'],
  isOpenIdProvider = false,
  isRotating = true,
  accessTokenLifetime = 3600,
  tokenType = 'Bearer',
  authorizationEndpoint = `${FAKE_ISSUER}/authorize`,
  scopesSupported,
}: FakeOAuthServerOptions = {}) {
  const clients = new Map<string, { secret: string | null; method: string }>()
  const codes = new Map<string, Grant & { challenge: string; redirectUri: string; isUsed: boolean }>()
  const refreshTokens = new Map<string, Grant & { isCurrent: boolean }>()
  const accessTokens = new Map<string, Grant>()
  const recorded = {
    registrations: [] as Record<string, unknown>[],
    tokenRequests: [] as Record<string, string>[],
    revocations: [] as Record<string, string>[],
    // The client each revocation authenticated as, or null for one that did not
    revocationClients: [] as (string | null)[],
    // The account each listing of the tools was made as
    listings: [] as string[],
    // Each tool called, as the account it was called as and with the arguments as sent
    calls: [] as { account: string; name: string; arguments: unknown }[],
  }
  /*
    What a test turns off: the token endpoint answering, refreshes, revocations, and the MCP server
    taking any token, as one that withdrew a member's access while their grant still refreshes
  */
  const switches = {
    isTokenEndpointDown: false,
    isRefreshRefused: false,
    isRevocationDown: false,
    isEveryTokenRefused: false,
    // The MCP server refusing every call with a 403, as one refusing this account the tool
    isEveryCallForbidden: false,
    // Its tools answering with an error, as a tool that ran and failed
    isToolFailing: false,
  }

  const handler = createMcpHandler(
    () => {
      const server = new McpServer({ name: 'fake', version: '1.0.0' }, { capabilities: { tools: {} } })

      for (const name of ['list_issues', 'create_issue']) {
        server.registerTool(
          name,
          { description: name, inputSchema: z.object({ query: z.string() }) },
          async ({ query }) => ({
            content: [{ type: 'text', text: switches.isToolFailing ? 'The tracker is down' : `${name}: ${query}` }],
            ...(switches.isToolFailing && { isError: true }),
          }),
        )
      }

      return server
    },
    { responseMode: 'sse', legacy: 'stateless' },
  )

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }

  function oauthError(error: string, status = 400) {
    return json({ error }, status)
  }

  function token(prefix: string) {
    return `${prefix}_${randomBytes(16).toString('hex')}`
  }

  function issue(grant: Grant) {
    const accessToken = token('access')
    const refreshToken = token('refresh')

    accessTokens.set(accessToken, grant)
    refreshTokens.set(refreshToken, { ...grant, isCurrent: true })

    return json({
      access_token: accessToken,
      token_type: tokenType,
      ...(accessTokenLifetime !== null && { expires_in: accessTokenLifetime }),
      refresh_token: refreshToken,
      ...(isOpenIdProvider && { id_token: toIdToken(grant.account) }),
    })
  }

  // The client a token request authenticates as, by the method it registered with, or null
  function authenticate(request: Request, form: URLSearchParams) {
    const authorization = request.headers.get('authorization')
    const [id, secret] = authorization?.startsWith('Basic ')
      ? readBasicCredentials(authorization.slice('Basic '.length))
      : [form.get('client_id'), form.get('client_secret')]

    if (!id) return null
    if (id.startsWith('https://')) return isClientMetadataDocumentSupported ? id : null

    const client = clients.get(id)

    if (!client) return null

    return client.secret === null || client.secret === secret ? id : null
  }

  async function answerToken(request: Request) {
    const form = new URLSearchParams(await request.text())

    recorded.tokenRequests.push(Object.fromEntries(form))

    if (switches.isTokenEndpointDown) return new Response('Down', { status: 503 })

    const clientId = authenticate(request, form)

    if (!clientId) return oauthError('invalid_client', 401)

    if (form.get('grant_type') === 'authorization_code') {
      const code = codes.get(form.get('code') ?? '')
      const verifier = form.get('code_verifier') ?? ''
      const challenge = createHash('sha256').update(verifier).digest('base64url')
      const isGood =
        code
        && !code.isUsed
        && code.clientId === clientId
        && code.redirectUri === form.get('redirect_uri')
        && code.challenge === challenge
        && code.resource === form.get('resource')

      if (code) code.isUsed = true
      if (!isGood) return oauthError('invalid_grant')

      return issue(code)
    }

    if (form.get('grant_type') === 'refresh_token') {
      const presented = refreshTokens.get(form.get('refresh_token') ?? '')

      if (switches.isRefreshRefused || !presented?.isCurrent || presented.clientId !== clientId) {
        return oauthError('invalid_grant')
      }

      if (!isRotating) {
        const accessToken = token('access')

        accessTokens.set(accessToken, presented)

        return json({
          access_token: accessToken,
          token_type: tokenType,
          ...(accessTokenLifetime !== null && { expires_in: accessTokenLifetime }),
        })
      }

      presented.isCurrent = false

      return issue(presented)
    }

    return oauthError('unsupported_grant_type')
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const route = `${request.method} ${url.origin}${url.pathname}`

    switch (route) {
      case `POST ${FAKE_MCP_URL}`: {
        const bearer = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
        const grant = switches.isEveryTokenRefused ? undefined : accessTokens.get(bearer)

        if (!grant) {
          return new Response('Unauthorized', {
            status: 401,
            headers: {
              'www-authenticate': `Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp"`,
            },
          })
        }

        const body = await request.clone().text()

        if (body.includes('"tools/list"')) recorded.listings.push(grant.account)

        const message: unknown = JSON.parse(body)

        if (isToolCall(message)) {
          if (switches.isEveryCallForbidden) return new Response('Forbidden', { status: 403 })

          recorded.calls.push({
            account: grant.account,
            name: message.params.name,
            arguments: message.params.arguments,
          })
        }

        return handler.fetch(request)
      }
      case 'GET https://mcp.example.com/.well-known/oauth-protected-resource/mcp':
        return json({
          resource: FAKE_MCP_URL,
          authorization_servers: [FAKE_ISSUER],
          ...(scopesSupported && { scopes_supported: scopesSupported }),
        })
      case `GET ${FAKE_ISSUER}/.well-known/oauth-authorization-server`:
        return json({
          issuer: FAKE_ISSUER,
          authorization_endpoint: authorizationEndpoint,
          token_endpoint: `${FAKE_ISSUER}/token`,
          registration_endpoint: `${FAKE_ISSUER}/register`,
          revocation_endpoint: `${FAKE_ISSUER}/revoke`,
          response_types_supported: ['code'],
          code_challenge_methods_supported: ['S256'],
          ...(scopesSupported && { scopes_supported: scopesSupported }),
          ...(tokenEndpointAuthMethodsSupported && {
            token_endpoint_auth_methods_supported: tokenEndpointAuthMethodsSupported,
          }),
          ...(isClientMetadataDocumentSupported && { client_id_metadata_document_supported: true }),
          ...(isIssuerParameterSupported && { authorization_response_iss_parameter_supported: true }),
        })
      case `POST ${FAKE_ISSUER}/register`: {
        const metadata = (await request.json()) as Record<string, unknown>
        const requested = String(metadata.token_endpoint_auth_method)

        recorded.registrations.push(metadata)

        if (!(tokenEndpointAuthMethodsSupported ?? ['client_secret_basic']).includes(requested)) {
          return oauthError('invalid_client_metadata')
        }

        const method = registeredAuthenticationMethod ?? requested
        const clientId = `client_${randomBytes(8).toString('hex')}`
        // A secret holding what a form escapes, which a Basic header encoded otherwise than RFC 6749 asks breaks
        const secret = method === 'none' ? null : `${token('secret')} :+%!~'`

        clients.set(clientId, { secret, method })

        return json(
          {
            ...metadata,
            client_id: clientId,
            ...(secret && { client_secret: secret }),
            token_endpoint_auth_method: method,
          },
          201,
        )
      }
      case `POST ${FAKE_ISSUER}/token`:
        return answerToken(request)
      case `POST ${FAKE_ISSUER}/revoke`: {
        const form = new URLSearchParams(await request.text())
        const clientId = authenticate(request, form)

        recorded.revocations.push(Object.fromEntries(form))
        recorded.revocationClients.push(clientId)

        if (switches.isRevocationDown) return new Response('Down', { status: 503 })

        return clientId ? new Response(null, { status: 200 }) : oauthError('invalid_client', 401)
      }
      default:
        return new Response('Not found', { status: 404 })
    }
  }

  // The guard's transport, answering from the fake what Node's HTTP would answer from the network
  async function send(
    url: URL,
    _address: ResolvedAddress,
    headers: Record<string, string>,
    signal: AbortSignal,
    { method, body }: OutboundRequest,
  ): Promise<OutboundStream> {
    const response = await handle(new Request(url, { method, headers, body: body && new Uint8Array(body), signal }))

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: (async function* () {
        if (!response.body) return

        for await (const chunk of response.body) yield chunk
      })(),
    }
  }

  /*
    What the member's browser brings back to the callback once they allowed a sign-in at the
    authorization URL Strategy Dance gave, as the account named: a code bound to the client, the
    redirect, the challenge and the resource the URL asked for, the state, and the issuer when the
    server sends it
  */
  function approve(authorizationUrl: string, account = 'ada@example.com') {
    const asked = new URL(authorizationUrl).searchParams
    const code = token('code')

    codes.set(code, {
      clientId: asked.get('client_id') ?? '',
      account,
      resource: asked.get('resource'),
      challenge: asked.get('code_challenge') ?? '',
      redirectUri: asked.get('redirect_uri') ?? '',
      isUsed: false,
    })

    return new URLSearchParams({
      code,
      state: asked.get('state') ?? '',
      ...(isIssuerParameterSupported && { iss: FAKE_ISSUER }),
    }).toString()
  }

  // What the browser brings back once the member refused the sign-in
  function deny(authorizationUrl: string) {
    return new URLSearchParams({
      error: 'access_denied',
      state: new URL(authorizationUrl).searchParams.get('state') ?? '',
    }).toString()
  }

  return {
    resolve: async () => [PUBLIC_ADDRESS],
    send,
    approve,
    deny,
    recorded,
    switches,
    clients,
    // Whether a token is one the authorization server issued, and still takes
    isLiveAccessToken: (accessToken: string) => accessTokens.has(accessToken),
    // Revokes every access token issued, as a server does before their expiry, keeping refresh tokens
    forgetAccessTokens: () => accessTokens.clear(),
    isCurrentRefreshToken: (refreshToken: string) => refreshTokens.get(refreshToken)?.isCurrent === true,
  }
}

/*
  A Basic header's id and secret, each read as RFC 6749 encodes it, form-encoded before the pair is
  joined, and refused, as nulls, when either part is encoded any other way
*/
function readBasicCredentials(encoded: string) {
  const decoded = Buffer.from(encoded, 'base64').toString('utf8')
  const colon = decoded.indexOf(':')
  const parts = colon === -1 ? [] : [decoded.slice(0, colon), decoded.slice(colon + 1)]
  const read = parts.map(part => new URLSearchParams(`value=${part}`).get('value') ?? '')
  const isFormEncoded =
    parts.length === 2
    && read.every((part, index) => new URLSearchParams({ value: part }).toString() === `value=${parts[index]}`)

  return isFormEncoded ? read : [null, null]
}

// Whether a JSON-RPC message calls a tool
function isToolCall(message: unknown): message is { params: { name: string; arguments: unknown } } {
  return (
    typeof message === 'object'
    && message !== null
    && 'method' in message
    && message.method === 'tools/call'
    && 'params' in message
    && typeof message.params === 'object'
    && message.params !== null
  )
}

// An ID token naming the account, unsigned, as the label reads it
function toIdToken(account: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

  return `${encode({ alg: 'none' })}.${encode({ email: account, sub: account })}.`
}

export default createIntegrationOAuthServerFake
