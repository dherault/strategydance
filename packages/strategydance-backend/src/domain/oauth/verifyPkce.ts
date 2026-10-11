import { createHash, timingSafeEqual } from 'node:crypto'

// A verifier as RFC 7636 writes one: 43 to 128 unreserved characters
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/

/*
  Whether a code's exchange proves it comes from whoever asked for the code: the SHA-256 of its
  verifier is the challenge the authorization carried, compared in constant time
*/
function verifyPkce(verifier: string | undefined, challenge: string) {
  if (!verifier || !VERIFIER_PATTERN.test(verifier)) return false

  const digest = Buffer.from(createHash('sha256').update(verifier).digest('base64url'))
  const expected = Buffer.from(challenge)

  return digest.length === expected.length && timingSafeEqual(digest, expected)
}

export default verifyPkce
