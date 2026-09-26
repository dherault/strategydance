import { type Request, type Response, Router } from 'express'

import type { ApiResponse } from '~types'

import readViewer from '~utils/readViewer'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'
import welcomeEmailRateLimitMiddleware from '~middleware/welcomeEmailRateLimit'

import sendWelcomeEmail from '~domain/email/sendWelcomeEmail'

function createUsersRouter() {
  const router = Router()

  /* ---
    WELCOME EMAIL
  --- */

  /*
    Sends the caller's account its welcome email, which the web app asks for on each visit while
    the account is new and has not had it: the browser writes the account's row itself, so this is
    how the server hears of it.

    Answers the same whether this call sent it, an earlier one had, or another holds the claim. No
    body. The lease keeps a repeat from mailing, and the rate limit keeps repeats from costing much
  */
  router.post(
    '/welcome-email',
    appCheckMiddleware,
    authenticationMiddleware,
    welcomeEmailRateLimitMiddleware,
    async (request: Request, response: Response<ApiResponse>) => {
      await sendWelcomeEmail(readViewer(request).id)

      response.json({ status: 'success' })
    },
  )

  return router
}

export default createUsersRouter
