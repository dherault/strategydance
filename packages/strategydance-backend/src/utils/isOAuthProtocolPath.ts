import { OAUTH_PROTOCOL_PATHS } from '~constants'

/*
  Whether a request is for one of the OAuth protocol's own endpoints, which answer any origin, as
  Express routes a path: ignoring case and one trailing slash. Matched exactly, never by prefix, so
  the consent page's routes under `/oauth/requests` keep the app's origins
*/
function isOAuthProtocolPath(path: string) {
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path

  return OAUTH_PROTOCOL_PATHS.includes(normalized.toLowerCase())
}

export default isOAuthProtocolPath
