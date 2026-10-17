import { mcpAuthMetadataRouter } from '@modelcontextprotocol/express'
import { Router } from 'express'
import { SERVED_MODULES } from 'strategydance-core'

import { OAUTH_ISSUER } from '~constants'

import buildAuthorizationServerMetadata from '~domain/oauth/buildAuthorizationServerMetadata'

/*
  Each served module's protected resource metadata (RFC 9728), mounted at the app's root, at
  `/.well-known/oauth-protected-resource` followed by the module's path, which is where the 401 of
  its endpoint points a client: the module's address as the resource, Strategy Dance's
  authorization server, the module's scopes and its title. It answers any origin, as the
  authorization server's metadata does.

  The SDK's router also answers `/.well-known/oauth-authorization-server`, with the same metadata
  `routes/wellKnown.ts` answers there, mounted before it
*/
function createModuleMetadataRouter() {
  const router = Router()

  for (const module of SERVED_MODULES) {
    router.use(
      mcpAuthMetadataRouter({
        oauthMetadata: buildAuthorizationServerMetadata(),
        resourceServerUrl: new URL(module.path, OAUTH_ISSUER),
        scopesSupported: [module.scopes.read, module.scopes.write],
        resourceName: module.title,
      }),
    )
  }

  return router
}

export default createModuleMetadataRouter
