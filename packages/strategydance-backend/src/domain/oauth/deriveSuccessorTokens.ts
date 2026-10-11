import { createHmac } from 'node:crypto'

/*
  The pair a refresh token is rotated into, derived from it under the server's secret rather than
  drawn at random, so the same token presented again within its grace is answered with the very
  same pair, recomputed, and nothing but hashes is ever stored. The access token and the refresh
  token are derived under different labels, so the two always differ
*/
function deriveSuccessorTokens(spentToken: string, secret: string) {
  const derive = (label: string) => createHmac('sha256', secret).update(`${label}:${spentToken}`).digest('base64url')

  return { accessToken: derive('access'), refreshToken: derive('refresh') }
}

export default deriveSuccessorTokens
