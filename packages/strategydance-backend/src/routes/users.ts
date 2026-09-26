import { type Request, type Response, Router } from 'express'

import type { ApiResponse } from '~types'

import readViewer from '~utils/readViewer'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'

import sendWelcomeEmail from '~domain/email/sendWelcomeEmail'

function createUsersRouter() {
  const router = Router()

  /* ---
    WELCOME EMAIL
  --- */

  /*
    Sends the caller's account its welcome email, which the web app asks for once it has created
    the account's row: the browser writes that row itself, so this is how the server hears of it.

    Answers the same whether this call sent it or an earlier one had. No body, and no rate limit:
    the latch makes every call after the first one conditional update that changes nothing
  */
  router.post(
    '/welcome-email',
    appCheckMiddleware,
    authenticationMiddleware,
    async (request: Request, response: Response<ApiResponse>) => {
      await sendWelcomeEmail(readViewer(request).id)

      response.json({ status: 'success' })
    },
  )

  return router
}

export default createUsersRouter
