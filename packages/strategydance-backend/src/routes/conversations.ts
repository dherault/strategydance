import express, { type Request, type Response, Router } from 'express'
import {
  type AnswerConversationApprovalData,
  type AnswerConversationQuestionData,
  type ApiResponse,
  type ConversationAttachmentData,
  ERROR_CODE_ATTACHMENT_TOO_LARGE,
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_CONVERSATION_ATTACHMENTS_OVER_BUDGET,
  ERROR_CODE_CONVERSATION_BUSY,
  ERROR_CODE_CONVERSATION_FULL,
  ERROR_CODE_FORBIDDEN,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_CONVERSATIONS,
  ERROR_CODE_TOO_MANY_PENDING_ATTACHMENTS,
  ERROR_CODE_TOO_MANY_REQUESTS,
  ERROR_CODE_UNSUPPORTED_MEDIA_TYPE,
  MAX_ANSWER_OTHER_LENGTH,
  MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE,
  MAX_CONVERSATIONS,
  MAX_PENDING_CONVERSATION_ATTACHMENTS,
  MAX_QUESTION_OPTIONS,
  MAX_QUESTION_OPTION_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_TERMS,
  type ResumeConversationRunData,
  type RetryConversationRunData,
  type SearchConversationsData,
  type SendConversationMessageData,
  splitSearchTerms,
} from 'strategydance-core'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import parseConversationAttachmentHeaders from '~utils/parseConversationAttachmentHeaders'
import readViewer from '~utils/readViewer'
import respondError from '~utils/respondError'
import respondUsageCapped from '~utils/respondUsageCapped'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import appCheckMiddleware from '~middleware/appCheck'
import authenticationMiddleware from '~middleware/authentication'
import conversationAttachmentReadRateLimitMiddleware from '~middleware/conversationAttachmentReadRateLimit'
import conversationAttachmentRemovalRateLimitMiddleware from '~middleware/conversationAttachmentRemovalRateLimit'
import conversationAttachmentUploadRateLimitMiddleware from '~middleware/conversationAttachmentUploadRateLimit'
import conversationRunControlRateLimitMiddleware from '~middleware/conversationRunControlRateLimit'
import createConversationSearchRateLimitMiddleware from '~middleware/conversationSearchRateLimit'
import conversationsSuspensionMiddleware from '~middleware/conversationsSuspension'
import organizationMemberMiddleware from '~middleware/organizationMember'
import validateMiddleware from '~middleware/validate'
import verifiedEmailMiddleware from '~middleware/verifiedEmail'

import answerConversationApproval from '~domain/conversations/answerConversationApproval'
import answerConversationQuestion from '~domain/conversations/answerConversationQuestion'
import conversationAttachmentStorage from '~domain/conversations/conversationAttachmentStorage'
import parseConversationMessageText from '~domain/conversations/parseConversationMessageText'
import readConversationAttachment from '~domain/conversations/readConversationAttachment'
import reconcileConversationRun from '~domain/conversations/reconcileConversationRun'
import removeConversationAttachment from '~domain/conversations/removeConversationAttachment'
import resumeConversationRun from '~domain/conversations/resumeConversationRun'
import retryConversationRun from '~domain/conversations/retryConversationRun'
import searchConversations from '~domain/conversations/searchConversations'
import sendConversationMessage from '~domain/conversations/sendConversationMessage'
import stopConversationRun from '~domain/conversations/stopConversationRun'
import uploadConversationAttachment from '~domain/conversations/uploadConversationAttachment'
import reconcileConversationSubagents from '~domain/subagents/reconcileConversationSubagents'
import stopConversationSubagents from '~domain/subagents/stopConversationSubagents'

import { aspectsSchema } from '~modules/moduleSchemas'

