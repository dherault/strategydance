import express, { type Request, type Response, Router } from 'express'
import {
  type ApiResponse,
  type ChangeOrganizationImageData,
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_FORBIDDEN,
  ERROR_CODE_TEAM_FULL,
  ERROR_CODE_TOO_MANY_REQUESTS,
  ERROR_CODE_UNSUPPORTED_MEDIA_TYPE,
  type InviteOrganizationMembersData,
  MAX_INVITATIONS_PER_REQUEST,
  MAX_ORGANIZATION_IMAGE_SIZES,
  MAX_RICH_TEXT_IMAGE_SIZE,
  MAX_THUMBNAIL_SIZE,
  ORGANIZATION_IMAGE_CONTENT_TYPES,
  ORGANIZATION_IMAGE_KINDS,
  RICH_TEXT_IMAGE_CONTENT_TYPES,
  type RichTextImageData,
  isEmailAddress,
  normalizeEmailAddress,
} from 'strategydance-core'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import readImageUpload from '~utils/readImageUpload'
import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'
import sniffImageContentType from '~utils/sniffImageContentType'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'
import invitationRateLimitMiddleware from '~middleware/invitationRateLimit'
import organizationAdministratorMiddleware from '~middleware/organizationAdministrator'
import organizationImageRateLimitMiddleware from '~middleware/organizationImageRateLimit'
import organizationMemberMiddleware from '~middleware/organizationMember'
import richTextImageRateLimitMiddleware from '~middleware/richTextImageRateLimit'
import validateMiddleware from '~middleware/validate'

import createOrganizationInvitations from '~domain/organizations/createOrganizationInvitations'
import deleteOrganization from '~domain/organizations/deleteOrganization'
import removeOrganizationImage from '~domain/organizations/removeOrganizationImage'
import replaceOrganizationImage from '~domain/organizations/replaceOrganizationImage'
import storeRichTextImage from '~domain/richText/storeRichTextImage'

