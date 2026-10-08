import { randomUUID } from 'node:crypto'

import {
  MAX_ACTIVE_RUNS_PER_MEMBER,
  MAX_CONVERSATIONS,
  MAX_CONVERSATION_MESSAGES,
  buildConversationPreview,
  buildConversationTitle,
} from 'strategydance-core'
import {
  ConversationMessageKind,
  ConversationRunStatus,
  getConversationSendContext,
  sendConversationMessageAnsweringCalls,
  sendConversationMessage as sendConversationMessageMutation,
  startConversation,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import enqueueRun from '~domain/conversations/enqueueRun'
import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'
import finalizeDeadConversationRuns from '~domain/conversations/finalizeDeadConversationRuns'
import isDeadConversationRun from '~domain/conversations/isDeadConversationRun'
import readConversationOpenCalls from '~domain/conversations/readConversationOpenCalls'
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
  // `parseConversationMessageText`
  text: string
  drawnText: string
}

type SendConversationMessageResult =
  | { outcome: 'sent'; runId: string }
  // The caller is no member of the organization
  | { outcome: 'forbidden' }
  // The conversation is somebody else's, or deleted
  | { outcome: 'missing' }
  // The message's id was sent already, elsewhere
  | { outcome: 'conflict' }
  // A run goes in the conversation, or the caller has 3 in flight
  | { outcome: 'busy' }
  | { outcome: 'full' }
  // The message would start a conversation, and the caller keeps 1000 already
  | { outcome: 'tooMany' }
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
      const state = isDeadConversationRun(sent.run) ? await finalizeDeadConversationRun(reference) : 'alive'

      if (state === 'alive' && sent.run.status === ConversationRunStatus.QUEUED && !(await enqueueRun(reference))) {
        return { outcome: 'unavailable' }
      }

      return { outcome: 'sent', runId: sent.run.id }
    }

    // Read again once one has ended, which freed its conversation and the caller's allowance
    if ((await finalizeDeadConversationRuns(input, data.conversationRuns)) && round < MAX_ROUNDS) continue

    if (conversation && (conversation.userId !== userId || conversation.organizationId !== organizationId)) {
      return { outcome: 'missing' }
    }

    if (conversation?.deletedAt) return { outcome: 'missing' }
    if (conversation?.activeRunId) {
      // Among the caller's runs in flight, since it is one
      const activeRun = data.conversationRuns.find(run => run.id === conversation.activeRunId)

      if (activeRun?.status === ConversationRunStatus.QUEUED) {
        await enqueueRun({ organizationId, userId, conversationId, runId: activeRun.id })
      }

      return { outcome: 'busy' }
    }
    if (conversation && (conversation.isFull || conversation.messageCount >= MAX_CONVERSATION_MESSAGES)) {
      return { outcome: 'full' }
    }
    if (!conversation && (data.keptConversations[0]?._count ?? 0) >= MAX_CONVERSATIONS) return { outcome: 'tooMany' }
    if (data.conversationRuns.length >= MAX_ACTIVE_RUNS_PER_MEMBER) return { outcome: 'busy' }

    const runId = randomUUID().replaceAll('-', '')
    const message = {
      organizationId,
      userId,
      conversationId,
      membershipCreatedAt: membership.createdAt,
      messageId,
      text: input.drawnText,
      preview: buildConversationPreview({ kind: 'MEMBER_TEXT', text: input.drawnText }),
      runId,
      content: serializeTranscriptContent([{ type: 'text', text: input.text }]),
    }

    try {
      if (conversation) {
        const [lastEntry] = data.conversationTranscriptEntries
        const answering = await readConversationOpenCalls(input, lastEntry, {
          skipsQuestions: true,
          follows: [{ type: 'text', text: input.text }],
        })
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
          })
        } else {
          await sendConversationMessageMutation(dataConnect, sent)
        }
      } else {
        await startConversation(dataConnect, { ...message, title: buildConversationTitle(input.drawnText) })
      }
    } catch (error) {
      if (round === MAX_ROUNDS) throw error

      continue
    }

    if (!(await enqueueRun({ organizationId, userId, conversationId, runId }))) return { outcome: 'unavailable' }

    return { outcome: 'sent', runId }
  }
}

export default sendConversationMessage
