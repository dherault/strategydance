import isLoopbackRedirectUri from '~domain/oauth/isLoopbackRedirectUri'

/*
  Whether a redirect address an authorization names is one its client declared: exactly, character
  for character, or, for a loopback address, on any port, as RFC 8252 asks, since a native app
  listens on whichever port it is given. Everything but the port still has to match
*/
function matchesRedirectUri(presented: string, declared: readonly string[]) {
  if (declared.includes(presented)) return true
  if (!isLoopbackRedirectUri(presented)) return false

  const url = new URL(presented)

  return declared.some(uri => {
    if (!isLoopbackRedirectUri(uri)) return false

    const other = new URL(uri)

    return (
      url.protocol === other.protocol
      && url.hostname === other.hostname
      && url.pathname === other.pathname
      && url.search === other.search
      && !url.username
      && !url.password
    )
  })
}

export default matchesRedirectUri