// What a form carrying a logo and its thumbnail holds beyond their bytes: its boundaries and each
// part's headers, a few hundred bytes, with room to spare
const IMAGE_FORM_OVERHEAD = 16 * 1024

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
      // The same address twice is one invitation, so the limit counts addresses once deduplicated
      .transform(emails => [...new Set(emails)])
      .pipe(z.array(z.string()).min(1).max(MAX_INVITATIONS_PER_REQUEST)),
  })

  type InvitationsRequest = Request<
    z.infer<typeof invitationsParamsSchema>,
    ApiResponse<InviteOrganizationMembersData>,
    z.infer<typeof invitationsBodySchema>
  >

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
        respondError(
          response,
          403,
          ERROR_CODE_FORBIDDEN,
          'Only an administrator of the organization can invite people to it',
        )

        return
      }

      if (result.outcome === 'quota') {
        // At least a second: the oldest invitation may have aged out between the read and now
        response.setHeader('Retry-After', Math.max(1, Math.ceil(result.retryAfterMs / 1000)))

        respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many invitations sent, try again later')

        return
      }

      if (result.outcome === 'full') {
        respondError(
          response,
          409,
          ERROR_CODE_TEAM_FULL,
          `The team has room for ${result.room} more members or invitations`,
        )

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

  const organizationParamsSchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
  })

  /* ---
    ORGANIZATION
  --- */

  type OrganizationRequest = Request<z.infer<typeof organizationParamsSchema>, ApiResponse, unknown>

  /*
    Deletes an organization, its memberships, invitations and files, for one of its
    administrators. Takes no body
  */
  router.delete(
    '/:organizationId',
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: organizationParamsSchema }),
    organizationAdministratorMiddleware,
    async (request: OrganizationRequest, response: Response<ApiResponse>) => {
      const result = await deleteOrganization({
        organizationId: request.params.organizationId,
        userId: readViewer(request).id,
      })

      if (result.outcome === 'forbidden') {
        respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only an administrator of the organization can delete it')

        return
      }

      response.json({ status: 'success' })
    },
  )

  /* ---
    IMAGES
  --- */

  type ImageRequest = Request<
    z.infer<typeof organizationParamsSchema>,
    ApiResponse<ChangeOrganizationImageData>,
    unknown
  >

  /*
    One pair of routes per picture rather than a `:kind` parameter, since Express 5 takes no
    pattern in a parameter and each picture has its own size limit.

    The body is parsed last, after the administrator check, rather than first as elsewhere: a
    picture is megabytes, and nobody who may not change it should get it buffered. The parser
    takes only the declared picture types, leaving the body unread otherwise, and refuses anything
    over the limit with a 413 before reading it.

    The logo also comes as a form, with the thumbnail the page drew of it beside it, which is what
    the organization switcher draws. The parser's limit then counts both and the form around them,
    and `readImageUpload` holds each to its own
  */
  ORGANIZATION_IMAGE_KINDS.forEach(kind => {
    const takesThumbnail = kind === 'logo'

    // Makes the body the organization's logo or banner, answering with its URL
    router.put(
      `/:organizationId/${kind}`,
      appCheckMiddleware,
      authenticationMiddleware,
      organizationImageRateLimitMiddleware,
      validateMiddleware({ params: organizationParamsSchema }),
      organizationAdministratorMiddleware,
      express.raw(
        takesThumbnail
          ? {
              type: [...ORGANIZATION_IMAGE_CONTENT_TYPES, 'multipart/form-data'],
              limit: MAX_ORGANIZATION_IMAGE_SIZES[kind] + MAX_THUMBNAIL_SIZE + IMAGE_FORM_OVERHEAD,
            }
          : { type: ORGANIZATION_IMAGE_CONTENT_TYPES, limit: MAX_ORGANIZATION_IMAGE_SIZES[kind] },
      ),
      async (request: ImageRequest, response: Response<ApiResponse<ChangeOrganizationImageData>>) => {
        const upload = await readImageUpload({
          body: request.body,
          contentType: request.headers['content-type'],
          maxSize: MAX_ORGANIZATION_IMAGE_SIZES[kind],
        })

        if (upload.outcome === 'too-large') {
          respondError(
            response,
            413,
            ERROR_CODE_BAD_REQUEST,
            takesThumbnail ? `The ${kind} or its thumbnail is too large` : `The ${kind} is too large`,
          )

          return
        }

        if (upload.outcome === 'unsupported') {
          respondError(
            response,
            415,
            ERROR_CODE_UNSUPPORTED_MEDIA_TYPE,
            takesThumbnail
              ? `An organization's ${kind} is a PNG, JPEG, GIF or WebP picture, sent alone or as a form with its thumbnail`
              : `An organization's ${kind} is a PNG, JPEG, GIF or WebP picture`,
          )

          return
        }

        const result = await replaceOrganizationImage({
          organizationId: request.params.organizationId,
          userId: readViewer(request).id,
          kind,
          image: upload.image,
          thumbnail: upload.thumbnail,
        })

        if (result.outcome === 'forbidden') {
          respondError(
            response,
            403,
            ERROR_CODE_FORBIDDEN,
            `Only an administrator of the organization can change its ${kind}`,
          )

          return
        }

        response.json({
          status: 'success',
          data: {
            url: result.url,
          },
        })
      },
    )

    // Takes the organization's logo or banner away
    router.delete(
      `/:organizationId/${kind}`,
      appCheckMiddleware,
      authenticationMiddleware,
      organizationImageRateLimitMiddleware,
      validateMiddleware({ params: organizationParamsSchema }),
      organizationAdministratorMiddleware,
      async (request: ImageRequest, response: Response<ApiResponse<ChangeOrganizationImageData>>) => {
        const result = await removeOrganizationImage({
          organizationId: request.params.organizationId,
          userId: readViewer(request).id,
          kind,
        })

        if (result.outcome === 'forbidden') {
          respondError(
            response,
            403,
            ERROR_CODE_FORBIDDEN,
            `Only an administrator of the organization can remove its ${kind}`,
          )

          return
        }

        response.json({
          status: 'success',
          data: {
            url: null,
          },
        })
      },
    )
  })

  /* ---
    RICH TEXT IMAGES
  --- */

  type RichTextImageRequest = Request<z.infer<typeof organizationParamsSchema>, ApiResponse<RichTextImageData>, unknown>

  /*
    Stores a picture for one of the organization's documents, answering with the URL its text
    keeps. Any member may, as any member writes the documents, and a draft not saved yet takes
    pictures too, so no document is named. The body is parsed last, as a logo's is, and only when
    it is one of the picture types, which its bytes have to say again
  */
  router.post(
    '/:organizationId/rich-text/images',
    appCheckMiddleware,
    authenticationMiddleware,
    richTextImageRateLimitMiddleware,
    validateMiddleware({ params: organizationParamsSchema }),
    organizationMemberMiddleware,
    express.raw({ type: RICH_TEXT_IMAGE_CONTENT_TYPES, limit: MAX_RICH_TEXT_IMAGE_SIZE }),
    async (request: RichTextImageRequest, response: Response<ApiResponse<RichTextImageData>>) => {
      const bytes = Buffer.isBuffer(request.body) ? request.body : null
      const contentType = bytes ? sniffImageContentType(bytes) : null

      if (!bytes || !contentType) {
        respondError(response, 415, ERROR_CODE_UNSUPPORTED_MEDIA_TYPE, 'A picture is a PNG, JPEG, GIF or WebP file')

        return
      }

      const result = await storeRichTextImage({
        organizationId: request.params.organizationId,
        userId: readViewer(request).id,
        bytes,
        contentType,
      })

      if (result.outcome === 'forbidden') {
        respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

        return
      }

      response.json({
        status: 'success',
        data: {
          url: result.url,
        },
      })
    },
  )

  return router
}

export default createOrganizationsRouter
