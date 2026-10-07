import cors from 'cors'
import express, { type Request, type Response } from 'express'

import type { ApiResponse } from '~types'

import { ALLOWED_ORIGINS } from '~constants'

import errorMiddleware from '~middleware/error'
import loggerMiddleware from '~middleware/logger'
import notFoundMiddleware from '~middleware/notFound'
import securityMiddleware from '~middleware/security'

import createConversationsRouter from '~routes/conversations'
import createInternalRouter from '~routes/internal'
import createLinkPreviewsRouter from '~routes/linkPreviews'
import createOrganizationsRouter from '~routes/organizations'
import createUsersRouter from '~routes/users'

type Options = {
  // The worker's app rather than the backend's, as `SERVICE=worker` asks for (`IS_WORKER`)
  isWorker: boolean
}

/*
  The app of one of the two services the backend's image runs as, apart from the port it listens
  on, so a test can build either:

  - the backend, public, answers the browser: every route but the internal ones
  - the worker, private, answers Google Cloud: the internal routes, which Cloud Tasks and Cloud
    Scheduler call, and nothing else. Cloud Run lets only their service account invoke it

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

  app.use(cors({ origin: ALLOWED_ORIGINS }))
  app.use(securityMiddleware)
  app.use(loggerMiddleware)

  if (isWorker) {
    app.use('/internal', createInternalRouter())
  } else {
    app.get('/health', (_request: Request, response: Response<ApiResponse>) => {
      response.json({ status: 'success' })
    })

    app.use('/link-previews', createLinkPreviewsRouter())
    // Ahead of the organizations' router, so its paths are matched first
    app.use('/organizations/:organizationId/conversations', createConversationsRouter())
    app.use('/organizations', createOrganizationsRouter())
    app.use('/users', createUsersRouter())
  }

  app.use(errorMiddleware)
  app.use(notFoundMiddleware)

  return app
}

export default createApp
