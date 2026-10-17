import { SERVED_MODULES } from 'strategydance-core'

import { OAUTH_ISSUER } from '~constants'

import hasUriControlCharacters from '~domain/oauth/hasUriControlCharacters'

/*
  The module an authorization or a token request names in its `resource` (RFC 8707), and its
  address in the one form a token is bound to: the module's address under the issuer. The scheme
  and the host may come in any case, which the URL parser lowers, but nothing else may differ: no
  user, query, fragment, trailing slash, space or control character. Null for anything else, a resource naming no module
  included, and so is one naming a module served to no external agent, as Subagents is, so no
  consent makes a connection that no endpoint serves
*/
function parseModuleResource(value: string | undefined) {
  if (!value || value.includes('?') || value.includes('#') || hasUriControlCharacters(value)) return null
  if (!URL.canParse(value)) return null

  const url = new URL(value)

  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return null

  const resource = `${url.origin}${url.pathname}`
  const issuer = new URL(OAUTH_ISSUER).origin
  const module = SERVED_MODULES.find(({ path }) => `${issuer}${path}` === resource)

  return module ? { module, resource } : null
}

export default parseModuleResource
