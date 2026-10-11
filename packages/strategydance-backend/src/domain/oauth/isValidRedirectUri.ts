import { MAX_OAUTH_PARAMETER_LENGTH } from '~constants'

import isLoopbackRedirectUri from '~domain/oauth/isLoopbackRedirectUri'

// What the server's answer adds to a redirect address, which the address may not name itself, so
// the answer is never read as a parameter the client put there
const RESPONSE_PARAMETERS = ['code', 'state', 'iss', 'error', 'error_description', 'error_uri']

/*
  Whether an address may be a client's redirect address: `https`, or `http` on a loopback host, as
  the MCP specification requires of every redirect address, with no fragment, no user and no
  response parameter in its query. A registration takes loopback addresses alone, since it proves
  no domain, so a client redirecting to a website proves its domain through a client ID metadata
  document instead, and a private-use scheme such as `cursor://` is refused either way
*/
function isValidRedirectUri(uri: string, { isLoopbackOnly = false } = {}) {
  if (uri.length > MAX_OAUTH_PARAMETER_LENGTH || uri.includes('#') || !URL.canParse(uri)) return false

  const url = new URL(uri)

  if (url.username || url.password || !url.hostname) return false
  if (RESPONSE_PARAMETERS.some(name => url.searchParams.has(name))) return false
  if (isLoopbackRedirectUri(uri)) return true

  return !isLoopbackOnly && url.protocol === 'https:'
}

export default isValidRedirectUri
