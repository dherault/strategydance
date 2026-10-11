import express, { type NextFunction, type Request, type Response, Router } from 'express'

import logger from '~utils/logger'
import parseClientErrorStatus from '~utils/parseClientErrorStatus'
import respondOAuthError from '~utils/respondOAuthError'

import oauthAuthorizationRateLimitMiddleware from '~middleware/oauthAuthorizationRateLimit'
import oauthRegistrationRateLimitMiddleware from '~middleware/oauthRegistrationRateLimit'

import registerOAuthClient from '~domain/oauth/registerOAuthClient'
import renderAuthorizationErrorPage from '~domain/oauth/renderAuthorizationErrorPage'
import startOAuthAuthorization from '~domain/oauth/startOAuthAuthorization'

/*
  The OAuth protocol's own endpoints, which external agents call to be connected to a module as a
  member: registration and authorization. They answer OAuth's own JSON, or for an authorization a
  page or a redirect, never the app's envelope, carry no App Check, which no client could, and
  answer any origin without credentials, since no cookie is involved. The consent page's routes,
  which the app calls, sit apart in `oauthRequests.ts`
*/
function createOAuthRouter() {
  const router = Router()

  /*
    Registers a public client (RFC 7591), with loopback redirect addresses alone. Metered per
    address before its body is read, and capped in all
  */
  router.post(
    '/register',
    oauthRegistrationRateLimitMiddleware,
    express.json({ limit: '16kb' }),
    async (request: Request, response: Response) => {
      const registration = await registerOAuthClient(request.body)

      if (registration.outcome === 'refused') {
        respondOAuthError(response, 400, registration.error, registration.description)

        return
      }

      if (registration.outcome === 'full') {
        response.setHeader('Retry-After', '3600')
        respondOAuthError(response, 429, 'too_many_requests', 'The server takes no more registrations today')

        return
      }

      response.status(201).json(registration.client)
    },
  )

  /*
    Checks what an external agent asks for, stores it, and sends the browser to the consent page,
    or back to its client with an error once the client is known good, or answers a page. Read from
    the raw query, so a parameter sent twice is seen as such
  */
  router.get('/authorize', oauthAuthorizationRateLimitMiddleware, async (request: Request, response: Response) => {
    const query = new URL(request.originalUrl, 'http://localhost').search.slice(1)
    const authorization = await startOAuthAuthorization(query)

    response.setHeader('Cache-Control', 'no-store')

    if (authorization.outcome === 'page') {
      response.status(400).type('html').send(renderAuthorizationErrorPage(authorization.message))

      return
    }

    response.redirect(302, authorization.url)
  })

  /*
    What any of these endpoints threw, in OAuth's own words: a body that could not be read is the
    caller's, as a registration's metadata on `/register`, and anything else is logged and answered
    as the server's. A request's body is never logged, since a token endpoint's carries secrets
  */
  router.use((error: unknown, request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) {
      next(error)

      return
    }

    const clientErrorStatus = parseClientErrorStatus(error)

    if (clientErrorStatus) {
      const isRegistration = request.path.toLowerCase().startsWith('/register')

      respondOAuthError(
        response,
        clientErrorStatus === 413 ? 413 : 400,
        isRegistration ? 'invalid_client_metadata' : 'invalid_request',
        error instanceof Error ? error.message : 'Bad request',
      )

      return
    }

    logger.error(`${request.method} ${request.baseUrl}${request.path} failed`, error)
    respondOAuthError(response, 500, 'server_error', 'Internal server error')
  })

  return router
}

export default createOAuthRouter
