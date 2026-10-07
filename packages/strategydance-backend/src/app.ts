import cors from 'cors'
import express, { type Request, type Response } from 'express'

import type { ApiResponse } from '~types'

import { ALLOWED_ORIGINS } from '~constants'

import errorMiddleware from '~middleware/error'
import loggerMiddleware from '~middleware/logger'
import notFoundMiddleware from '~middleware/notFound'
import securityMiddleware from '~middleware/security'

import createConversationsRouter from '~routes/conversations'
import createLinkPreviewsRouter from '~routes/linkPreviews'
import createOrganizationsRouter from '~routes/organizations'
import createUsersRouter from '~routes/users'

/*
  The backend's app, apart from the port it listens on, so a test can build it.

  No body parser is applied app wide. Each route parses its own, so a route that needs the raw
  bytes, like a webhook checking a signature, can have them, and one taking a file can read it
  only once the caller is known to be allowed to send it
*/
function createApp() {
  const app = express()

  // Cloud Run sits one proxy in front, and `X-Forwarded-For` from that proxy is the caller's address
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(cors({ origin: ALLOWED_ORIGINS }))
  app.use(securityMiddleware)
  app.use(loggerMiddleware)

  app.get('/health', (_request: Request, response: Response<ApiResponse>) => {
    response.json({ status: 'success' })
  })

  app.use('/link-previews', createLinkPreviewsRouter())
  // Ahead of the organizations' router, so its paths are matched first
  app.use('/organizations/:organizationId/conversations', createConversationsRouter())
  app.use('/organizations', createOrganizationsRouter())
  app.use('/users', createUsersRouter())

  app.use(errorMiddleware)
  app.use(notFoundMiddleware)

  return app
}

export default createApp
