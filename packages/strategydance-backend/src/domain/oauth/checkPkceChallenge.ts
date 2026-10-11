// A challenge as S256 writes one: the SHA-256 of the verifier, in base64url without padding
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/

/*
  Whether an authorization's PKCE challenge is one the server takes: S256 alone, named, since a
  request naming no method means `plain`, which proves nothing a code's interceptor could not repeat
*/
function checkPkceChallenge(challenge: string | undefined, method: string | undefined) {
  return method === 'S256' && challenge !== undefined && CHALLENGE_PATTERN.test(challenge)
}

export default checkPkceChallenge
