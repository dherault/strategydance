import express, { type Request, type Response, Router } from 'express'
import {
  type ApiResponse,
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_FORBIDDEN,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_OAUTH_CLIENT_REFUSED,
  type OAuthAuthorizationDecision,
  type OAuthAuthorizationRequestSummary,
} from 'strategydance-core'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'
import modulesStaffOnlyMiddleware from '~middleware/modulesStaffOnly'
import oauthRequestRateLimitMiddleware from '~middleware/oauthRequestRateLimit'
import validateMiddleware from '~middleware/validate'

import approveOAuthAuthorizationRequest from '~domain/oauth/approveOAuthAuthorizationRequest'
import denyOAuthAuthorizationRequest from '~domain/oauth/denyOAuthAuthorizationRequest'
import readOAuthAuthorizationRequest from '~domain/oauth/readOAuthAuthorizationRequest'

const UNKNOWN_MESSAGE = 'The authorization request is unknown, decided already or expired'

/*
  The consent page's routes, which the app calls as every other, behind App Check and the member's
  ID token, for Strategy Dance's administrators alone while the modules are theirs: reading an
  external agent's request, which is when a client's document is first fetched, and allowing or
  denying it. Each answers the app's envelope, and Allow and Deny where to send the browser
*/
function createOAuthRequestsRouter() {
  const router = Router()

  const paramsSchema = z.object({ requestId: z.string().regex(UUID_PATTERN) })
  const approvalSchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
    scopes: z.array(z.string().max(100)).min(1).max(2),
  })

  type RequestParams = z.infer<typeof paramsSchema>

  router.get(
    '/:requestId',
    appCheckMiddleware,
    authenticationMiddleware,
    modulesStaffOnlyMiddleware,
    oauthRequestRateLimitMiddleware,
    validateMiddleware({ params: paramsSchema }),
    async (request: Request<RequestParams>, response: Response<ApiResponse<OAuthAuthorizationRequestSummary>>) => {
      const reading = await readOAuthAuthorizationRequest(request.params.requestId)

      if (reading.outcome === 'unknown') {
        respondError(response, 404, ERROR_CODE_NOT_FOUND, UNKNOWN_MESSAGE)

        return
      }

      if (reading.outcome === 'refused') {
        respondError(response, 400, ERROR_CODE_OAUTH_CLIENT_REFUSED, reading.reason)

        return
      }

      response.json({ status: 'success', data: reading.summary })
    },
  )

  router.post(
    '/:requestId/approve',
    express.json({ limit: '4kb' }),
    appCheckMiddleware,
    authenticationMiddleware,
    modulesStaffOnlyMiddleware,
    oauthRequestRateLimitMiddleware,
    validateMiddleware({ params: paramsSchema, body: approvalSchema }),
    async (
      request: Request<RequestParams, ApiResponse<OAuthAuthorizationDecision>, z.infer<typeof approvalSchema>>,
      response: Response<ApiResponse<OAuthAuthorizationDecision>>,
    ) => {
      const approval = await approveOAuthAuthorizationRequest({
        requestId: request.params.requestId,
        userId: readViewer(request).id,
        organizationId: request.body.organizationId,
        scopes: request.body.scopes,
      })

      if (approval.outcome === 'unknown') {
        respondError(response, 404, ERROR_CODE_NOT_FOUND, UNKNOWN_MESSAGE)

        return
      }

      if (approval.outcome === 'refused') {
        respondError(response, 400, ERROR_CODE_OAUTH_CLIENT_REFUSED, approval.reason)

        return
      }

      if (approval.outcome === 'invalid') {
        respondError(response, 400, ERROR_CODE_BAD_REQUEST, approval.reason)

        return
      }

      if (approval.outcome === 'forbidden') {
        respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of an organization can connect an agent to it')

        return
      }

      response.json({ status: 'success', data: { redirectUrl: approval.redirectUrl } })
    },
  )

  router.post(
    '/:requestId/deny',
    appCheckMiddleware,
    authenticationMiddleware,
    modulesStaffOnlyMiddleware,
    oauthRequestRateLimitMiddleware,
    validateMiddleware({ params: paramsSchema }),
    async (request: Request<RequestParams>, response: Response<ApiResponse<OAuthAuthorizationDecision>>) => {
      const denial = await denyOAuthAuthorizationRequest(request.params.requestId)

      if (denial.outcome === 'unknown') {
        respondError(response, 404, ERROR_CODE_NOT_FOUND, UNKNOWN_MESSAGE)

        return
      }

      response.json({ status: 'success', data: { redirectUrl: denial.redirectUrl } })
    },
  )

  return router
}

export default createOAuthRequestsRouter
