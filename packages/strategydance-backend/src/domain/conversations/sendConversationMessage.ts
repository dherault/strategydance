import { randomUUID } from 'node:crypto'

import {
  MAX_ACTIVE_RUNS_PER_MEMBER,
  MAX_CONVERSATIONS,
  MAX_CONVERSATION_MESSAGES,
  MAX_CONVERSATION_SEND_INPUT_TOKENS,
  buildConversationPreview,
  buildConversationTitle,
} from 'strategydance-core'
import {
  type CompanyAspect,
  ConversationActor,
  ConversationMessageKind,
  ConversationRunStatus,
  getConversationSendContext,
  sendConversationMessageAnsweringCalls,
  sendConversationMessage as sendConversationMessageMutation,
  startConversation,
} from 'strategydance-database/backend'

import type { ConversationContentBlock } from '~types'

import { dataConnect } from '~firebase'

import buildConversationAttachmentBlock from '~domain/agent/buildConversationAttachmentBlock'
import buildConversationFileNames from '~domain/agent/buildConversationFileNames'
import {
  UNAPPROVED_CALL_RESULT,
  UNRUN_ALLOWED_CALL_RESULT,
  toFailedOutput,
} from '~domain/conversations/conversationToolResults'
import copyConversationAttachments from '~domain/conversations/copyConversationAttachments'
import enqueueRun from '~domain/conversations/enqueueRun'
import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'
import finalizeDeadConversationRuns from '~domain/conversations/finalizeDeadConversationRuns'
import isDeadConversationRun from '~domain/conversations/isDeadConversationRun'
import measureConversationMessage from '~domain/conversations/measureConversationMessage'
import readConversationOpenCalls from '~domain/conversations/readConversationOpenCalls'
import readConversationSendAttachments from '~domain/conversations/readConversationSendAttachments'
import serializeTranscriptContent from '~domain/conversations/serializeTranscriptContent'

// How many times a send reads where the conversation stands and tries, before it gives up
const MAX_ROUNDS = 4

type SendConversationMessageInput = {
  // Canonical, as `toCanonicalUuid` writes them, and the caller's uid as the backend verified it
  organizationId: string
  userId: string
  conversationId: string
  messageId: string
  // The message as the transcript keeps it, and as the thread draws it, from
  // `parseConversationMessageText`, both empty for a message of files alone
  text: string
  drawnText: string
  // The files it sends, canonical and each once, at most 10
  attachmentIds?: string[]
  // The aspects the member picked on the draft, which only the message that starts the conversation
  // carries, as the member's; none leaves them to the agent
  aspects?: CompanyAspect[]
}

type SendConversationMessageResult =
  | { outcome: 'sent'; runId: string }
  // The caller is no member of the organization
  | { outcome: 'forbidden' }
  // The conversation is somebody else's, deleted or a subagent
  | { outcome: 'missing' }
  // The message's id was sent already, elsewhere
  | { outcome: 'conflict' }
  // A run goes in the conversation, or the caller has 3 in flight
  | { outcome: 'busy' }
  | { outcome: 'full' }
  // The message would start a conversation, and the caller keeps 1000 already
  | { outcome: 'tooMany' }
  // A file it sends is not the caller's in this conversation, not stored yet, or sent already
  | { outcome: 'attachmentsInvalid' }
  // The conversation has no room for its files, or for what its next request would take with them
  | { outcome: 'overBudget'; reason: string }
  // A file it sends waited so long that the bucket deleted it, and has to be uploaded again
  | { outcome: 'attachmentExpired' }
  // The message and its run are stored, but the run could not be queued: it stays queued, and the
  // same send retried queues it again, as its page's reconcile does meanwhile
  | { outcome: 'unavailable' }

