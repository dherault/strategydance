import express, { type Request, type Response, Router } from 'express'
import {
  type AnswerConversationQuestionData,
  type ApiResponse,
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_CONVERSATION_BUSY,
  ERROR_CODE_CONVERSATION_FULL,
  ERROR_CODE_FORBIDDEN,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_CONVERSATIONS,
  MAX_ANSWER_OTHER_LENGTH,
  MAX_CONVERSATIONS,
  MAX_QUESTION_OPTIONS,
  MAX_QUESTION_OPTION_LENGTH,
  type ResumeConversationRunData,
  type RetryConversationRunData,
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

import answerConversationQuestion from '~domain/conversations/answerConversationQuestion'
import parseConversationMessageText from '~domain/conversations/parseConversationMessageText'
import reconcileConversationRun from '~domain/conversations/reconcileConversationRun'
import resumeConversationRun from '~domain/conversations/resumeConversationRun'
import retryConversationRun from '~domain/conversations/retryConversationRun'
import sendConversationMessage from '~domain/conversations/sendConversationMessage'
import stopConversationRun from '~domain/conversations/stopConversationRun'

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
    ANSWERS
  --- */

  const answersBodySchema = z.object({
    // The question answered, a message of the conversation
    messageId: z.string().regex(UUID_PATTERN),
    // The options chosen, by their text, and the member's own words, bounded here at two code units
    // a character, since a character outside the Basic Multilingual Plane takes two: the answer's
    // check against its question holds them to the question's options and to 500 characters
    selected: z.array(z.string().max(MAX_QUESTION_OPTION_LENGTH * 2)).max(MAX_QUESTION_OPTIONS),
    other: z
      .string()
      .max(MAX_ANSWER_OTHER_LENGTH * 2)
      .nullable(),
  })

  type AnswersRequest = Request<
    z.infer<typeof messagesParamsSchema>,
    ApiResponse<AnswerConversationQuestionData>,
    z.infer<typeof answersBodySchema>
  >

  /*
    Answers a question of the turn one of the caller's conversations waits on: 202 with the run that
    carries the conversation on once no question of the turn waits, or null while another does, or
    while the caller has as many runs going as they may, when the page's reconcile starts it later.
    The same answer sent again is answered the same, and carries the conversation on when its first
    try could not. Refused with a 400 when the answer does not fit its question, as
    `checkConversationAnswer` reads it, and with a 409 when the question was skipped, answered
    otherwise, or waits for nothing any more. Answered with a 503 when the run is started but could
    not be queued, which the same answer sent again queues again
  */
  router.post(
    '/:conversationId/answers',
    express.json({ limit: '32kb' }),
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: messagesParamsSchema, body: answersBodySchema }),
    organizationMemberMiddleware,
    staffOnlyMiddleware,
    async (request: AnswersRequest, response: Response<ApiResponse<AnswerConversationQuestionData>>) => {
      const result = await answerConversationQuestion({
        organizationId: toCanonicalUuid(request.params.organizationId),
        userId: readViewer(request).id,
        conversationId: toCanonicalUuid(request.params.conversationId),
        messageId: toCanonicalUuid(request.body.messageId),
        answer: { selected: request.body.selected, other: request.body.other },
      })

      switch (result.outcome) {
        case 'forbidden':
          respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

          return
        case 'missing':
          respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This question is not in one of your conversations')

          return
        case 'invalid':
          respondError(response, 400, ERROR_CODE_BAD_REQUEST, result.reason)

          return
        case 'conflict':
          respondError(response, 409, ERROR_CODE_CONFLICT, 'This question waits for no answer')

          return
        case 'unavailable':
          respondError(response, 503, ERROR_CODE_SERVICE_UNAVAILABLE, 'The answer is kept, but cannot be followed now')

          return
        case 'answered':
          response.status(202).json({ status: 'success', data: { runId: result.runId } })
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
    shows, and one whose lease holds is left as it is. A queued run past its lease is first looked
    up in Cloud Tasks' queue, where runs go through it: kept while its task is there, queued again
    while it is young, and interrupted once its task is gone and it is older. Takes no body
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

  /*
    Stops a run, as its member asked from its page: a queued run ends stopped at once, with its
    note, a run a worker holds is asked to stop, which its worker does within two seconds, and a run
    that died with its worker ends interrupted. A run that has ended is left as it is, so a stop sent
    twice answers the same. Takes no body
  */
  router.post(
    '/:conversationId/runs/:runId/stop',
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: runParamsSchema }),
    organizationMemberMiddleware,
    staffOnlyMiddleware,
    async (request: RunRequest, response: Response<ApiResponse>) => {
      const result = await stopConversationRun({
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

  /*
    Resumes a run its member stopped, or that died with its worker, from its note, while the note is
    the conversation's newest message: the note goes, and a run carries the response on, 202 with
    its id. A resume sent again after its first try went through is answered with the run it
    started. Refused with a 409 when the run is not the latest, did not stop or die, or something
    follows its note, and when a run goes or the caller has 3 in flight. Answered with a 503 when the
    run is started but could not be queued, which the same resume sent again queues again. Takes no
    body
  */
  router.post(
    '/:conversationId/runs/:runId/resume',
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: runParamsSchema }),
    organizationMemberMiddleware,
    staffOnlyMiddleware,
    async (
      request: Request<z.infer<typeof runParamsSchema>, ApiResponse<ResumeConversationRunData>, unknown>,
      response: Response<ApiResponse<ResumeConversationRunData>>,
    ) => {
      const result = await resumeConversationRun({
        organizationId: toCanonicalUuid(request.params.organizationId),
        userId: readViewer(request).id,
        conversationId: toCanonicalUuid(request.params.conversationId),
        runId: toCanonicalUuid(request.params.runId),
      })

      switch (result.outcome) {
        case 'forbidden':
          respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

          return
        case 'missing':
          respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This conversation no longer exists')

          return
        case 'busy':
          respondError(response, 409, ERROR_CODE_CONVERSATION_BUSY, 'A response is still going, try again later')

          return
        case 'conflict':
          respondError(response, 409, ERROR_CODE_CONFLICT, 'This response cannot be resumed')

          return
        case 'unavailable':
          respondError(response, 503, ERROR_CODE_SERVICE_UNAVAILABLE, 'The response could not be resumed now')

          return
        case 'resumed':
          response.status(202).json({ status: 'success', data: { runId: result.runId } })
      }
    },
  )

  /*
    Retries a run that ended with a note, from that note: the conversation goes back to the
    member's entry the run answered, the messages the run and those it resumed drew go, and a run
    answers that entry again, 202 with its id and the runs whose messages went. A retry sent again
    after its first try went through is answered with the run it started. Never refused for a full
    conversation, whose room it gives back. Refused with a 409 when the run is not the latest or did
    not end with a note, and when a run goes or the caller has 3 in flight. Answered with a 503 when
    the run is started but could not be queued, which the same retry sent again queues again. Takes
    no body
  */
  router.post(
    '/:conversationId/runs/:runId/retry',
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: runParamsSchema }),
    organizationMemberMiddleware,
    staffOnlyMiddleware,
    async (
      request: Request<z.infer<typeof runParamsSchema>, ApiResponse<RetryConversationRunData>, unknown>,
      response: Response<ApiResponse<RetryConversationRunData>>,
    ) => {
      const result = await retryConversationRun({
        organizationId: toCanonicalUuid(request.params.organizationId),
        userId: readViewer(request).id,
        conversationId: toCanonicalUuid(request.params.conversationId),
        runId: toCanonicalUuid(request.params.runId),
      })

      switch (result.outcome) {
        case 'forbidden':
          respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

          return
        case 'missing':
          respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This conversation no longer exists')

          return
        case 'busy':
          respondError(response, 409, ERROR_CODE_CONVERSATION_BUSY, 'A response is still going, try again later')

          return
        case 'conflict':
          respondError(response, 409, ERROR_CODE_CONFLICT, 'This response cannot be retried')

          return
        case 'unavailable':
          respondError(response, 503, ERROR_CODE_SERVICE_UNAVAILABLE, 'The response could not be retried now')

          return
        case 'retried':
          response
            .status(202)
            .json({ status: 'success', data: { runId: result.runId, removedRunIds: result.removedRunIds } })
      }
    },
  )

  return router
}

export default createConversationsRouter
