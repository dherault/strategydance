import express, { type Request, type Response, Router } from 'express'
import {
  type ApiResponse,
  BILL_RECEIPT_CONTENT_TYPES,
  type BillReceiptData,
  type BillReceiptReadData,
  countCalendarDays,
  ERROR_CODE_ATTACHMENT_TOO_LARGE,
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_FORBIDDEN,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_UNSUPPORTED_MEDIA_TYPE,
  isCalendarDay,
  MAX_BILL_RECEIPT_NAME_LENGTH,
  MAX_BILL_RECEIPT_SIZE,
} from 'strategydance-core'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import parseUploadHeaders from '~utils/parseUploadHeaders'
import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'
import respondStoredFile from '~utils/respondStoredFile'
import respondUsageCapped from '~utils/respondUsageCapped'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'
import billReceiptReaderRateLimitMiddleware from '~middleware/billReceiptReaderRateLimit'
import billReceiptReadRateLimitMiddleware from '~middleware/billReceiptReadRateLimit'
import billReceiptUploadRateLimitMiddleware from '~middleware/billReceiptUploadRateLimit'
import conversationsSuspensionMiddleware from '~middleware/conversationsSuspension'
import organizationMemberMiddleware from '~middleware/organizationMember'
import validateMiddleware from '~middleware/validate'
import verifiedEmailMiddleware from '~middleware/verifiedEmail'

import billReceiptStorage from '~domain/budget/billReceiptStorage'
import readBillReceipt from '~domain/budget/readBillReceipt'
import requestBillReceiptRead from '~domain/budget/requestBillReceiptRead'
import uploadBillReceipt from '~domain/budget/uploadBillReceipt'

