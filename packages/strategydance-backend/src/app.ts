import cors from 'cors'
import express, { type Request, type Response } from 'express'

import type { ApiResponse } from '~types'

import { ALLOWED_ORIGINS, MODULES_PATH } from '~constants'

import isOAuthProtocolPath from '~utils/isOAuthProtocolPath'

import errorMiddleware from '~middleware/error'
import loggerMiddleware from '~middleware/logger'
import notFoundMiddleware from '~middleware/notFound'
import securityMiddleware from '~middleware/security'

import createConversationsRouter from '~routes/conversations'
import createIntegrationOAuthRouter from '~routes/integrationOAuth'
import createIntegrationsRouter from '~routes/integrations'
import createInternalRouter from '~routes/internal'
import createKnowledgeRouter from '~routes/knowledge'
import createLinkPreviewsRouter from '~routes/linkPreviews'
import createModuleMetadataRouter from '~routes/moduleMetadata'
import createModulesRouter from '~routes/modules'
import createOAuthRouter from '~routes/oauth'
import createOAuthRequestsRouter from '~routes/oauthRequests'
import createOrganizationsRouter from '~routes/organizations'
import createUsersRouter from '~routes/users'
import createWellKnownRouter from '~routes/wellKnown'

type Options = {
  // The worker's app rather than the backend's, as `SERVICE=worker` asks for (`IS_WORKER`)
  isWorker: boolean
}

/*
  The app of one of the two services the backend's image runs as, apart from the port it listens
  on, so a test can build either:

  - the backend, public, answers the browser and the agents members connect to a module: every
    route but the internal ones
  - the worker, private, answers Google Cloud: the internal routes, which Cloud Tasks and Cloud
    Scheduler call, and nothing else. Their service account is the one granted the invoker role
    on it, and Cloud Run refuses anybody without Cloud Run's invoke permission

  Neither answers the other's routes, so an internal route never sits on the public service, where
  it would have to check Google's token itself.

  No body parser is applied app wide. Each route parses its own, so a route that needs the raw
  bytes, like a webhook checking a signature, can have them, and one taking a file can read it
  only once the caller is known to be allowed to send it
*/
function createApp({ isWorker }: Options) {
  const app = express()

  // Cloud Run sits one proxy in front, and `X-Forwarded-For` from that proxy is the caller's address
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  // The OAuth protocol's own endpoints answer any origin, without credentials, since no cookie is
  // involved; every other route answers the app's origins alone. `Retry-After` is exposed, which a
  // page of another origin cannot read otherwise: a daily cap's refusal says in it when the cap has
  // room again
  app.use(
    cors((request, callback) => {
      callback(null, {
        origin: isOAuthProtocolPath(request.path) ? '*' : ALLOWED_ORIGINS,
        exposedHeaders: ['Retry-After'],
      })
    }),
  )
  app.use(securityMiddleware)
  app.use(loggerMiddleware)

  if (isWorker) {
    app.use('/internal', createInternalRouter())
  } else {
    app.get('/health', (_request: Request, response: Response<ApiResponse>) => {
      response.json({ status: 'success' })
    })

    app.use('/.well-known', createWellKnownRouter())
    // At the root, since each module's protected resource metadata ends with the module's own path
    app.use(createModuleMetadataRouter())
    app.use('/link-previews', createLinkPreviewsRouter())
    // Ahead of the protocol's router, so the consent page's routes answer in the app's envelope
    app.use('/oauth/requests', createOAuthRequestsRouter())
    app.use('/oauth', createOAuthRouter())
    // Where an organization's MCP servers send a member back after signing in, and Strategy Dance's
    // client ID metadata document
    app.use('/integrations/oauth', createIntegrationOAuthRouter())
    app.use(MODULES_PATH, createModulesRouter())
    // Ahead of the organizations' router, so their paths are matched first
    app.use('/organizations/:organizationId/conversations', createConversationsRouter())
    app.use('/organizations/:organizationId/integrations', createIntegrationsRouter())
    app.use('/organizations/:organizationId/knowledge', createKnowledgeRouter())
    app.use('/organizations', createOrganizationsRouter())
    app.use('/users', createUsersRouter())
  }

  app.use(errorMiddleware)
  app.use(notFoundMiddleware)

  return app
}

export default createApp
