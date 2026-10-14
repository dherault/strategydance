import {
  type AuthorizationServerMetadata,
  exchangeAuthorization,
  type FetchLike,
  OAuthError,
  OAuthErrorCode,
  type OAuthTokens,
  refreshAuthorization,
} from '@modelcontextprotocol/client'
import { IntegrationError } from 'strategydance-database/backend'

import { INTEGRATION_OAUTH_CALLBACK_URL, MAX_INTEGRATION_TOKEN_LENGTH } from '~constants'

import applyIntegrationClientAuthentication from '~domain/integrations/applyIntegrationClientAuthentication'
import classifyIntegrationFailure from '~domain/integrations/classifyIntegrationFailure'
import IntegrationTokenRefusal from '~domain/integrations/IntegrationTokenRefusal'
import readIntegrationAccountLabel from '~domain/integrations/readIntegrationAccountLabel'
import type { IntegrationOAuthClient } from '~domain/integrations/resolveIntegrationOAuthClient'

// The token endpoint a member's tokens come from, as the Connect that began them recorded it
type IntegrationTokenEndpoint = {
  issuer: string
  tokenEndpoint: string
  resource: string
  client: IntegrationOAuthClient
}

// A code with the verifier its challenge was made from, or a refresh token
type IntegrationTokenGrant = { code: string; codeVerifier: string } | { refreshToken: string }

// What a token answer gave, checked: the tokens, when the access token expires, if it said, the
// scope granted and who the member signed in as, when an ID token said
type IntegrationTokens = {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null
  scope: string | null
  accountLabel: string | null
}

// The longest an access token is taken to last, whatever its answer says, so a refresh is never
// put off for good
const MAX_ACCESS_TOKEN_LIFETIME_SECONDS = 365 * 24 * 60 * 60

/*
  Asks a server's token endpoint for a member's tokens, a code exchanged or a refresh token spent,
  through the MCP SDK and the guarded fetch it is given, the client authenticated as its registration
  said, as its revocations are (`applyIntegrationClientAuthentication`), and the resource named, as
  MCP asks of both (RFC 8707). The endpoint is the one its Connect discovered, so nothing is
  discovered again: the SDK's metadata is rebuilt from it alone, with no `iss`, which the callback
  checked.

  The answer has to be a bearer token, whatever its case, of a sane length, with a refresh token of a
  sane length if any; an expiry that is no positive number means none known. An authorization server's
  refusal throws an `IntegrationTokenRefusal`, a server out of reach an `IntegrationFailure`
*/
async function requestIntegrationTokens(
  { issuer, tokenEndpoint, resource, client }: IntegrationTokenEndpoint,
  grant: IntegrationTokenGrant,
  fetch: FetchLike,
): Promise<IntegrationTokens> {
  const origin = new URL(tokenEndpoint).origin
  const metadata: AuthorizationServerMetadata = {
    issuer,
    authorization_endpoint: tokenEndpoint,
    token_endpoint: tokenEndpoint,
    response_types_supported: ['code'],
  }
  const clientInformation = {
    client_id: client.clientId,
    ...(client.clientSecret !== null && { client_secret: client.clientSecret }),
    token_endpoint_auth_method: client.authenticationMethod,
    redirect_uris: [INTEGRATION_OAUTH_CALLBACK_URL],
  }
  const addClientAuthentication = (headers: Headers, form: URLSearchParams) =>
    applyIntegrationClientAuthentication(client, headers, form)
  let tokens: OAuthTokens

  try {
    tokens =
      'code' in grant
        ? await exchangeAuthorization(issuer, {
            metadata,
            clientInformation,
            authorizationCode: grant.code,
            codeVerifier: grant.codeVerifier,
            redirectUri: INTEGRATION_OAUTH_CALLBACK_URL,
            resource,
            addClientAuthentication,
            fetchFn: fetch,
          })
        : await refreshAuthorization(issuer, {
            metadata,
            clientInformation,
            refreshToken: grant.refreshToken,
            resource,
            addClientAuthentication,
            fetchFn: fetch,
          })
  } catch (error) {
    throw toTokenFailure(error, origin)
  }

  return checkTokens(tokens, origin)
}

/*
  What a token request that failed throws: the authorization server's own error, by its code, or a
  server out of reach, as reaching a server classifies it. Anything else, an answer that is no token,
  is a refusal another try may mend
*/
function toTokenFailure(error: unknown, origin: string) {
  if (OAuthError.isInstance(error)) {
    if (error.code === OAuthErrorCode.InvalidGrant) {
      return new IntegrationTokenRefusal('invalidGrant', `${origin}: invalid_grant`)
    }

    if (error.code === OAuthErrorCode.InvalidClient || error.code === OAuthErrorCode.UnauthorizedClient) {
      return new IntegrationTokenRefusal('invalidClient', `${origin}: ${error.code}`)
    }

    return new IntegrationTokenRefusal('refused', `${origin}: an OAuth error`)
  }

  const failure = classifyIntegrationFailure(error, { hasKey: false, origin })
  const isOutOfReach = [
    IntegrationError.ADDRESS_REFUSED,
    IntegrationError.UNREACHABLE,
    IntegrationError.TIMED_OUT,
  ].some(kind => kind === failure.kind)

  return isOutOfReach ? failure : new IntegrationTokenRefusal('refused', `${origin}: no token answer`)
}

function checkTokens(tokens: OAuthTokens, origin: string): IntegrationTokens {
  const refusal = (reason: string) => new IntegrationTokenRefusal('refused', `${origin}: ${reason}`)

  if (tokens.token_type.toLowerCase() !== 'bearer') throw refusal('not a bearer token')
  if (!isSaneToken(tokens.access_token)) throw refusal('an access token past what is kept')
  if (tokens.refresh_token && !isSaneToken(tokens.refresh_token)) throw refusal('a refresh token past what is kept')

  const lifetime = tokens.expires_in

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresAt:
      lifetime !== undefined && Number.isFinite(lifetime) && lifetime > 0
        ? new Date(Date.now() + Math.min(lifetime, MAX_ACCESS_TOKEN_LIFETIME_SECONDS) * 1000).toISOString()
        : null,
    scope: tokens.scope && tokens.scope.length <= MAX_INTEGRATION_TOKEN_LENGTH ? tokens.scope : null,
    accountLabel: readIntegrationAccountLabel(tokens.id_token),
  }
}

function isSaneToken(token: string) {
  return token.length > 0 && token.length <= MAX_INTEGRATION_TOKEN_LENGTH
}

export { type IntegrationTokenEndpoint, type IntegrationTokens }

export default requestIntegrationTokens
