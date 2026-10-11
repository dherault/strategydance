import type { BetaMessage, MessageCountTokensParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { getConversationRunStop, renewConversationRunLease } from 'strategydance-database/backend'

import type { ClaudeClient, ConversationContentBlock, ConversationRunFence } from '~types'

import { CONVERSATION_TAGGING_TIMEOUT_MS } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import buildConversationTaggingRequest from '~domain/agent/buildConversationTaggingRequest'
import readConversationTagging from '~domain/agent/readConversationTagging'
import {
  type ConversationRunUsage,
  reserveConversationRequest,
  settleConversationRequest,
  settleFailedConversationRequest,
  settleInterruptedConversationRequest,
} from '~domain/conversations/conversationRunUsage'
import createConversationRequestSignal from '~domain/conversations/createConversationRequestSignal'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'
import type { ConversationTurnOutcome } from '~domain/conversations/requestConversationTurn'

type RequestConversationTaggingInput = {
  fence: ConversationRunFence
  lease: ConversationRunLease
  signal: AbortSignal
  client: ClaudeClient
  usage: ConversationRunUsage
  // The reply the first exchange's run gave, its parts in order
  reply: ConversationContentBlock[]
  // When the run's request cuts a stream, as its own time limit has it
  streamDeadline: number
  stopCheckIntervalMs: number
}

/*
  Asks Claude which aspects of the company a conversation's first exchange is about, once the run
  answering its first message has drawn its whole reply: the member's message, the transcript's
  first entry, and the reply, which `buildConversationTaggingRequest` quotes. The request goes
  through the run's ledger as its turns' do, marked `tagging`, so it counts toward the run's 25
  requests and the run tries it once: reserved at its counted input in the write that renews the
  lease, then streamed, and settled from its answer, or as one that failed.

  It is never what fails a run: an error of Claude's API, a refusal, an answer cut at its length or
  not the schema's, a stream past a minute or cut by its member's stop leave the conversation
  untagged, and the run ends as its reply does. Only the run's own signal, a lease lost, throws, as
  a reservation that renewed nothing does. The outcome holds the aspects, or null, with the ledger,
  for the next step to write
*/
async function requestConversationTagging({
  fence,
  lease,
  signal,
  client,
  usage: initialUsage,
  reply,
  streamDeadline,
  stopCheckIntervalMs,
}: RequestConversationTaggingInput): Promise<ConversationTurnOutcome> {
  const { organizationId, userId, conversationId } = fence
  const entries = await readConversationTranscript({ organizationId, userId, conversationId })
  const first = entries.find(({ position }) => position === 0)
  const body = buildConversationTaggingRequest({
    member: first ? parseTranscriptContent(first.content) : [],
    reply,
  })
  const reserved = reserveConversationRequest(initialUsage, {
    estimatedInputTokens: await countInput(client, body),
    configTokens: 0,
    inputEndPosition: entries.at(-1)?.position ?? 0,
    purpose: 'tagging',
  })
  const { data: reservation } = await lease.write(() =>
    renewConversationRunLease(dataConnect, { ...fence, usage: reserved.usage }),
  )

  if (reservation.conversationRun_updateMany !== 1) {
    throw new Error(
      `Conversation run ${fence.runId}: its tagging's reservation renewed nothing, the run is not this worker's`,
    )
  }

  // The message so far, once the stream has reported its usage
  const streamed: { message: BetaMessage | null } = { message: null }
  const request = createConversationRequestSignal({
    signal,
    deadline: Math.min(streamDeadline, Date.now() + CONVERSATION_TAGGING_TIMEOUT_MS),
    isStopRequested: async () => {
      const { data } = await getConversationRunStop(dataConnect, {
        organizationId,
        userId,
        conversationId,
        runId: fence.runId,
      })

      return Boolean(data.conversationRuns[0]?.stopRequestedAt)
    },
    stopCheckIntervalMs,
  })

  try {
    const message = await client.stream(body, {
      signal: request.signal,
      onProgress: () => {},
      onUsage: snapshot => {
        streamed.message = snapshot
      },
    })
    const aspects = readConversationTagging(message)

    if (aspects) {
      logger.info(`Conversation run ${fence.runId}: tagged its conversation ${aspects.join(', ')}`)
    } else {
      logger.warn(`Conversation run ${fence.runId}: its tagging answered no aspect, ended on ${message.stop_reason}`)
    }

    return {
      kind: 'tagging',
      aspects,
      usage: settleConversationRequest(reserved.usage, reserved.index, message, { turnPosition: null }),
    }
  } catch (error) {
    if (signal.aborted) throw error

    logger.warn(
      `Conversation run ${fence.runId}: its tagging failed, ${request.readReason() ?? 'its request failed'}`,
      error,
    )

    return {
      kind: 'tagging',
      aspects: null,
      usage: streamed.message
        ? settleInterruptedConversationRequest(reserved.usage, reserved.index, streamed.message)
        : settleFailedConversationRequest(reserved.usage, reserved.index),
    }
  } finally {
    request.dispose()
  }
}

// The request's input as counted, or its JSON length over three when it cannot be: the figure only
// charges a request a crash left unsettled
async function countInput(client: ClaudeClient, body: ReturnType<typeof buildConversationTaggingRequest>) {
  const counted: MessageCountTokensParams = { model: body.model, system: body.system, messages: body.messages }

  try {
    return await client.countTokens(counted)
  } catch (error) {
    logger.warn('Could not count a tagging request, estimated from its length instead', error)

    return Math.ceil(JSON.stringify(counted).length / 3)
  }
}

export default requestConversationTagging
