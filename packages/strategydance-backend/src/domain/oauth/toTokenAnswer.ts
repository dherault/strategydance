import { OAUTH_ACCESS_TOKEN_LIFETIME_MS } from '~constants'

/*
  What the token endpoint answers a client with (RFC 6749, 5.1): the pair, how long the access token
  has left, and the scopes the connection grants, which a member's reduced consent can make fewer
  than were asked for, so a client never assumes a write it cannot make
*/
function toTokenAnswer({
  accessToken,
  refreshToken,
  scopes,
  expiresInSeconds = OAUTH_ACCESS_TOKEN_LIFETIME_MS / 1000,
}: {
  accessToken: string
  refreshToken: string
  scopes: string[]
  expiresInSeconds?: number
}) {
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresInSeconds,
    refresh_token: refreshToken,
    scope: scopes.join(' '),
  }
}

export type TokenAnswer = ReturnType<typeof toTokenAnswer>

// A token request's answer, or its refusal in OAuth's own words
export type TokenResult =
  | { outcome: 'tokens'; tokens: TokenAnswer }
  | { outcome: 'error'; error: string; description: string }

export default toTokenAnswer
