import express, { type Request, type Response, Router } from 'express'
import {
  type ApiResponse,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_FORBIDDEN,
  type InviteOrganizationMembersData,
  MAX_INVITATIONS_PER_REQUEST,
  isEmailAddress,
  normalizeEmailAddress,
} from 'strategydance-core'
import { z } from 'zod'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'
import invitationRateLimitMiddleware from '~middleware/invitationRateLimit'
import validateMiddleware from '~middleware/validate'

import createOrganizationInvitations from '~domain/organizations/createOrganizationInvitations'

// Data Connect writes a UUID as 32 hex digits and reads it with or without hyphens
const UUID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

function createOrganizationsRouter() {
  const router = Router()

  /* ---
    INVITATIONS
  --- */

  const invitationsParamsSchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
  })

  const invitationsBodySchema = z.object({
    emails: z
      .array(z.string().transform(normalizeEmailAddress).refine(isEmailAddress, 'Not an email address'))
      .min(1)
      .max(MAX_INVITATIONS_PER_REQUEST)
      // The same address twice is one invitation
      .transform(emails => [...new Set(emails)]),
  })

  type InvitationsRequest = Request<z.infer<typeof invitationsParamsSchema>, ApiResponse<InviteOrganizationMembersData>, z.infer<typeof invitationsBodySchema>>

  /*
    Invites people to an organization by email, from one of its administrators. Answers with the
    addresses that were invited and the ones that could not be, which only happens when somebody
    invited them in the meantime
  */
  router.post(
    '/:organizationId/invitations',
    express.json(),
    appCheckMiddleware,
    authenticationMiddleware,
    invitationRateLimitMiddleware,
    validateMiddleware({ params: invitationsParamsSchema, body: invitationsBodySchema }),
    async (request: InvitationsRequest, response: Response<ApiResponse<InviteOrganizationMembersData>>) => {
      const result = await createOrganizationInvitations({
        organizationId: request.params.organizationId,
        inviterId: readViewer(request).id,
        emails: request.body.emails,
      })

      if (result.outcome === 'forbidden') {
        respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only an administrator of the organization can invite people to it')

        return
      }

      if (result.outcome === 'conflict') {
        const reasons = [
          result.memberEmails.length ? `Already members: ${result.memberEmails.join(', ')}` : '',
          result.invitedEmails.length ? `Already invited: ${result.invitedEmails.join(', ')}` : '',
        ]

        respondError(response, 409, ERROR_CODE_CONFLICT, reasons.filter(Boolean).join('. '))

        return
      }

      response.json({
        status: 'success',
        data: {
          invitedEmails: result.invitedEmails,
          failedEmails: result.failedEmails,
        },
      })
    },
  )

  return router
}

export default createOrganizationsRouter
