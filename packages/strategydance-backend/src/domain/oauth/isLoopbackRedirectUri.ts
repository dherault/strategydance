// The hosts a redirect address may name on plain http: this computer's own (RFC 8252, 7.3)
const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]']

/*
  Whether a redirect address is a loopback one, `http` on this computer, which any program on the
  member's computer could be listening on: the consent page warns of it, and a registration takes
  no other
*/
function isLoopbackRedirectUri(uri: string) {
  if (!URL.canParse(uri)) return false

  const url = new URL(uri)

  return url.protocol === 'http:' && LOOPBACK_HOSTNAMES.includes(url.hostname)
}

export default isLoopbackRedirectUri