/*
  Sends a member's message, which starts the conversation with it when there is none yet, and
  queues the run that answers it, then starts that run. Each round reads where things stand first:

  - the message's id was sent already: the send is answered with the run it started, which is
    queued again while it waits in the queue, so a send retried after its first try went through
    completes what that one did not
  - a run of the caller's is in flight past its lease: it died with its worker, and is finalized
    before anything is counted, its own conversation's or another's, unless it is queued and still
    coming, as Cloud Tasks says
  - then the conversation has to be the caller's and not deleted, idle, and not full, or, when it
    does not exist yet, the caller to keep fewer than 1000, and the caller to have fewer than 3 runs
    in flight. A conversation whose run still waits in the queue has that run queued again before
    the send is answered busy, so a run whose task was lost does not keep it busy

  When the conversation's last turn left calls open, a question waiting, or calls a stop or a crash
  kept from running, the message's entry answers them first, as The transcript says: a question by
  its answer, or skipped, and a call by its result, or as stopped or interrupted. A run waiting on
  its questions is consumed, so an answer's continuation and the send never both carry it on.

  A message that starts the conversation starts it with the aspects the member picked on the draft,
  as the member's, so the agent never tags it, and a later one leaves them as they are.

  A message with files, only once nothing above refuses it: the files have to be the caller's in this
  conversation, stored and not sent, and the conversation to have room for them, its files, images,
  bytes and PDF pages counted, then the request they lead to measured under 700000 input tokens. Its
  entry holds the files before its text, each referencing its file in the Files API, after a text
  block naming each with its id (`buildConversationFileNames`), by which the agent hands one to a
  subagent. They are copied into the conversation's folder before the message is stored, which sets
  each one's message. A message of files alone holds no text of the member's, and a conversation it
  starts is titled after its first file.

  A run whose task could not be queued leaves the send stored, and answered `unavailable`.

  A write refused anyway, because a send with the same id, a run or an aspects note got there in
  between, starts another round
*/
async function sendConversationMessage(input: SendConversationMessageInput): Promise<SendConversationMessageResult> {
  const { organizationId, userId, conversationId, messageId } = input

  for (let round = 1; ; round++) {
    const { data } = await getConversationSendContext(dataConnect, {
      organizationId,
      userId,
      conversationId,
      messageId,
    })
    const { userOrganization: membership, conversation } = data
    const [sent] = data.conversationMessages

    if (!membership) return { outcome: 'forbidden' }

    if (sent) {
      if (
        sent.kind !== ConversationMessageKind.MEMBER_TEXT
        || !sent.run
        || sent.conversation.id !== conversationId
        || sent.conversation.userId !== userId
        || sent.conversation.organizationId !== organizationId
      ) {
        return { outcome: 'conflict' }
      }

      const reference = { organizationId, userId, conversationId, runId: sent.run.id }

      // A run past its lease that is still coming, its task found or queued again, is alive too, and
      // is queued again like any other still waiting, which answers whether it is
      const state = isDeadConversationRun(sent.run)
        ? await finalizeDeadConversationRun(reference, 'conversation-runs')
        : 'alive'

      if (
        state === 'alive'
        && sent.run.status === ConversationRunStatus.QUEUED
        && !(await enqueueRun(reference, 'conversation-runs'))
      ) {
        return { outcome: 'unavailable' }
      }

      return { outcome: 'sent', runId: sent.run.id }
    }

    // Read again once one has ended, which freed its conversation and the caller's allowance
    if ((await finalizeDeadConversationRuns(input, data.conversationRuns, 'conversation-runs')) && round < MAX_ROUNDS)
      continue

    if (conversation && (conversation.userId !== userId || conversation.organizationId !== organizationId)) {
      return { outcome: 'missing' }
    }

    // A subagent is written to by the agent that launched it alone
    if (conversation?.deletedAt || conversation?.parentId) return { outcome: 'missing' }
    if (conversation?.activeRunId) {
      // Among the caller's runs in flight, since it is one
      const activeRun = data.conversationRuns.find(run => run.id === conversation.activeRunId)

      if (activeRun?.status === ConversationRunStatus.QUEUED) {
        await enqueueRun({ organizationId, userId, conversationId, runId: activeRun.id }, 'conversation-runs')
      }

      return { outcome: 'busy' }
    }
    if (conversation && (conversation.isFull || conversation.messageCount >= MAX_CONVERSATION_MESSAGES)) {
      return { outcome: 'full' }
    }
    if (!conversation && (data.keptConversations[0]?._count ?? 0) >= MAX_CONVERSATIONS) return { outcome: 'tooMany' }
    if (data.conversationRuns.length >= MAX_ACTIVE_RUNS_PER_MEMBER) return { outcome: 'busy' }

    const files = input.attachmentIds?.length
      ? await readConversationSendAttachments({
          organizationId,
          userId,
          conversationId,
          attachmentIds: input.attachmentIds,
        })
      : { outcome: 'read' as const, attachments: [] }

    if (files.outcome === 'invalid') return { outcome: 'attachmentsInvalid' }
    if (files.outcome === 'overBudget') return files

    const { attachments } = files
    const follows: ConversationContentBlock[] = [
      // Named first, so the agent can hand one to a subagent by its id
      ...(attachments.length ? [buildConversationFileNames(attachments)] : []),
      ...attachments.map(attachment =>
        buildConversationAttachmentBlock(attachment, { fileId: attachment.claudeFileId }),
      ),
      ...(input.text ? [{ type: 'text', text: input.text }] : []),
    ]
    const runId = randomUUID().replaceAll('-', '')
    const message = {
      organizationId,
      userId,
      conversationId,
      membershipCreatedAt: membership.createdAt,
      messageId,
      text: input.drawnText,
      preview: buildConversationPreview({
        kind: 'MEMBER_TEXT',
        text: input.drawnText,
        conversationAttachments_on_message: attachments,
      }),
      runId,
      content: serializeTranscriptContent(follows),
      attachmentIds: attachments.map(({ id }) => id),
    }

    try {
      const [lastEntry] = data.conversationTranscriptEntries
      const answering = conversation
        ? await readConversationOpenCalls(input, lastEntry, {
            membershipCreatedAt: membership.createdAt,
            skipsQuestions: true,
            follows,
          })
        : null

      if (attachments.length) {
        const inputTokens = await measureConversationMessage({
          organizationId,
          userId,
          conversationId,
          membershipCreatedAt: membership.createdAt,
          aspects: input.aspects,
          content: answering?.content ?? message.content,
          attachments,
        })

        if (inputTokens > MAX_CONVERSATION_SEND_INPUT_TOKENS) {
          return {
            outcome: 'overBudget',
            reason: `The conversation's next request would take ${inputTokens} input tokens with these files, past ${MAX_CONVERSATION_SEND_INPUT_TOKENS}`,
          }
        }

        if (
          (await copyConversationAttachments({ organizationId, userId, conversationId }, attachments)) === 'expired'
        ) {
          return { outcome: 'attachmentExpired' }
        }
      }

      if (conversation) {
        const sent = {
          ...message,
          position: conversation.nextMessagePosition,
          runNumber: conversation.nextRunNumber,
          transcriptPosition: lastEntry ? lastEntry.position + 1 : 0,
        }

        if (answering) {
          const lastRun = answering.latestRun

          if (!lastRun) throw new Error(`Conversation ${conversationId} has calls open and no run`)

          await sendConversationMessageAnsweringCalls(dataConnect, {
            ...sent,
            content: answering.content,
            lastRunId: lastRun.id,
            isLastRunWaiting: lastRun.status === ConversationRunStatus.WAITING,
            skippedQuestionIds: answering.waitingQuestionIds,
            // The calls waiting for the member's approval, denied, and those allowed that never ran
            deniedApprovalIds: answering.waitingApprovalIds,
            deniedApprovalOutput: toFailedOutput(UNAPPROVED_CALL_RESULT),
            closedApprovalIds: answering.allowedCallIds,
            closedApprovalOutput: toFailedOutput(UNRUN_ALLOWED_CALL_RESULT),
          })
        } else {
          await sendConversationMessageMutation(dataConnect, sent)
        }
      } else {
        await startConversation(dataConnect, {
          ...message,
          title: buildConversationTitle(input.drawnText || attachments[0]?.name || ''),
          ...(input.aspects?.length ? { aspects: input.aspects, aspectsSetBy: ConversationActor.MEMBER } : {}),
        })
      }
    } catch (error) {
      if (round === MAX_ROUNDS) throw error

      continue
    }

    if (!(await enqueueRun({ organizationId, userId, conversationId, runId }, 'conversation-runs')))
      return { outcome: 'unavailable' }

    return { outcome: 'sent', runId }
  }
}

export default sendConversationMessage
