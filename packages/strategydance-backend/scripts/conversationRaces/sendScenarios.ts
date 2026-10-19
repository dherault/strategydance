import { MAX_ACTIVE_RUNS_PER_MEMBER } from 'strategydance-core'

import sendConversationMessage from '~domain/conversations/sendConversationMessage'

import {
  type Member,
  createId,
  createMember,
  isSameId,
  readConversation,
  readConversationsOf,
  readMessages,
  readRuns,
  readRunsInFlight,
  startConversationOf,
} from './raceFixtures'
import { type RaceScenario, countPassed, describe, race } from './raceHarness'

type SendResult = Awaited<ReturnType<typeof sendConversationMessage>>

function send(member: Member, conversationId: string) {
  return sendConversationMessage({
    organizationId: member.organizationId,
    userId: member.userId,
    conversationId,
    messageId: createId(),
    text: 'At once',
    drawnText: 'At once',
  })
}

function readOutcomes(results: Record<string, PromiseSettledResult<SendResult>>) {
  const settled = Object.values(results)

  return {
    sentRunIds: settled.flatMap(result =>
      result.status === 'fulfilled' && result.value.outcome === 'sent' ? [result.value.runId] : [],
    ),
    busyCount: settled.filter(result => result.status === 'fulfilled' && result.value.outcome === 'busy').length,
    described: Object.entries(results)
      .map(([writer, result]) => `${writer} ${describe(result)}`)
      .join(', '),
  }
}

// Two first messages of one conversation, which neither saw exist
const firstSends: RaceScenario = {
  name: 'first-sends',
  description: 'two first sends to one conversation start it once, with one run',
  async run({ round, jitter, expect }) {
    const member = await createMember('first-sends', round)
    const conversationId = createId()
    const results = await race(
      { w1: () => send(member, conversationId), w2: () => send(member, conversationId) },
      jitter,
    )
    const { sentRunIds, busyCount, described } = readOutcomes(results)
    const conversation = await readConversation(conversationId)
    const runs = await readRuns(conversationId)
    const sentMessages = (await readMessages(conversationId)).filter(({ kind }) => kind === 'MEMBER_TEXT')

    expect('one send is answered sent and the other busy', sentRunIds.length === 1 && busyCount === 1, described)
    expect(
      'the conversation holds one run, the one it is busy with',
      runs.length === 1 && isSameId(runs[0]?.id, sentRunIds[0]) && isSameId(conversation?.activeRunId, sentRunIds[0]),
      `${runs.length} runs, active ${conversation?.activeRunId}`,
    )
    expect('one message of the member’s is stored', sentMessages.length === 1, `${sentMessages.length} stored`)
    expect('one StartConversation goes through', countPassed('StartConversation') === 1)
  },
}

// Two messages to one idle conversation
const laterSends: RaceScenario = {
  name: 'later-sends',
  description: 'two sends to one idle conversation start one run',
  async run({ round, jitter, expect }) {
    const member = await createMember('later-sends', round)
    const { conversationId } = await startConversationOf(member)
    const results = await race(
      { w1: () => send(member, conversationId), w2: () => send(member, conversationId) },
      jitter,
    )
    const { sentRunIds, busyCount, described } = readOutcomes(results)
    const conversation = await readConversation(conversationId)
    const runs = await readRuns(conversationId)
    const sentMessages = (await readMessages(conversationId)).filter(({ kind }) => kind === 'MEMBER_TEXT')

    expect('one send is answered sent and the other busy', sentRunIds.length === 1 && busyCount === 1, described)
    expect(
      'the conversation holds its first run and one more, the one it is busy with',
      runs.length === 2
        && runs[1]?.number === 1
        && isSameId(runs[1]?.id, sentRunIds[0])
        && isSameId(conversation?.activeRunId, sentRunIds[0])
        && conversation?.nextRunNumber === 2,
      `${runs.length} runs, active ${conversation?.activeRunId}, next number ${conversation?.nextRunNumber}`,
    )
    expect('one more message of the member’s is stored', sentMessages.length === 2, `${sentMessages.length} stored`)
  },
}

const CONVERSATIONS = MAX_ACTIVE_RUNS_PER_MEMBER + 1

// One message more than the member's runs in flight, each to an idle conversation of their own
const sendsInFlight: RaceScenario = {
  name: 'sends-in-flight',
  description: `${CONVERSATIONS} sends to idle conversations start ${MAX_ACTIVE_RUNS_PER_MEMBER} runs, the member’s most in flight`,
  async run({ round, jitter, expect }) {
    const member = await createMember('sends-in-flight', round)
    // One after the other, since each start's run counts in flight until it completes
    const conversations: { conversationId: string }[] = []

    for (let index = 0; index < CONVERSATIONS; index++) conversations.push(await startConversationOf(member))

    const results = await race(
      Object.fromEntries(
        conversations.map(({ conversationId }, index) => [`w${index + 1}`, () => send(member, conversationId)]),
      ),
      jitter,
    )
    const { sentRunIds, busyCount, described } = readOutcomes(results)
    const inFlight = await readRunsInFlight(member)

    expect(
      `${MAX_ACTIVE_RUNS_PER_MEMBER} sends are answered sent and one busy`,
      sentRunIds.length === MAX_ACTIVE_RUNS_PER_MEMBER && busyCount === 1,
      described,
    )
    expect(
      `the member has ${MAX_ACTIVE_RUNS_PER_MEMBER} runs in flight, those sent`,
      inFlight.length === MAX_ACTIVE_RUNS_PER_MEMBER
        && inFlight.every(run => sentRunIds.some(id => isSameId(id, run.id))),
      `${inFlight.length} in flight`,
    )
  },
}

// One first message more than the member's runs in flight, each starting a conversation
const startsInFlight: RaceScenario = {
  name: 'starts-in-flight',
  description: `${CONVERSATIONS} first sends start ${MAX_ACTIVE_RUNS_PER_MEMBER} conversations, the member’s most runs in flight`,
  async run({ round, jitter, expect }) {
    const member = await createMember('starts-in-flight', round)
    const results = await race(
      Object.fromEntries(
        Array.from({ length: CONVERSATIONS }, (_, index) => [`w${index + 1}`, () => send(member, createId())]),
      ),
      jitter,
    )
    const { sentRunIds, busyCount, described } = readOutcomes(results)
    const conversations = await readConversationsOf(member)
    const inFlight = await readRunsInFlight(member)

    expect(
      `${MAX_ACTIVE_RUNS_PER_MEMBER} sends are answered sent and one busy`,
      sentRunIds.length === MAX_ACTIVE_RUNS_PER_MEMBER && busyCount === 1,
      described,
    )
    expect(
      `${MAX_ACTIVE_RUNS_PER_MEMBER} conversations are started, each with its run in flight`,
      conversations.length === MAX_ACTIVE_RUNS_PER_MEMBER && inFlight.length === MAX_ACTIVE_RUNS_PER_MEMBER,
      `${conversations.length} conversations, ${inFlight.length} in flight`,
    )
  },
}

const sendScenarios = [firstSends, laterSends, sendsInFlight, startsInFlight]

export default sendScenarios