/*
  A member's conversations in an organization, mounted at
  `/organizations/:organizationId/conversations`, whose `:organizationId` each route reads through
  `mergeParams`. Only their author reaches a conversation, which every operation behind a route
  checks.

  Each route runs its middleware in one order: the body parsed, App Check, the caller's token, the
  parameters and the body checked, then the caller's membership, which reads and writes nothing
  before them. The search is metered between the token and the checks, as
  the routes other routers meter are. The routes that start or continue a run, the send, an answer,
  an approval, Resume, Retry and a file's upload, then refuse with a 403 a caller whose token says
  their address is not confirmed (`verifiedEmailMiddleware`), and one whose conversations staff
  suspended, their account's or the organization's (`conversationsSuspensionMiddleware`): the others
  stop, reconcile or read, which a member does whatever their address, suspended or not
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
    // The aspects the member picked on the draft, which the message that starts the conversation
    // carries, each at most once
    aspects: aspectsSchema.optional(),
    // The files it sends, uploaded first, by the ids the browser made for them
    attachmentIds: z.array(z.string().regex(UUID_PATTERN)).max(MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE).optional(),
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
    The text is trimmed, and refused with a 400 when it holds nothing or more than 20000 characters,
    unless the message sends files, up to 10, uploaded first: then it may hold nothing. Files that are
    not the caller's ready to send are refused with a 400, and files the conversation has no room
    for, or whose next request would pass 700000 input tokens, with a 409.
    A conversation it would start past the thousand the caller keeps is refused with a 409. The
    aspects the member picked on the draft start it as the member's, and any other message leaves
    them out. A send that would pass a daily cap on the runs the caller starts, or on the
    conversations for one that starts one, is refused with a 429 naming the cap, its `Retry-After`
    saying when it has room again; one retried after its first try went through is answered as
    above, whatever the caps.

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
    verifiedEmailMiddleware,
    conversationsSuspensionMiddleware,
    async (request: MessagesRequest, response: Response<ApiResponse<SendConversationMessageData>>) => {
      const attachmentIds = [...new Set(request.body.attachmentIds?.map(toCanonicalUuid))]
      const text = parseConversationMessageText(request.body.text, { allowsEmpty: attachmentIds.length > 0 })

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
        aspects: request.body.aspects,
        attachmentIds,
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
        case 'capped':
          respondUsageCapped(response, result.cap)

          return
        case 'attachmentsInvalid':
          respondError(response, 400, ERROR_CODE_BAD_REQUEST, 'A file is not one of this conversation’s ready to send')

          return
        case 'overBudget':
          respondError(response, 409, ERROR_CODE_CONVERSATION_ATTACHMENTS_OVER_BUDGET, result.reason)

          return
        case 'attachmentExpired':
          respondError(response, 409, ERROR_CODE_CONFLICT, 'A file waited too long to be sent, and is uploaded again')

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
    verifiedEmailMiddleware,
    conversationsSuspensionMiddleware,
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
    APPROVALS
  --- */

  const approvalsBodySchema = z.object({
    // The call waiting for the member's approval, a message of the conversation
    messageId: z.string().regex(UUID_PATTERN),
    // Allow, or Deny
    isAllowed: z.boolean(),
  })

  type ApprovalsRequest = Request<
    z.infer<typeof messagesParamsSchema>,
    ApiResponse<AnswerConversationApprovalData>,
    z.infer<typeof approvalsBodySchema>
  >

  /*
    Allows or denies a call of the turn one of the caller's conversations waits on, which waits for
    their approval, as a question is answered: 202 with the run that carries the conversation on once
    nothing of the turn waits, or null, and whether an Allow was denied instead because the server,
    the tool or the account changed since the call was proposed. The same decision sent again is
    answered the same. Refused with a 409 when the approval was decided otherwise, denied by a message
    sent instead, or waits for nothing any more, and answered with a 503 when the run is started but
    could not be queued, which the same decision sent again queues again
  */
  router.post(
    '/:conversationId/approvals',
    express.json({ limit: '1kb' }),
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: messagesParamsSchema, body: approvalsBodySchema }),
    organizationMemberMiddleware,
    verifiedEmailMiddleware,
    conversationsSuspensionMiddleware,
    async (request: ApprovalsRequest, response: Response<ApiResponse<AnswerConversationApprovalData>>) => {
      const result = await answerConversationApproval({
        organizationId: toCanonicalUuid(request.params.organizationId),
        userId: readViewer(request).id,
        conversationId: toCanonicalUuid(request.params.conversationId),
        messageId: toCanonicalUuid(request.body.messageId),
        isAllowed: request.body.isAllowed,
      })

      switch (result.outcome) {
        case 'forbidden':
          respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

          return
        case 'missing':
          respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This call is not in one of your conversations')

          return
        case 'conflict':
          respondError(response, 409, ERROR_CODE_CONFLICT, 'This call waits for no approval')

          return
        case 'unavailable':
          respondError(
            response,
            503,
            ERROR_CODE_SERVICE_UNAVAILABLE,
            'The decision is kept, but cannot be followed now',
          )

          return
        case 'answered':
          response.status(202).json({ status: 'success', data: { runId: result.runId, isChanged: result.isChanged } })
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
    conversationRunControlRateLimitMiddleware,
    validateMiddleware({ params: runParamsSchema }),
    organizationMemberMiddleware,
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
    Asked by a conversation's page every two minutes while one of its subagents is live: the
    member's subagent runs in the organization are reconciled, those of every conversation of theirs,
    since any holds one of their five slots. A run that died with its worker ends interrupted with its
    report, a queued one whose task is gone is queued again while it is young, a run waiting for a
    slot that may not have one ends, and the oldest runs waiting take the slots free. Refused with a
    404 unless the conversation is the caller's and no subagent. Takes no body
  */
  router.post(
    '/:conversationId/subagents/reconcile',
    appCheckMiddleware,
    authenticationMiddleware,
    conversationRunControlRateLimitMiddleware,
    validateMiddleware({ params: messagesParamsSchema }),
    organizationMemberMiddleware,
    async (
      request: Request<z.infer<typeof messagesParamsSchema>, ApiResponse, unknown>,
      response: Response<ApiResponse>,
    ) => {
      const result = await reconcileConversationSubagents({
        organizationId: toCanonicalUuid(request.params.organizationId),
        userId: readViewer(request).id,
        conversationId: toCanonicalUuid(request.params.conversationId),
      })

      if (result.outcome === 'missing') {
        respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This conversation is not one of yours')

        return
      }

      response.json({ status: 'success' })
    },
  )

  /*
    Stops every live subagent of a conversation, as the strip above its composer's Stop all does:
    each run they are busy with is asked to stop, a queued one, or one waiting for a slot, ends at
    once with its report, and a working one at its worker's next step, reporting what it had. Refused
    with a 404 unless the conversation is the caller's, not deleted and no subagent. Takes no body
  */
  router.post(
    '/:conversationId/subagents/stop',
    appCheckMiddleware,
    authenticationMiddleware,
    conversationRunControlRateLimitMiddleware,
    validateMiddleware({ params: messagesParamsSchema }),
    organizationMemberMiddleware,
    async (
      request: Request<z.infer<typeof messagesParamsSchema>, ApiResponse, unknown>,
      response: Response<ApiResponse>,
    ) => {
      const result = await stopConversationSubagents({
        organizationId: toCanonicalUuid(request.params.organizationId),
        userId: readViewer(request).id,
        conversationId: toCanonicalUuid(request.params.conversationId),
      })

      if (result.outcome === 'missing') {
        respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This conversation is not one of yours')

        return
      }

      response.json({ status: 'success' })
    },
  )

  const subagentParamsSchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
    conversationId: z.string().regex(UUID_PATTERN),
    subagentId: z.string().regex(UUID_PATTERN),
  })

  /*
    Stops one subagent of a conversation, as its row's Stop does, the conversation naming it, so a
    subagent is never acted on but through its parent. One that has ended, or is not the
    conversation's, changes nothing, and a stop sent twice answers the same. Refused with a 404
    unless the conversation is the caller's, not deleted and no subagent. Takes no body
  */
  router.post(
    '/:conversationId/subagents/:subagentId/stop',
    appCheckMiddleware,
    authenticationMiddleware,
    conversationRunControlRateLimitMiddleware,
    validateMiddleware({ params: subagentParamsSchema }),
    organizationMemberMiddleware,
    async (
      request: Request<z.infer<typeof subagentParamsSchema>, ApiResponse, unknown>,
      response: Response<ApiResponse>,
    ) => {
      const result = await stopConversationSubagents(
        {
          organizationId: toCanonicalUuid(request.params.organizationId),
          userId: readViewer(request).id,
          conversationId: toCanonicalUuid(request.params.conversationId),
        },
        { subagentIds: [toCanonicalUuid(request.params.subagentId)] },
      )

      if (result.outcome === 'missing') {
        respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This conversation is not one of yours')

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
    conversationRunControlRateLimitMiddleware,
    validateMiddleware({ params: runParamsSchema }),
    organizationMemberMiddleware,
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
    follows its note, and when a run goes or the caller has 3 in flight, and with a 429 at a daily
    cap on the runs the caller starts, as a send is. Answered with a 503 when the
    run is started but could not be queued, which the same resume sent again queues again. Takes no
    body
  */
  router.post(
    '/:conversationId/runs/:runId/resume',
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: runParamsSchema }),
    organizationMemberMiddleware,
    verifiedEmailMiddleware,
    conversationsSuspensionMiddleware,
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
        case 'capped':
          respondUsageCapped(response, result.cap)

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
    not end with a note, and when a run goes or the caller has 3 in flight, and with a 429 at a
    daily cap on the runs the caller starts, as a send is. Answered with a 503 when
    the run is started but could not be queued, which the same retry sent again queues again. Takes
    no body
  */
  router.post(
    '/:conversationId/runs/:runId/retry',
    appCheckMiddleware,
    authenticationMiddleware,
    validateMiddleware({ params: runParamsSchema }),
    organizationMemberMiddleware,
    verifiedEmailMiddleware,
    conversationsSuspensionMiddleware,
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
        case 'capped':
          respondUsageCapped(response, result.cap)

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

  /* ---
    SEARCH
  --- */

  const searchParamsSchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
  })

  // Bounded in UTF-16 code units, as the search field's `maxLength` counts them
  const searchBodySchema = z.object({
    query: z
      .string()
      .trim()
      .min(1, 'A search holds at least one word')
      .max(MAX_SEARCH_QUERY_LENGTH, `A search holds at most ${MAX_SEARCH_QUERY_LENGTH} characters`)
      .refine(
        query => splitSearchTerms(query).length <= MAX_SEARCH_TERMS,
        `A search holds at most ${MAX_SEARCH_TERMS} words`,
      )
      // Postgres refuses U+0000 in any text it is sent, which a field cannot type and a script can
      .refine(query => !query.includes('\u0000'), 'A search holds no U+0000'),
  })

  type SearchRequest = Request<
    z.infer<typeof searchParamsSchema>,
    ApiResponse<SearchConversationsData>,
    z.infer<typeof searchBodySchema>
  >

  // This router's count, one instance's, made once, as `createConversationSearchRateLimitMiddleware`
  // explains
  const searchRateLimitMiddleware = createConversationSearchRateLimitMiddleware()

  /*
    Searches the caller's conversations in the organization for every word of a query, in a title or
    in one of the member's or the agent's messages, and answers the ids of those it found with how
    far it looked. The query travels in the body rather than the address, so what somebody looks for
    in their own conversations never sits in a logged URL. It is trimmed, and refused with a 400
    when it holds nothing, more than 100 characters, more than 8 words or U+0000.

    Metered twice, both refusing with a 429: the instance's count turns a script away before
    anything reads the database, and the database's, which every instance shares, says in
    `Retry-After` when the next search fits
  */
  router.post(
    '/search',
    express.json({ limit: '4kb' }),
    appCheckMiddleware,
    authenticationMiddleware,
    searchRateLimitMiddleware,
    validateMiddleware({ params: searchParamsSchema, body: searchBodySchema }),
    organizationMemberMiddleware,
    async (request: SearchRequest, response: Response<ApiResponse<SearchConversationsData>>) => {
      const result = await searchConversations({
        organizationId: toCanonicalUuid(request.params.organizationId),
        userId: readViewer(request).id,
        query: request.body.query,
      })

      switch (result.outcome) {
        case 'forbidden':
          respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

          return
        case 'tooMany':
          // At least a second: the oldest search may have aged out between the read and now
          response.setHeader('Retry-After', Math.max(1, Math.ceil(result.retryAfterMs / 1000)))
          respondError(response, 429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many searches, try again in a few minutes')

          return
        case 'found':
          response.json({
            status: 'success',
            data: { conversationIds: result.conversationIds, coverage: result.coverage },
          })
      }
    },
  )

  /* ---
    ATTACHMENTS
  --- */

  const attachmentParamsSchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
    // A draft's, made by the browser, before the conversation exists, as often as a saved one's
    conversationId: z.string().regex(UUID_PATTERN),
    // Made by the browser, so an upload sent again stores the file once
    attachmentId: z.string().regex(UUID_PATTERN),
  })

  type AttachmentRequest<Data = unknown> = Request<z.infer<typeof attachmentParamsSchema>, ApiResponse<Data>>

  // Where a file is, by the route's parameters, canonical, and the caller as the backend verified them
  function readAttachmentLocation<Data>(request: AttachmentRequest<Data>) {
    return {
      organizationId: toCanonicalUuid(request.params.organizationId),
      userId: readViewer(request).id,
      conversationId: toCanonicalUuid(request.params.conversationId),
      attachmentId: toCanonicalUuid(request.params.attachmentId),
    }
  }

  /*
    Uploads a file to one of the caller's conversations, or to a draft not saved yet, under the id
    the browser made for it: 201 with the file as stored, the same answer when the same upload is
    sent again. The body is the file's bytes, typed by its `Content-Type`, sized by its
    `Content-Length`, and named in `X-File-Name`, URL-encoded, all checked before anything is
    reserved, and the bytes streamed into Storage rather than held. Parsed last, after everything
    that says the caller may send it, so nobody else gets megabytes read.

    Refused with a 415 for a type a conversation does not take or bytes that are not it, a 413 past
    what Claude or the route takes, a 409 at the caller's 30 unsent files, before any byte is
    stored, and a 409 for an id another file holds
  */
  router.put(
    '/:conversationId/attachments/:attachmentId',
    appCheckMiddleware,
    authenticationMiddleware,
    conversationAttachmentUploadRateLimitMiddleware,
    validateMiddleware({ params: attachmentParamsSchema }),
    organizationMemberMiddleware,
    verifiedEmailMiddleware,
    conversationsSuspensionMiddleware,
    async (
      request: AttachmentRequest<ConversationAttachmentData>,
      response: Response<ApiResponse<ConversationAttachmentData>>,
    ) => {
      const headers = parseConversationAttachmentHeaders({
        contentType: request.header('content-type'),
        contentLength: request.header('content-length'),
        fileName: request.header('x-file-name'),
      })

      if (headers.outcome !== 'valid') {
        respondAttachmentRefusal(response, headers)

        return
      }

      const result = await uploadConversationAttachment({
        ...readAttachmentLocation(request),
        name: headers.name,
        contentType: headers.contentType,
        size: headers.size,
        body: request,
      })

      switch (result.outcome) {
        case 'forbidden':
          respondError(response, 403, ERROR_CODE_FORBIDDEN, 'Only a member of the organization can do this')

          return
        case 'missing':
          respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This conversation no longer exists')

          return
        case 'conflict':
          respondError(response, 409, ERROR_CODE_CONFLICT, 'A file with this id was uploaded otherwise')

          return
        case 'tooMany':
          respondError(
            response,
            409,
            ERROR_CODE_TOO_MANY_PENDING_ATTACHMENTS,
            `Somebody has at most ${MAX_PENDING_CONVERSATION_ATTACHMENTS} files waiting to be sent in an organization`,
          )

          return
        case 'unsupported':
        case 'tooLarge':
          respondAttachmentRefusal(response, result)

          return
        case 'stored':
          response.status(201).json({ status: 'success', data: result.attachment })
      }
    },
  )

  /*
    Removes a file the caller uploaded to a conversation and has not sent, as the composer's tray
    does, so its place among their 30 frees at once: 200, the same when it is gone already. A sent
    file is refused with a 409, since only its conversation's deletion removes it
  */
  router.delete(
    '/:conversationId/attachments/:attachmentId',
    appCheckMiddleware,
    authenticationMiddleware,
    conversationAttachmentRemovalRateLimitMiddleware,
    validateMiddleware({ params: attachmentParamsSchema }),
    organizationMemberMiddleware,
    async (request: AttachmentRequest, response: Response<ApiResponse>) => {
      const result = await removeConversationAttachment(readAttachmentLocation(request))

      if (result.outcome === 'sent') {
        respondError(response, 409, ERROR_CODE_CONFLICT, 'A sent file goes only with its conversation')

        return
      }

      response.json({ status: 'success' })
    },
  )

  /*
    Serves the bytes of a file of the caller's, as the thread draws an image or offers a file: only
    to its author while they are a member, which the route checks on every read, and for a sent file
    only while its conversation is theirs and not deleted. Streamed from Storage with private cache
    headers, since its bytes never change; the thread fetches it with the caller's token and shows it
    as an object URL
  */
  router.get(
    '/:conversationId/attachments/:attachmentId',
    appCheckMiddleware,
    authenticationMiddleware,
    conversationAttachmentReadRateLimitMiddleware,
    validateMiddleware({ params: attachmentParamsSchema }),
    organizationMemberMiddleware,
    async (request: AttachmentRequest, response: Response) => {
      const result = await readConversationAttachment(readAttachmentLocation(request))

      if (result.outcome === 'missing') {
        respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This file no longer exists')

        return
      }

      const stream = conversationAttachmentStorage.openRead(result.objectName)

      stream.once('error', () => {
        if (response.headersSent) response.destroy()
        else respondError(response, 404, ERROR_CODE_NOT_FOUND, 'This file no longer exists')
      })
      stream.once('readable', () => {
        response.setHeader(
          'Content-Type',
          result.contentType.startsWith('text/') ? `${result.contentType}; charset=utf-8` : result.contentType,
        )
        response.setHeader('Content-Length', result.size)
        response.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
        response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeHeaderValue(result.name)}`)
        stream.pipe(response)
      })
    },
  )

  return router
}

// A file's name as an RFC 5987 value, which takes none of the characters `encodeURIComponent` leaves
function encodeHeaderValue(value: string) {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

// The refusal of a file for what it is: a 415 for its type, a 413 for its size, a 400 otherwise
function respondAttachmentRefusal(response: Response, refusal: { outcome: string; reason: string }) {
  if (refusal.outcome === 'unsupported') respondError(response, 415, ERROR_CODE_UNSUPPORTED_MEDIA_TYPE, refusal.reason)
  else if (refusal.outcome === 'tooLarge') respondError(response, 413, ERROR_CODE_ATTACHMENT_TOO_LARGE, refusal.reason)
  else respondError(response, 400, ERROR_CODE_BAD_REQUEST, refusal.reason)
}

export default createConversationsRouter
