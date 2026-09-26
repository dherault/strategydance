const BEARER_PREFIX = 'Bearer '

// The token out of an `Authorization: Bearer <token>` header, or null when the header carries none
function parseBearerToken(header: string | null | undefined) {
  if (!header?.startsWith(BEARER_PREFIX)) return null

  return header.slice(BEARER_PREFIX.length) || null
}

export default parseBearerToken
