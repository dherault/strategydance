import { type Request, type Response, Router } from 'express'

import buildAuthorizationServerMetadata from '~domain/oauth/buildAuthorizationServerMetadata'

/*
  The addresses a client discovers the server at, under `/.well-known`, at the app's root as RFC
  8414 has them: the authorization server's metadata. The modules' protected resource metadata joins
  them with the endpoint that serves them
*/
function createWellKnownRouter() {
  const router = Router()

  router.get('/oauth-authorization-server', (_request: Request, response: Response) => {
    response.json(buildAuthorizationServerMetadata())
  })

  return router
}

export default createWellKnownRouter
