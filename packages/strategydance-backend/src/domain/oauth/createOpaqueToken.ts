import { randomBytes } from 'node:crypto'

// A code or a token the server hands out: 256 random bits in base64url, which means nothing but
// what the database holds under its hash
function createOpaqueToken() {
  return randomBytes(32).toString('base64url')
}

export default createOpaqueToken
