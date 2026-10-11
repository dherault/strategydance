import { createOAuthClient } from 'strategydance-database/backend'

import { MAX_OAUTH_REDIRECT_URIS } from '~constants'

import { dataConnect } from '~firebase'

import isValidRedirectUri from '~domain/oauth/isValidRedirectUri'
import sanitizeOAuthClientName from '~domain/oauth/sanitizeOAuthClientName'

const GRANT_TYPES = ['authorization_code', 'refresh_token']
const RESPONSE_TYPES = ['code']

// What a registration answers (RFC 7591, 3.2.1), or why it refused, in OAuth's own words
type Registration =
  | {
      outcome: 'registered'
      client: {
        client_id: string
        client_id_issued_at: number
        client_name?: string
        redirect_uris: string[]
        grant_types: string[]
        response_types: string[]
        token_endpoint_auth_method: 'none'
      }
    }
  | { outcome: 'refused'; error: 'invalid_redirect_uri' | 'invalid_client_metadata'; description: string }
  | { outcome: 'full' }

// Whether a field a registration may leave out holds nothing but what the server serves
function isWithin(value: unknown, served: string[]) {
  return (
    value === undefined
    || (Array.isArray(value) && value.every(item => typeof item === 'string' && served.includes(item)))
  )
}

/*
  Registers an external agent (RFC 7591), which the specification deprecates for client ID metadata
  documents and Cursor still needs. Every client is public, so a registration that asks for any
  token endpoint authentication but `none` is refused rather than served as public, and its redirect
  addresses are loopback ones alone, on any port, since a registration proves no domain: a client
  redirecting to a website uses a client ID metadata document instead. What it does not read, a
  logo among it, it ignores, as the RFC allows. Registrations are capped in all, a day at a time
*/
async function registerOAuthClient(body: unknown): Promise<Registration> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      outcome: 'refused',
      error: 'invalid_client_metadata',
      description: 'The registration is not a JSON object',
    }
  }

  const fields = body as Record<string, unknown>
  const redirectUris = fields.redirect_uris

  if (
    !Array.isArray(redirectUris)
    || redirectUris.length < 1
    || redirectUris.length > MAX_OAUTH_REDIRECT_URIS
    || !redirectUris.every(uri => typeof uri === 'string' && isValidRedirectUri(uri, { isLoopbackOnly: true }))
  ) {
    return {
      outcome: 'refused',
      error: 'invalid_redirect_uri',
      description: `A registration names 1 to ${MAX_OAUTH_REDIRECT_URIS} loopback redirect addresses, http on localhost, 127.0.0.1 or [::1]. A client redirecting elsewhere uses a client ID metadata document`,
    }
  }

  if (fields.token_endpoint_auth_method !== undefined && fields.token_endpoint_auth_method !== 'none') {
    return {
      outcome: 'refused',
      error: 'invalid_client_metadata',
      description: 'Every client is public: token_endpoint_auth_method is none',
    }
  }

  if (!isWithin(fields.grant_types, GRANT_TYPES) || !isWithin(fields.response_types, RESPONSE_TYPES)) {
    return {
      outcome: 'refused',
      error: 'invalid_client_metadata',
      description:
        'The server serves the authorization_code and refresh_token grants, and the code response type, alone',
    }
  }

  const name = sanitizeOAuthClientName(fields.client_name)

  try {
    const { data } = await createOAuthClient(dataConnect, { name, redirectUris: redirectUris as string[] })

    return {
      outcome: 'registered',
      client: {
        client_id: data.oAuthClient_insert.id,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        ...(name ? { client_name: name } : {}),
        redirect_uris: redirectUris as string[],
        grant_types: GRANT_TYPES,
        response_types: RESPONSE_TYPES,
        token_endpoint_auth_method: 'none',
      },
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Strategy Dance takes no more registrations today')) {
      return { outcome: 'full' }
    }

    throw error
  }
}

export default registerOAuthClient
