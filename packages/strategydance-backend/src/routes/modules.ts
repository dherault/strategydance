import {
  getOAuthProtectedResourceMetadataUrl,
  originValidation,
  requireBearerAuth,
} from '@modelcontextprotocol/express'
import { toNodeHandler } from '@modelcontextprotocol/node'
import express, { type NextFunction, type Request, type Response, Router } from 'express'

import { APP_URL, MAX_MODULE_REQUEST_BYTES, MODULES_PATH, OAUTH_ISSUER, SERVED_MODULES } from '~constants'

import logger from '~utils/logger'
import parseClientErrorStatus from '~utils/parseClientErrorStatus'
import respondJsonRpcError from '~utils/respondJsonRpcError'

import moduleAddressRateLimitMiddleware from '~middleware/moduleAddressRateLimit'
import moduleRateLimitMiddleware from '~middleware/moduleRateLimit'

import createAgentConnectionTokenVerifier from '~domain/oauth/createAgentConnectionTokenVerifier'

import createModuleHandler from '~modules/createModuleHandler'

/*
  The modules' endpoints, where the agents members connected call a module as them, mounted at
  `MODULES_PATH` on the public backend: each served module at its own address, `POST` alone, through
  the handler Strategy Dance's agent goes through too, so both get the same tools and checks. Before
  it, in this order:

  - Any other method answers 405: the handler is stateless, so it opens no stream to `GET` and has
    no session to `DELETE`
  - A request whose `Origin` is present and is not the app's answers 403, against DNS rebinding, as
    MCP asks. No client running in a browser is served yet, and one that runs elsewhere sends none
  - The address's rate limit, which counts only refused calls, so tokens made up, or calls past a
    connection's limit, cost a bounded number of reads of the database
  - The bearer check (RFC 6750), with the token verifier and the endpoint's own address as the
    resource the token must name, so a token for one module never opens another. A request without
    a valid token answers 401, naming the module's protected resource metadata, which names the
    authorization server. The caller the handler builds a server for comes from the token
  - The connection's rate limit, then the body, read only now, so nobody unverified has a megabyte
    buffered, and handed to the handler whole, since the parser has consumed the stream

  No App Check, which no external agent can carry: the token is the guard. Everything answers in
  MCP's JSON-RPC, never the app's envelope
*/
function createModulesRouter() {
  const router = Router()
  const parseBody = express.json({ limit: MAX_MODULE_REQUEST_BYTES })
  const checkOrigin = originValidation([new URL(APP_URL).hostname])

  for (const module of SERVED_MODULES) {
    const path = module.path.slice(MODULES_PATH.length)
    const resource = new URL(module.path, OAUTH_ISSUER)
    const nodeHandler = toNodeHandler(createModuleHandler(module.name), {
      maxRequestBodySize: MAX_MODULE_REQUEST_BYTES,
      onerror: error => logger.error(`POST ${module.path} failed`, error),
    })

    router.post(
      path,
      checkOrigin,
      moduleAddressRateLimitMiddleware,
      requireBearerAuth({
        verifier: createAgentConnectionTokenVerifier(resource),
        expectedResource: resource,
        resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource),
      }),
      moduleRateLimitMiddleware,
      parseBody,
      (request: Request, response: Response) => nodeHandler(request, response, request.body),
    )

    router.all(path, (_request: Request, response: Response) => {
      response.setHeader('Allow', 'POST')
      respondJsonRpcError(response, 405, -32000, 'Method not allowed: a module is called with POST alone')
    })
  }

  /*
    What any of these endpoints threw before the handler answered, in JSON-RPC: a body that is not
    JSON, or one over the limit, is the caller's, and anything else is logged and answered as the
    server's. A request's body is never logged, since it carries what the member's knowledge holds
  */
  router.use((error: unknown, request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) {
      next(error)

      return
    }

    const clientErrorStatus = parseClientErrorStatus(error)

    if (clientErrorStatus === 413) {
      respondJsonRpcError(response, 413, -32000, 'Request body too large')

      return
    }

    if (clientErrorStatus) {
      respondJsonRpcError(response, 400, -32700, 'Parse error: the body is not valid JSON')

      return
    }

    logger.error(`${request.method} ${request.baseUrl}${request.path} failed`, error)
    respondJsonRpcError(response, 500, -32603, 'Internal error')
  })

  return router
}

export default createModulesRouter
