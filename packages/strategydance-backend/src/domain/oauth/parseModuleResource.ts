import { MODULE_ADDRESSES, readModuleAddressModules } from 'strategydance-core'

import { OAUTH_ISSUER } from '~constants'

import hasUriControlCharacters from '~domain/oauth/hasUriControlCharacters'

/*
  The address an authorization or a token request names in its `resource` (RFC 8707), with the
  modules it serves, in `MODULES`' order, and the address in the one form a token is bound to: its
  path under the issuer, the one address `/mcp` or a module's own. The scheme and the host may come
  in any case, which the URL parser lowers, but nothing else may differ: no user, query, fragment,
  trailing slash, space or control character. Null for anything else, a resource naming no address
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
  const address = MODULE_ADDRESSES.find(({ path }) => `${issuer}${path}` === resource)

  if (!address) return null

  return { address, modules: readModuleAddressModules(address), resource }
}

export default parseModuleResource
