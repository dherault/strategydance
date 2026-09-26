import cors from 'cors'
import express, { type Request, type Response } from 'express'

import type { ApiResponse } from '~types'

import { ALLOWED_ORIGINS, IS_PRODUCTION, PORT } from '~constants'

import logger from '~utils/logger'

import errorMiddleware from '~middleware/error'
import loggerMiddleware from '~middleware/logger'
import notFoundMiddleware from '~middleware/notFound'
import securityMiddleware from '~middleware/security'

import createOrganizationsRouter from '~routes/organizations'
import createUsersRouter from '~routes/users'

/*
  The backend: what the browser cannot do for itself, because it needs a secret or has to happen
  on the server's word. Everything else stays between the web app and Data Connect.

  No body parser is applied app wide. Each route parses its own, so a route that needs the raw
  bytes, like a webhook checking a signature, can have them
*/
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

app.use('/organizations', createOrganizationsRouter())
app.use('/users', createUsersRouter())

app.use(errorMiddleware)
app.use(notFoundMiddleware)

// Express 5 hands a failed listen to the callback rather than throwing it, a taken port included
app.listen(PORT, error => {
  if (error) {
    logger.error(`Could not listen on port ${PORT}, which another process may be holding`, error)
    process.exit(1)
  }

  logger.info(`🚀 ${IS_PRODUCTION ? 'Production' : 'Development'} server on port ${PORT}`)
})
