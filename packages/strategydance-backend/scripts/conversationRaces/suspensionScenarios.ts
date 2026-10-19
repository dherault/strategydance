import type { ClaudeClient } from '~types'

import runConversation from '~domain/conversations/runConversation'
import sendConversationMessage from '~domain/conversations/sendConversationMessage'
import suspendConversations from '~domain/conversations/suspendConversations'

import {
  createId,
  createMember,
  isSameId,
  readConversation,
  readRuns,
  readTranscript,
  startConversationOf,
} from './raceFixtures'
import { type RaceScenario, describe, race } from './raceHarness'

// A Claude that answers nothing and counts what it was asked, which a suspended member's run never asks
function createRecordingClient() {
  const requests: string[] = []
  const client: ClaudeClient = {
    stream: () => {
      requests.push('stream')

      return Promise.reject(new Error('A suspended member’s run asked Claude'))
    },
    countTokens: () => {
      requests.push('countTokens')

      return Promise.resolve(0)
    },
  }

  return { client, requests }
}

/*
  A member's send beside a suspension of their conversations, their organization's or their
  account's, then the run's delivery: a send never reads the suspension, so one that commits second
  stores a run, which its claim refuses, and one that commits first is a run in flight the
  suspension asks to stop. Either way it asks Claude nothing
*/
const suspensionBesideSend: RaceScenario = {
  name: 'suspension-beside-send',
  description: 'a suspension beside a send leaves its run asking Claude nothing',
  async run({ round, jitter, expect }) {
    const member = await createMember('suspension-beside-send', round)
    // Every other round the message starts the conversation, and the account is suspended rather
    // than the organization every fourth
    const conversationId = round % 2 ? (await startConversationOf(member)).conversationId : createId()
    const named = round % 4 < 2 ? member.organizationId : `${member.userId}@example.com`
    const results = await race<unknown>(
      {
        send: () =>
          sendConversationMessage({
            organizationId: member.organizationId,
            userId: member.userId,
            conversationId,
            messageId: createId(),
            text: 'At once',
            drawnText: 'At once',
          }),
        suspend: () => suspendConversations(named),
      },
      jitter,
    )
    const sent =
      results.send?.status === 'fulfilled' ? (results.send.value as { outcome: string; runId?: string }) : null
    const suspended =
      results.suspend?.status === 'fulfilled' ? (results.suspend.value as { outcome: string; runCount?: number }) : null

    expect(
      'the send is stored and the suspension recorded',
      sent?.outcome === 'sent' && suspended?.outcome === 'suspended',
      `send ${describe(results.send)}, suspend ${describe(results.suspend)}`,
    )

    if (!sent?.runId) return

    const askedBeforeDelivery = (await readRuns(conversationId)).find(({ id }) =>
      isSameId(id, sent.runId),
    )?.stopRequestedAt
    const { client, requests } = createRecordingClient()
    const answered = await runConversation(
      { organizationId: member.organizationId, userId: member.userId, conversationId, runId: sent.runId },
      {
        client,
        connectModules: async () => ({ tools: [], runners: [], close: async () => {} }),
        createIntegrationRunners: () => [],
        retryDelayMs: 10,
      },
    )
    const run = (await readRuns(conversationId)).find(({ id }) => isSameId(id, sent.runId))
    const conversation = await readConversation(conversationId)
    const replies = (await readTranscript(conversationId)).filter(({ role }) => role === 'ASSISTANT')

    expect('the delivery finishes the run', answered === 'finished', answered)
    expect('the run asks Claude nothing', requests.length === 0, requests.join(', '))
    expect(
      'the run is interrupted before its claim, or stopped',
      (run?.status === 'INTERRUPTED' && run.attempts === 0 && run.startedAt === null) || run?.status === 'STOPPED',
      `${run?.status}, attempt ${run?.attempts}`,
    )
    expect(
      'the suspension counts the run exactly when it asked it to stop',
      (suspended?.runCount === 1) === Boolean(askedBeforeDelivery),
      `${suspended?.runCount} counted, ${askedBeforeDelivery ? 'asked' : 'not asked'}`,
    )
    expect(
      'nothing is stored of Claude’s, and the conversation is let go',
      replies.length === 0 && conversation?.activeRunId === null,
    )
  },
}

const suspensionScenarios = [suspensionBesideSend]

export default suspensionScenarios
