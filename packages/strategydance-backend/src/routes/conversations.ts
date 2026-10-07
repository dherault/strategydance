import express, { type Request, type Response, Router } from 'express'
import {
  type ApiResponse,
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_CONVERSATION_BUSY,
  ERROR_CODE_CONVERSATION_FULL,
  ERROR_CODE_FORBIDDEN,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_CONVERSATIONS,
  MAX_CONVERSATIONS,
  type SendConversationMessageData,
} from 'strategydance-core'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'
import organizationMemberMiddleware from '~middleware/organizationMember'
import staffOnlyMiddleware from '~middleware/staffOnly'
import validateMiddleware from '~middleware/validate'

import parseConversationMessageText from '~domain/conversations/parseConversationMessageText'
import reconcileConversationRun from '~domain/conversations/reconcileConversationRun'
import sendConversationMessage from '~domain/conversations/sendConversationMessage'

/*
  A member's conversations in an organization, mounted at
  `/organizations/:organizationId/conversations`, whose `:organizationId` each route reads through
  `mergeParams`. Only their author reaches a conversation, which every operation behind a route
  checks, and only Strategy Dance's administrators while conversations are open to them alone.

  Each route runs its middleware in one order: the body parsed, App Check, the caller's token, the
  parameters and the body checked, then the caller's membership and whether they are staff, which
  read and write nothing before them
*/
function createConversationsRouter() {
  const router = Router({ mergeParams: true })

  /* ---
    MESSAGES
  --- */

  const messagesParamsSchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
    conversationId: z.string().regex(UUID_PATTERN),
  })

  const messagesBodySchema = z.object({
    // Made by the browser, so a send retried after its first try went through stores it once
    messageId: z.string().regex(UUID_PATTERN),
    text: z.string(),
  })

  type MessagesRequest = Request<
    z.infer<typeof messagesParamsSchema>,
    ApiResponse<SendConversationMessageData>,
    z.infer<typeof messagesBodySchema>
  >

  /*
    Sends a message to one of the caller's conversations, which starts it when it does not exist
    yet, under the id the browser made for it, and queues the run that answers it: 202 with the
    run's id, the one a send with the same message's id started the first time when it is retried.
    The text is trimmed, and refused with a 400 when it holds nothing or more than 20000 characters.
    A conversation it would start past the thousand the caller keeps is refused with a 409.

    Answered with a 503 when the run is stored but could not be queued for the worker: the browser
    sends the same message again, under the same id, which queues it again, and the conversation's
    page asks for its run to be reconciled meanwhile, which does too. 20000 characters escaped as
    JSON can take six bytes each, which the body's limit allows
  */
  router.post(
    '/:conversationId/messages',
    express.json({ limit: '256kb' }),
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: messagesParamsSchema, body: messagesBodySchema }),
    organizationMemberMiddleware,
    staffOnlyMiddleware,
    async (request: MessagesRequest, response: Response<ApiResponse<SendConversationMessageData>>) => {
      const text = parseConversationMessageText(request.body.text)

      if (text.outcome === 'invalid') {
        respondError(response, 400, ERROR_CODE_BAD_REQUEST, text.reason)

        return
      }

      const result = await sendConversationMessage({
        organizationId: toCanonicalUuid(request.params.organizationId),
        userId: readViewer(request).id,
        conversationId: toCanonicalUuid(request.params.conversationId),
        messageId: toCanonicalUuid(request.body.messageId),
        text: text.text,
        drawnText: text.drawnText,
      })

      switch (result.outcome) {
        case 'forbidden':
          respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

          return
        case 'missing':
          respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This conversation no longer exists')

          return
        case 'conflict':
          respondError(response, 409, ERROR_CODE_CONFLICT, 'A message with this id was sent elsewhere')

          return
        case 'busy':
          respondError(response, 409, ERROR_CODE_CONVERSATION_BUSY, 'A response is still going, try again later')

          return
        case 'full':
          respondError(response, 409, ERROR_CODE_CONVERSATION_FULL, 'This conversation is full')

          return
        case 'tooMany':
          respondError(
            response,
            409,
            ERROR_CODE_TOO_MANY_CONVERSATIONS,
            `Somebody keeps at most ${MAX_CONVERSATIONS} conversations in an organization`,
          )

          return
        case 'unavailable':
          respondError(response, 503, ERROR_CODE_SERVICE_UNAVAILABLE, 'The message is kept, but cannot be answered now')

          return
        case 'sent':
          response.status(202).json({
            status: 'success',
            data: {
              runId: result.runId,
            },
          })
      }
    },
  )

  /* ---
    RUNS
  --- */

  const runParamsSchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
    conversationId: z.string().regex(UUID_PATTERN),
    runId: z.string().regex(UUID_PATTERN),
  })

  type RunRequest = Request<z.infer<typeof runParamsSchema>, ApiResponse, unknown>

  /*
    Asked by a conversation's page once the run it shows is past its lease, and every two minutes
    after: a run that died with its worker ends interrupted, with its note, which the page then
    shows, and one whose lease holds is left as it is. Takes no body
  */
  router.post(
    '/:conversationId/runs/:runId/reconcile',
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: runParamsSchema }),
    organizationMemberMiddleware,
    staffOnlyMiddleware,
    async (request: RunRequest, response: Response<ApiResponse>) => {
      const result = await reconcileConversationRun({
        organizationId: toCanonicalUuid(request.params.organizationId),
        userId: readViewer(request).id,
        conversationId: toCanonicalUuid(request.params.conversationId),
        runId: toCanonicalUuid(request.params.runId),
      })

      if (result.outcome === 'missing') {
        respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This run is not in one of your conversations')

        return
      }

      response.json({ status: 'success' })
    },
  )

  return router
}

export default createConversationsRouter
