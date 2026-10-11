import { denyOAuthAuthorizationRequest as denyRequest } from 'strategydance-database/backend'

import { OAUTH_ISSUER } from '~constants'

import { dataConnect } from '~firebase'

import buildAuthorizationResponseUrl from '~domain/oauth/buildAuthorizationResponseUrl'
import loadOAuthAuthorizationRequest from '~domain/oauth/loadOAuthAuthorizationRequest'

type Denied = { outcome: 'denied'; redirectUrl: string | null } | { outcome: 'unknown' }

/*
  A member denies an external agent: the request is decided once, so it is never allowed after, and
  the browser goes back to the client with `access_denied`, its `state` and the issuer, when the
  client and its redirect address are known good, and nowhere otherwise
*/
async function denyOAuthAuthorizationRequest(requestId: string): Promise<Denied> {
  const loaded = await loadOAuthAuthorizationRequest(requestId)

  if (loaded.outcome === 'unknown') return loaded

  try {
    await denyRequest(dataConnect, { id: loaded.request.id })
  } catch (error) {
    if (
      error instanceof Error
      && error.message.includes('The authorization request was decided already or has expired')
    ) {
      return { outcome: 'unknown' }
    }

    throw error
  }

  if (loaded.outcome === 'refused') return { outcome: 'denied', redirectUrl: null }

  return {
    outcome: 'denied',
    redirectUrl: buildAuthorizationResponseUrl(loaded.request.redirectUri, {
      error: 'access_denied',
      error_description: 'The member denied the request',
      state: loaded.request.state,
      iss: OAUTH_ISSUER,
    }),
  }
}

export default denyOAuthAuthorizationRequest
