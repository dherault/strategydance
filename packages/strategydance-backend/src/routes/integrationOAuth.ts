import { type NextFunction, type Request, type Response, Router } from 'express'
import type { IntegrationConnectedSearch } from 'strategydance-core'

import { INTEGRATION_CONNECTED_URL, INTEGRATION_OAUTH_CLIENT_ID } from '~constants'

import logger from '~utils/logger'

import integrationCallbackRateLimitMiddleware from '~middleware/integrationCallbackRateLimit'

import buildIntegrationClientMetadata from '~domain/integrations/buildIntegrationClientMetadata'
import receiveIntegrationAuthorizationCode from '~domain/integrations/receiveIntegrationAuthorizationCode'

// How long an authorization server may keep Strategy Dance's client ID metadata document
const CLIENT_METADATA_DOCUMENT_MAX_AGE_SECONDS = 60 * 60

function noStoreMiddleware(_request: Request, response: Response, next: NextFunction) {
  response.setHeader('Cache-Control', 'no-store')
  next()
}

/*
  Strategy Dance as an OAuth client of organizations' MCP servers, mounted at `/integrations/oauth` on
  the public backend: neither route carries App Check nor a token, since an authorization server, or a
  browser it sends, calls them.

  - `GET /callback`: where an authorization server sends the member's browser back after their
    sign-in. It keeps the code for the member's own page to finish (`receiveIntegrationAuthorizationCode`)
    and always answers a 303 to that page, whatever happened, never storable, and the address it came
    from, which holds the code, is sent nowhere as a referrer. Nothing it was sent is logged
  - `GET /client`: Strategy Dance's client ID metadata document, its own address as its `client_id`,
    which an authorization server reading such documents fetches, from any origin
*/
function createIntegrationOAuthRouter() {
  const router = Router()

  router.get(
    '/callback',
    integrationCallbackRateLimitMiddleware,
    noStoreMiddleware,
    async (request: Request, response: Response) => {
      let search: IntegrationConnectedSearch

      try {
        search = await receiveIntegrationAuthorizationCode(
          new URL(request.originalUrl, 'http://callback').search.slice(1),
        )
      } catch (error) {
        logger.error('Integrations: a sign-in could not be kept', error instanceof Error ? error.name : 'unknown')
        search = { outcome: 'failed' }
      }

      logger.info(`Integrations: a sign-in came back, ${search.outcome}`)
      response.redirect(303, toConnectedUrl(search))
    },
  )

  router.get('/client', (_request: Request, response: Response) => {
    response.setHeader('Cache-Control', `public, max-age=${CLIENT_METADATA_DOCUMENT_MAX_AGE_SECONDS}`)
    response.json({ client_id: INTEGRATION_OAUTH_CLIENT_ID, ...buildIntegrationClientMetadata() })
  })

  return router
}

// The page a sign-in ends on, with the fields of its query that are there
function toConnectedUrl(search: IntegrationConnectedSearch) {
  const query = new URLSearchParams()

  for (const [name, value] of Object.entries(search)) {
    if (value !== undefined) query.set(name, value)
  }

  return `${INTEGRATION_CONNECTED_URL}?${query}`
}

export default createIntegrationOAuthRouter
