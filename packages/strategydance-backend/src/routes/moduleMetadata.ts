import { mcpAuthMetadataRouter } from '@modelcontextprotocol/express'
import { Router } from 'express'
import { MODULE_ADDRESSES, readModuleAddressScopes } from 'strategydance-core'

import { OAUTH_ISSUER } from '~constants'

import buildAuthorizationServerMetadata from '~domain/oauth/buildAuthorizationServerMetadata'

/*
  Each address's protected resource metadata (RFC 9728), mounted at the app's root, at
  `/.well-known/oauth-protected-resource` followed by the address's path, which is where the 401 of
  its endpoint points a client: the address as the resource, Strategy Dance's authorization server,
  its modules' scopes, and its title, "Strategy Dance" for the one address. It answers any origin, as
  the authorization server's metadata does.

  Mounted the longest path first: the SDK mounts each with `router.use`, which matches a prefix, so
  the one address's, `/mcp`, would otherwise be entered for every module's, its CORS and its 405
  answering them first.

  The SDK's router also answers `/.well-known/oauth-authorization-server`, with the same metadata
  `routes/wellKnown.ts` answers there, mounted before it
*/
function createModuleMetadataRouter() {
  const router = Router()
  const addresses = [...MODULE_ADDRESSES].sort((one, other) => other.path.length - one.path.length)

  for (const address of addresses) {
    router.use(
      mcpAuthMetadataRouter({
        oauthMetadata: buildAuthorizationServerMetadata(),
        resourceServerUrl: new URL(address.path, OAUTH_ISSUER),
        scopesSupported: readModuleAddressScopes(address),
        resourceName: address.title,
      }),
    )
  }

  return router
}

export default createModuleMetadataRouter
