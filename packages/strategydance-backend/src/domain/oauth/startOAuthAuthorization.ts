import { createOAuthAuthorizationRequest, getOAuthClient, recordOAuthClientUse } from 'strategydance-database/backend'

import { MAX_OAUTH_PARAMETER_LENGTH, OAUTH_CONSENT_URL, OAUTH_ISSUER } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import buildAuthorizationResponseUrl from '~domain/oauth/buildAuthorizationResponseUrl'
import checkClientIdUrl from '~domain/oauth/checkClientIdUrl'
import checkPkceChallenge from '~domain/oauth/checkPkceChallenge'
import isRegisteredClientId from '~domain/oauth/isRegisteredClientId'
import isValidRedirectUri from '~domain/oauth/isValidRedirectUri'
import matchesRedirectUri from '~domain/oauth/matchesRedirectUri'
import parseModuleResource from '~domain/oauth/parseModuleResource'
import parseModuleScopes from '~domain/oauth/parseModuleScopes'
import parseOAuthParameters from '~domain/oauth/parseOAuthParameters'

const PARAMETERS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
  'resource',
] as const

// Where an authorization sends the browser: a page saying what went wrong, or an address, the
// consent page's or the client's with an error
type Authorization = { outcome: 'page'; message: string } | { outcome: 'redirect'; url: string }

/*
  `GET /oauth/authorize`: checks what an external agent asks for, stores it for ten minutes, and
  sends the browser to the consent page.

  Until the client and its redirect address are known good, an error is a page and never a
  redirect, so nobody can bounce a browser through the server: a registered client's redirect is
  checked here, against its registration, but a client ID metadata document is fetched only once a
  member has signed in and reads the request, so for such a client every error here is a page.
  After that, an error goes back to the client with `error`, its `state` and `iss` (RFC 9207). The
  `state` is held to 2048 characters first, so an oversized one is never sent back
*/
async function startOAuthAuthorization(query: string): Promise<Authorization> {
  const parsed = parseOAuthParameters(query, PARAMETERS)

  if (parsed.isRepeated) {
    return { outcome: 'page', message: `The request names ${parsed.name.slice(0, 100)} more than once.` }
  }

  const { values } = parsed
  const clientId = values.client_id
  const redirectUri = values.redirect_uri

  if (!clientId || clientId.length > MAX_OAUTH_PARAMETER_LENGTH) {
    return { outcome: 'page', message: 'The request names no client this server knows.' }
  }

  const isRegistered = isRegisteredClientId(clientId)
  let registeredRedirectUris: string[] | null = null

  if (isRegistered) {
    const { data } = await getOAuthClient(dataConnect, { id: clientId })

    if (!data.oAuthClient) return { outcome: 'page', message: 'The request names no client this server knows.' }

    registeredRedirectUris = data.oAuthClient.redirectUris
  } else if (!checkClientIdUrl(clientId)) {
    return { outcome: 'page', message: 'The request names no client this server knows.' }
  }

  if (
    !redirectUri
    || !isValidRedirectUri(redirectUri, { isLoopbackOnly: isRegistered })
    || (registeredRedirectUris && !matchesRedirectUri(redirectUri, registeredRedirectUris))
  ) {
    return { outcome: 'page', message: 'The request names no redirect address its client declared.' }
  }

  const state = values.state ?? null

  if (state && state.length > MAX_OAUTH_PARAMETER_LENGTH) {
    return { outcome: 'page', message: 'The request’s state is longer than 2048 characters.' }
  }

  // An error from here on goes back to a registered client, whose redirect address is known good,
  // and is a page for any other
  function refuse(error: string, description: string): Authorization {
    if (!isRegistered) return { outcome: 'page', message: description }

    return {
      outcome: 'redirect',
      url: buildAuthorizationResponseUrl(redirectUri!, {
        error,
        error_description: description,
        state,
        iss: OAUTH_ISSUER,
      }),
    }
  }

  if (!values.response_type) return refuse('invalid_request', 'The request names no response_type.')
  if (values.response_type !== 'code')
    return refuse('unsupported_response_type', 'The server serves the code response type alone.')
  if (!checkPkceChallenge(values.code_challenge, values.code_challenge_method)) {
    return refuse('invalid_request', 'The request needs a PKCE code_challenge with the S256 method.')
  }

  const target = parseModuleResource(values.resource)

  if (!target) return refuse('invalid_target', "The request's resource names no module of this server.")

  const scopes = parseModuleScopes(target.module, values.scope)

  if (!scopes) {
    return refuse(
      'invalid_scope',
      `The request asks for ${target.module.scopes.read}, alone or with ${target.module.scopes.write}.`,
    )
  }

  let requestId: string

  try {
    const { data } = await createOAuthAuthorizationRequest(dataConnect, {
      clientId,
      registeredClientId: isRegistered ? clientId : null,
      redirectUri,
      codeChallenge: values.code_challenge!,
      resource: target.resource,
      scopes,
      state,
    })

    requestId = data.oAuthAuthorizationRequest_insert.id
  } catch (error) {
    if (error instanceof Error && error.message.includes('Strategy Dance takes no more authorization requests')) {
      return refuse(
        'temporarily_unavailable',
        'The server takes no more authorizations for now. Try again in a few minutes.',
      )
    }

    throw error
  }

  if (isRegistered) {
    // Only what keeps a client in use from being pruned, so a failure costs the authorization nothing
    await recordOAuthClientUse(dataConnect, { id: clientId }).catch((error: unknown) => {
      logger.warn('OAuth: a registered client could not be marked used', error)
    })
  }

  return { outcome: 'redirect', url: `${OAUTH_CONSENT_URL}?request=${requestId}` }
}

export default startOAuthAuthorization
