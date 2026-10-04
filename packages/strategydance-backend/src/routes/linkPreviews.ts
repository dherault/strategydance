import express, { type Request, type Response, Router } from 'express'
import type { ApiResponse, LinkPreviewData } from 'strategydance-core'
import { z } from 'zod'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'
import linkPreviewRateLimitMiddleware from '~middleware/linkPreviewRateLimit'
import validateMiddleware from '~middleware/validate'

import readLinkPreview from '~domain/linkPreviews/readLinkPreview'

// Longer than any address a person pastes
const MAX_URL_LENGTH = 2048

function createLinkPreviewsRouter() {
  const router = Router()

  const bodySchema = z.object({
    url: z
      .string()
      .max(MAX_URL_LENGTH)
      .refine(value => URL.canParse(value) && /^https?:$/.test(new URL(value).protocol), 'Not a web address'),
  })

  type LinkPreviewRequest = Request<Record<string, never>, ApiResponse<LinkPreviewData>, z.infer<typeof bodySchema>>

  /*
    What a web page says of itself, for a link preview card in a document: the browser cannot read
    another site's page, which the server does for it, through the guard every request it makes on
    another's behalf goes through. Any signed-in caller may, as the card is the caller's own to
    draw; the rate limit keeps it from being a way of fetching pages
  */
  router.post(
    '/',
    express.json({ limit: '4kb' }),
    appCheckMiddleware,
    authenticationMiddleware,
    linkPreviewRateLimitMiddleware,
    validateMiddleware({ body: bodySchema }),
    async (request: LinkPreviewRequest, response: Response<ApiResponse<LinkPreviewData>>) => {
      response.json({
        status: 'success',
        data: await readLinkPreview(request.body.url),
      })
    },
  )

  return router
}

export default createLinkPreviewsRouter