/*
  An organization's budget as the backend serves it to members, for what a page cannot do with the
  web connector alone: the files of the bills' receipts, which only the backend writes to the bucket
  and reads from it. Mounted at `/organizations/:organizationId/budget`, so every route reads the
  organization from the path, and every one is a member's.

  Each runs App Check, the caller's token, the parameters' check, then the caller's membership,
  with its metering between the token and the checks, and only then reads a body, so nobody outside
  the organization gets a byte read. The receipt reader, which spends on Claude for its member, also
  asks for a confirmed address and a member whose conversations staff did not suspend, as every route
  that starts a conversation's run does
*/
function createBudgetRouter() {
  const router = Router({ mergeParams: true })

  /* ---
    RECEIPTS
  --- */

  const receiptParamsSchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
    // Made by the page, so an upload sent again stores the file once
    receiptId: z.string().regex(UUID_PATTERN),
  })

  // What a bill takes of a receipt, as its upload declares it
  const receiptUploadLimits = {
    contentTypes: BILL_RECEIPT_CONTENT_TYPES,
    maxSize: MAX_BILL_RECEIPT_SIZE,
    maxNameLength: MAX_BILL_RECEIPT_NAME_LENGTH,
    unsupportedReason: 'A receipt is a PDF, a text file or a photo',
  }

  type ReceiptRequest<Data = unknown> = Request<z.infer<typeof receiptParamsSchema>, ApiResponse<Data>>

  // Where a receipt is, by the route's parameters, canonical, and the caller as the backend verified them
  function readReceiptLocation<Data>(request: ReceiptRequest<Data>) {
    return {
      organizationId: toCanonicalUuid(request.params.organizationId),
      userId: readViewer(request).id,
      receiptId: toCanonicalUuid(request.params.receiptId),
    }
  }

  /*
    Uploads a receipt for a bill of the organization, under the id the page made for it: 201 with the
    receipt as stored, the same answer when the same upload is sent again. The body is the file's
    bytes, typed by its `Content-Type`, sized by its `Content-Length`, and named in `X-File-Name`,
    URL-encoded, all checked before anything is reserved, and the bytes streamed into Storage rather
    than held. A bill's save takes it once it is stored.

    Refused with a 415 for a type a bill does not take or bytes that are not it, a 413 past 10 MiB or
    20 pages, and a 409 for an id another receipt holds
  */
  router.put(
    '/receipts/:receiptId',
    appCheckMiddleware,
    authenticationMiddleware,
    billReceiptUploadRateLimitMiddleware,
    validateMiddleware({ params: receiptParamsSchema }),
    organizationMemberMiddleware,
    async (request: ReceiptRequest<BillReceiptData>, response: Response<ApiResponse<BillReceiptData>>) => {
      const headers = parseUploadHeaders(
        {
          contentType: request.header('content-type'),
          contentLength: request.header('content-length'),
          fileName: request.header('x-file-name'),
        },
        receiptUploadLimits,
      )

      if (headers.outcome !== 'valid') {
        respondReceiptRefusal(response, headers)

        return
      }

      const result = await uploadBillReceipt({
        ...readReceiptLocation(request),
        name: headers.name,
        contentType: headers.contentType,
        size: headers.size,
        body: request,
      })

      switch (result.outcome) {
        case 'forbidden':
          respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

          return
        case 'conflict':
          respondError(response, 409, ERROR_CODE_CONFLICT, 'A receipt with this id was uploaded otherwise')

          return
        case 'unsupported':
        case 'tooLarge':
        case 'incomplete':
          respondReceiptRefusal(response, result)

          return
        case 'stored':
          response.status(201).json({ status: 'success', data: result.receipt })
      }
    },
  )

  /*
    Serves the bytes of a bill's receipt to any member of its organization, whoever uploaded it,
    while they are a member, which the route checks on every read. Streamed from Storage with
    private cache headers, since its bytes never change; the page fetches it with the caller's token
    and shows it as an object URL
  */
  router.get(
    '/receipts/:receiptId',
    appCheckMiddleware,
    authenticationMiddleware,
    billReceiptReadRateLimitMiddleware,
    validateMiddleware({ params: receiptParamsSchema }),
    organizationMemberMiddleware,
    async (request: ReceiptRequest, response: Response) => {
      const result = await readBillReceipt(readReceiptLocation(request))

      if (result.outcome === 'forbidden') {
        respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

        return
      }

      if (result.outcome === 'missing') {
        respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This receipt no longer exists')

        return
      }

      respondStoredFile(response, billReceiptStorage.openRead(result.objectName), result)
    },
  )

  /*
    Asks the receipt reader what a receipt says, for the upload dialog to fill a bill in with: 200 with
    the fields it found, the first time and every time after, for nothing. Only the member who uploaded
    the receipt asks, with their today, `YYYY-MM-DD`, within a day of the server's, which a day the
    receipt writes without a year resolves against.

    Refused with a 403 for another member's receipt, a 404 for one not stored, a 413 for a photo past
    what Claude reads, a 409 while another read of it is under way, a 429 naming the cap the member's
    or the organization's reads reached, its `Retry-After` saying when it has room again, and a 503 when
    Claude answered nothing the bill dialog takes, or failed, which the member can ask again
  */
  const readBodySchema = z.object({
    today: z
      .string()
      .refine(
        today => isCalendarDay(today) && Math.abs(countCalendarDays(new Date().toISOString().slice(0, 10), today)) <= 1,
        'today is a YYYY-MM-DD day within one of the server’s',
      ),
  })

  router.post(
    '/receipts/:receiptId/read',
    express.json({ limit: '1kb' }),
    appCheckMiddleware,
    authenticationMiddleware,
    billReceiptReaderRateLimitMiddleware,
    validateMiddleware({ params: receiptParamsSchema, body: readBodySchema }),
    organizationMemberMiddleware,
    verifiedEmailMiddleware,
    conversationsSuspensionMiddleware,
    async (request: ReceiptRequest<BillReceiptReadData>, response: Response<ApiResponse<BillReceiptReadData>>) => {
      const { today } = request.body as z.infer<typeof readBodySchema>
      const result = await requestBillReceiptRead({ ...readReceiptLocation(request), today })

      switch (result.outcome) {
        case 'forbidden':
          respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

          return
        case 'notUploader':
          respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only the member who uploaded a receipt can have it read')

          return
        case 'missing':
          respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This receipt no longer exists')

          return
        case 'tooLarge':
          respondError(response, 413, ERROR_CODE_ATTACHMENT_TOO_LARGE, 'This photo is too large to be read')

          return
        case 'expired':
          respondError(response, 409, ERROR_CODE_CONFLICT, 'This receipt was uploaded too long ago to be read')

          return
        case 'busy':
          respondError(response, 409, ERROR_CODE_CONFLICT, 'This receipt is being read already')

          return
        case 'capped':
          respondUsageCapped(response, result.cap)

          return
        case 'failed':
          respondError(response, 503, ERROR_CODE_SERVICE_UNAVAILABLE, 'The receipt could not be read, try again')

          return
        case 'read':
          response.status(200).json({ status: 'success', data: { fields: result.fields } })
      }
    },
  )

  return router
}

// The refusal of a receipt for what it is: a 415 for its type, a 413 for its size, a 400 otherwise
function respondReceiptRefusal(response: Response, refusal: { outcome: string; reason: string }) {
  if (refusal.outcome === 'unsupported') respondError(response, 415, ERROR_CODE_UNSUPPORTED_MEDIA_TYPE, refusal.reason)
  else if (refusal.outcome === 'tooLarge') respondError(response, 413, ERROR_CODE_ATTACHMENT_TOO_LARGE, refusal.reason)
  else respondError(response, 400, ERROR_CODE_BAD_REQUEST, refusal.reason)
}

export default createBudgetRouter
