import { createHash } from 'node:crypto'

// What the database keeps of a code or a token, and finds it by: its SHA-256, in base64url. The
// token itself is never stored, so a leaked table opens nothing
function hashOAuthToken(token: string) {
  return createHash('sha256').update(token).digest('base64url')
}

export default hashOAuthToken
