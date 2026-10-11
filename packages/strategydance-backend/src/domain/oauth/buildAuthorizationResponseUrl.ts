/*
  Where an authorization sends the browser back to: the client's redirect address exactly as it
  wrote it, its own query kept byte for byte, with the answer's parameters appended, `code` or
  `error`, then `state` when the client sent one, and `iss`, which RFC 9207 has every answer name
*/
function buildAuthorizationResponseUrl(redirectUri: string, parameters: Record<string, string | null | undefined>) {
  const search = new URLSearchParams()

  for (const [name, value] of Object.entries(parameters)) {
    if (value !== null && value !== undefined) search.append(name, value)
  }

  const separator = !redirectUri.includes('?') ? '?' : /[?&]$/.test(redirectUri) ? '' : '&'

  return `${redirectUri}${separator}${search.toString()}`
}

export default buildAuthorizationResponseUrl
