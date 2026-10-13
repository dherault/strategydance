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
  // How a registration authenticates at the token endpoint: as a public client, or with a secret
  registeredAuthenticationMethod?: 'none' | 'client_secret_basic' | 'client_secret_post'
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
  registeredAuthenticationMethod = 'none',
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
    // The account each listing of the tools was made as
    listings: [] as string[],
  }
  // What a test turns off: the token endpoint answering, refreshes, and the clients it knows
  const switches = { isTokenEndpointDown: false, isRefreshRefused: false, isRevocationDown: false }

  const handler = createMcpHandler(
    () => {
      const server = new McpServer({ name: 'fake', version: '1.0.0' }, { capabilities: { tools: {} } })

      for (const name of ['list_issues', 'create_issue']) {
        server.registerTool(name, { description: name, inputSchema: z.object({ query: z.string() }) }, async () => ({
          content: [],
        }))
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
      ? Buffer.from(authorization.slice('Basic '.length), 'base64').toString('utf8').split(':')
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
        const grant = accessTokens.get(bearer)

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
          ...(isClientMetadataDocumentSupported && { client_id_metadata_document_supported: true }),
          ...(isIssuerParameterSupported && { authorization_response_iss_parameter_supported: true }),
        })
      case `POST ${FAKE_ISSUER}/register`: {
        const metadata = (await request.json()) as Record<string, unknown>
        const clientId = `client_${randomBytes(8).toString('hex')}`
        const secret = registeredAuthenticationMethod === 'none' ? null : token('secret')

        recorded.registrations.push(metadata)
        clients.set(clientId, { secret, method: registeredAuthenticationMethod })

        return json(
          {
            ...metadata,
            client_id: clientId,
            ...(secret && { client_secret: secret }),
            token_endpoint_auth_method: registeredAuthenticationMethod,
          },
          201,
        )
      }
      case `POST ${FAKE_ISSUER}/token`:
        return answerToken(request)
      case `POST ${FAKE_ISSUER}/revoke`:
        recorded.revocations.push(Object.fromEntries(new URLSearchParams(await request.text())))

        return switches.isRevocationDown ? new Response('Down', { status: 503 }) : new Response(null, { status: 200 })
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
    isCurrentRefreshToken: (refreshToken: string) => refreshTokens.get(refreshToken)?.isCurrent === true,
  }
}

// An ID token naming the account, unsigned, as the label reads it
function toIdToken(account: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

  return `${encode({ alg: 'none' })}.${encode({ email: account, sub: account })}.`
}

export default createIntegrationOAuthServerFake
