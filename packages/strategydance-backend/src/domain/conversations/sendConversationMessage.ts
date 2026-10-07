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
  sendConversationMessage as sendConversationMessageMutation,
  startConversation,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import enqueueRun from '~domain/conversations/enqueueRun'
import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'
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
    before anything is counted, its own conversation's or another's
  - then the conversation has to be the caller's and not deleted, idle, and not full, or, when it
    does not exist yet, the caller to keep fewer than 1000, and the caller to have fewer than 3 runs
    in flight. A conversation whose run still waits in the queue has that run queued again before
    the send is answered busy, so a run whose task was lost does not keep it busy

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

      if (isDead(sent.run)) await finalizeDeadConversationRun(reference)
      else if (sent.run.status === ConversationRunStatus.QUEUED && !(await enqueueRun(reference))) {
        return { outcome: 'unavailable' }
      }

      return { outcome: 'sent', runId: sent.run.id }
    }

    const deadRuns = data.conversationRuns.filter(isDead)

    if (deadRuns.length) {
      for (const run of deadRuns) {
        await finalizeDeadConversationRun({
          organizationId,
          userId,
          conversationId: run.conversation.id,
          runId: run.id,
        })
      }

      if (round < MAX_ROUNDS) continue
    }

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

        await sendConversationMessageMutation(dataConnect, {
          ...message,
          position: conversation.nextMessagePosition,
          runNumber: conversation.nextRunNumber,
          transcriptPosition: lastEntry ? lastEntry.position + 1 : 0,
        })
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

// Whether a run is in flight past its lease, which says its worker died with it
function isDead(run: { status: ConversationRunStatus; leaseExpiresAt?: string | null }) {
  return (
    (run.status === ConversationRunStatus.QUEUED || run.status === ConversationRunStatus.RUNNING)
    && Boolean(run.leaseExpiresAt)
    && Date.parse(run.leaseExpiresAt ?? '') < Date.now()
  )
}

export default sendConversationMessage
