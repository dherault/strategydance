import express, { type NextFunction, type Request, type Response, Router } from 'express'

import logger from '~utils/logger'
import parseClientErrorStatus from '~utils/parseClientErrorStatus'
import respondOAuthError from '~utils/respondOAuthError'

import oauthAuthorizationRateLimitMiddleware from '~middleware/oauthAuthorizationRateLimit'
import oauthRegistrationRateLimitMiddleware from '~middleware/oauthRegistrationRateLimit'

import exchangeOAuthAuthorizationCode from '~domain/oauth/exchangeOAuthAuthorizationCode'
import parseOAuthParameters from '~domain/oauth/parseOAuthParameters'
import refreshAgentConnectionTokens from '~domain/oauth/refreshAgentConnectionTokens'
import registerOAuthClient from '~domain/oauth/registerOAuthClient'
import renderAuthorizationErrorPage from '~domain/oauth/renderAuthorizationErrorPage'
import revokeAgentConnectionToken from '~domain/oauth/revokeAgentConnectionToken'
import startOAuthAuthorization from '~domain/oauth/startOAuthAuthorization'

// What each grant reads, and nothing else, so a code exchange carrying a refresh token's parameters
// reads none of them
const CODE_PARAMETERS = ['code', 'redirect_uri', 'client_id', 'code_verifier', 'resource'] as const
const REFRESH_PARAMETERS = ['refresh_token', 'client_id', 'resource'] as const
const REVOCATION_PARAMETERS = ['token', 'client_id'] as const

// A token request's and a revocation's form, read as text, so a parameter sent twice is seen as such
const formParser = express.text({ type: 'application/x-www-form-urlencoded', limit: '16kb' })

// No browser or proxy keeps what the token and revocation endpoints answer, a refusal included
// (RFC 6749, 5.1)
function noStoreMiddleware(_request: Request, response: Response, next: NextFunction) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Pragma', 'no-cache')
  next()
}

// The form a token request or a revocation sent, or null when it sent none
function readForm(request: Request) {
  return typeof request.body === 'string' ? request.body : null
}

// A grant's own parameters, from a form already checked to repeat none
function readValues<Name extends string>(form: string, names: readonly Name[]) {
  const parsed = parseOAuthParameters(form, names)

  return parsed.isRepeated ? {} : parsed.values
}

/*
  The OAuth protocol's own endpoints, which external agents call to be connected to a module as a
  member: registration, authorization, tokens and revocation. They answer OAuth's own JSON, or for an authorization a
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
    Exchanges a code, or rotates a refresh token, as the request's one `grant_type` says, reading
    that grant's parameters alone. Every client is public, so it names its `client_id`, and every
    request its `resource`
  */
  router.post('/token', noStoreMiddleware, formParser, async (request: Request, response: Response) => {
    const form = readForm(request)

    if (form === null) {
      respondOAuthError(
        response,
        400,
        'invalid_request',
        'A token request is a form, application/x-www-form-urlencoded',
      )

      return
    }

    // Any parameter repeated is refused here, whichever grant it belongs to
    const grant = parseOAuthParameters(form, ['grant_type'])

    if (grant.isRepeated) {
      respondOAuthError(
        response,
        400,
        'invalid_request',
        `The request names ${grant.name.slice(0, 100)} more than once`,
      )

      return
    }

    const grantType = grant.values.grant_type

    if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
      respondOAuthError(
        response,
        400,
        grantType ? 'unsupported_grant_type' : 'invalid_request',
        'The server serves the authorization_code and refresh_token grants',
      )

      return
    }

    const result =
      grantType === 'authorization_code'
        ? await exchangeOAuthAuthorizationCode(readValues(form, CODE_PARAMETERS))
        : await refreshAgentConnectionTokens(readValues(form, REFRESH_PARAMETERS))

    if (result.outcome === 'error') {
      respondOAuthError(response, 400, result.error, result.description)

      return
    }

    response.json(result.tokens)
  })

  /*
    Revokes a token its client holds (RFC 7009): a refresh token ends the connection, an access
    token itself alone. Answered with an empty 200 for a token the server does not know
  */
  router.post('/revoke', noStoreMiddleware, formParser, async (request: Request, response: Response) => {
    const form = readForm(request)
    const parameters = form === null ? null : parseOAuthParameters(form, REVOCATION_PARAMETERS)

    if (!parameters || parameters.isRepeated) {
      respondOAuthError(response, 400, 'invalid_request', 'A revocation is a form naming each parameter once')

      return
    }

    const revocation = await revokeAgentConnectionToken(parameters.values)

    if (revocation.outcome === 'error') {
      respondOAuthError(response, 400, revocation.error, revocation.description)

      return
    }

    response.status(200).end()
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
