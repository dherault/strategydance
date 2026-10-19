import { MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER } from 'strategydance-core'
import { ConversationNoteKind, ConversationRunStatus } from 'strategydance-database/backend'

import endConversationRun from '~domain/conversations/endConversationRun'
import launchSubagent from '~domain/subagents/launchSubagent'
import stopConversationSubagents from '~domain/subagents/stopConversationSubagents'

import {
  type Fence,
  type Member,
  asMember,
  claim,
  createMember,
  isSameId,
  readConversation,
  readMessages,
  readRuns,
  readSlots,
  readSubagents,
  readTranscript,
  startConversationOf,
} from './raceFixtures'
import { type RaceScenario, countPassed, describe, race } from './raceHarness'

const SLOTS = MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER

function launch(member: Member, parentId: string, key: string) {
  return launchSubagent({
    organizationId: member.organizationId,
    userId: member.userId,
    parentId,
    key,
    title: `Raced ${key}`,
    brief: 'Compare the pricing pages',
    attachmentIds: [],
  })
}

type Launched = { subagentId: string; runId: string; isPending: boolean }

async function launchAll(member: Member, parentId: string, keys: string[]) {
  const launched: Launched[] = []

  for (const key of keys) {
    const result = await launch(member, parentId, key)

    if (result.outcome !== 'launched') throw new Error(`The launch ${key} was answered ${result.outcome}`)

    launched.push(result)
  }

  return launched
}

// Ends a subagent's run its worker claimed as completed, as the worker ends one, promotion and
// reaction included
async function finish(fence: Fence, parentId: string) {
  const subagent = await readConversation(fence.conversationId)

  return endConversationRun({
    ending: { kind: 'finished', status: ConversationRunStatus.COMPLETED },
    fence,
    lease: null,
    position: subagent?.nextMessagePosition ?? 0,
    isSubagent: true,
    parentId,
  })
}

const isLive = (status: string) => ['QUEUED', 'RUNNING', 'PENDING'].includes(status)

// One launch more than the member's slots
const launchesPastSlots: RaceScenario = {
  name: 'launches-past-slots',
  description: `${SLOTS + 1} launches at once queue ${SLOTS} subagents and leave one waiting for a slot`,
  async run({ round, jitter, expect }) {
    const member = await createMember('launches-past-slots', round)
    const { conversationId: parentId } = await startConversationOf(member)
    const results = await race(
      Object.fromEntries(
        Array.from({ length: SLOTS + 1 }, (_, index) => [
          `w${index + 1}`,
          () => launch(member, parentId, `race-${index}`),
        ]),
      ),
      jitter,
    )
    const launched = Object.values(results).flatMap(result =>
      result.status === 'fulfilled' && result.value.outcome === 'launched' ? [result.value] : [],
    )
    const slots = await readSlots(member)
    const parent = await readConversation(parentId)

    expect(
      `every launch goes through, one waiting for a slot`,
      launched.length === SLOTS + 1 && launched.filter(({ isPending }) => isPending).length === 1,
      Object.entries(results)
        .map(([writer, result]) => `${writer} ${describe(result)}`)
        .join(', '),
    )
    expect(
      `${SLOTS} runs hold a slot and one waits, the one answered waiting`,
      slots.activeRuns.length === SLOTS
        && slots.pendingRuns.length === 1
        && isSameId(slots.pendingRuns[0]?.id, launched.find(({ isPending }) => isPending)?.runId),
      `${slots.activeRuns.length} hold a slot, ${slots.pendingRuns.length} wait`,
    )
    expect('the parent counts every subagent', parent?.subagentCount === SLOTS + 1, `${parent?.subagentCount}`)
  },
}

/*
  Two runs holding slots ending at once while some wait for one: each run waiting is promoted into a
  slot freed, once, and no more runs hold slots than there are
*/
function endsPromoting(waiting: number): RaceScenario {
  const name = `ends-promoting-${waiting}`

  return {
    name,
    description: `two subagents ending at once with ${waiting} waiting promote ${waiting === 1 ? 'it' : 'each'} once`,
    async run({ round, jitter, expect }) {
      const member = await createMember(name, round)
      const { conversationId: parentId } = await startConversationOf(member)
      const launched = await launchAll(
        member,
        parentId,
        Array.from({ length: SLOTS + waiting }, (_, index) => `race-${index}`),
      )
      const [first, second] = launched.filter(({ isPending }) => !isPending)
      const pending = launched.filter(({ isPending }) => isPending)

      if (!first || !second || pending.length !== waiting) throw new Error('The launches did not fill the slots')

      const fences = [
        await claim(member, first.subagentId, first.runId),
        await claim(member, second.subagentId, second.runId),
      ]
      const results = await race(
        { w1: () => finish(fences[0]!, parentId), w2: () => finish(fences[1]!, parentId) },
        jitter,
      )
      const slots = await readSlots(member)
      const promoted = await Promise.all(
        pending.map(async ({ subagentId }) => (await readRuns(subagentId)).find(({ number }) => number === 0)),
      )

      expect(
        'both runs end',
        Object.values(results).every(result => result.status === 'fulfilled'),
        Object.entries(results)
          .map(([writer, result]) => `${writer} ${describe(result)}`)
          .join(', '),
      )
      expect(
        `the ${waiting === 1 ? 'run waiting is' : 'runs waiting are'} queued into a slot`,
        promoted.every(run => run?.status === 'QUEUED' && run.attempts === 0),
        promoted.map(run => run?.status).join(', '),
      )
      expect(
        `${SLOTS - 2 + waiting} runs hold a slot and none waits`,
        slots.activeRuns.length === SLOTS - 2 + waiting && slots.pendingRuns.length === 0,
        `${slots.activeRuns.length} hold a slot, ${slots.pendingRuns.length} wait`,
      )
      expect(
        `${waiting} PromoteSubagentRun go through`,
        countPassed('PromoteSubagentRun') === waiting,
        `${countPassed('PromoteSubagentRun')}`,
      )
    },
  }
}

// A run's end, which frees a slot and promotes into it, beside a launch that reads the slots
const endBesideLaunch: RaceScenario = {
  name: 'end-beside-launch',
  description: `a subagent ending beside a launch, with one waiting, keeps ${SLOTS} runs in slots`,
  async run({ round, jitter, expect }) {
    const member = await createMember('end-beside-launch', round)
    const { conversationId: parentId } = await startConversationOf(member)
    const launched = await launchAll(
      member,
      parentId,
      Array.from({ length: SLOTS + 1 }, (_, index) => `race-${index}`),
    )
    const [first] = launched.filter(({ isPending }) => !isPending)

    if (!first) throw new Error('The launches did not fill the slots')

    const fence = await claim(member, first.subagentId, first.runId)
    const results = await race<unknown>(
      { end: () => finish(fence, parentId), launch: () => launch(member, parentId, 'raced') },
      jitter,
    )
    const slots = await readSlots(member)

    expect(
      'the run ends and the launch goes through',
      results.end?.status === 'fulfilled'
        && results.launch?.status === 'fulfilled'
        && (results.launch.value as { outcome: string }).outcome === 'launched',
      Object.entries(results)
        .map(([writer, result]) => `${writer} ${describe(result)}`)
        .join(', '),
    )
    expect(
      `${SLOTS} runs hold a slot and one waits`,
      slots.activeRuns.length === SLOTS && slots.pendingRuns.length === 1,
      `${slots.activeRuns.length} hold a slot, ${slots.pendingRuns.length} wait`,
    )
  },
}

// Two subagents of one batch reporting at once, the parent idle
const reportsOfOneBatch: RaceScenario = {
  name: 'reports-of-one-batch',
  description: 'two subagents of one batch ending at once start one reaction, delivering each report once',
  async run({ round, jitter, expect }) {
    const member = await createMember('reports-of-one-batch', round)
    const { conversationId: parentId } = await startConversationOf(member)
    const [first, second] = await launchAll(member, parentId, ['race-a', 'race-b'])

    if (!first || !second) throw new Error('The launches did not go through')

    const fences = [
      await claim(member, first.subagentId, first.runId),
      await claim(member, second.subagentId, second.runId),
    ]

    await race({ w1: () => finish(fences[0]!, parentId), w2: () => finish(fences[1]!, parentId) }, jitter)

    const parent = await readConversation(parentId)
    const runs = await readRuns(parentId)
    const subagents = await readSubagents(parentId)
    const reported = (await readTranscript(parentId))
      .filter(({ role, position }) => role === 'USER' && position > 0)
      .flatMap(({ content }) =>
        (JSON.parse(content) as { type: string; text?: string }[]).flatMap(block => {
          try {
            const id = (JSON.parse(block.text ?? '') as { subagentReport?: { id?: string } }).subagentReport?.id

            return id ? [id] : []
          } catch {
            return []
          }
        }),
      )

    expect(
      'the parent has one more run, reacting, which it is busy with',
      runs.length === 2 && runs[1]?.trigger === 'REPORTS' && isSameId(parent?.activeRunId, runs[1]?.id),
      runs.map(({ trigger, status }) => `${trigger} ${status}`).join(', '),
    )
    expect(
      'both reports are delivered',
      subagents.length === 2 && subagents.every(({ reportDeliveredAt }) => reportDeliveredAt !== null),
    )
    expect(
      'the reaction carries each report once',
      reported.length === 2 && [first, second].every(({ subagentId }) => reported.some(id => isSameId(id, subagentId))),
      reported.join(', '),
    )
    expect('one StartSubagentReaction goes through', countPassed('StartSubagentReaction') === 1)
  },
}

// A subagent's run reaching one of its limits, which chains, beside its member's Stop
const stopBesideChain: RaceScenario = {
  name: 'stop-beside-chain',
  description: 'a stop beside a subagent’s chain at its limits ends it stopped',
  async run({ round, jitter, expect }) {
    const member = await createMember('stop-beside-chain', round)
    const { conversationId: parentId } = await startConversationOf(member)
    const [launched] = await launchAll(member, parentId, ['race'])

    if (!launched) throw new Error('The launch did not go through')

    const fence = await claim(member, launched.subagentId, launched.runId)

    const readStep = async () => ({
      run: (await readRuns(launched.subagentId))[0],
      subagent: await readConversation(launched.subagentId),
    })
    // The worker's first step read before the writers are released, so its write meets the stop's,
    // then, as the worker's steps do, each read afresh: ended or chained, the run is left alone
    const firstStep = await readStep()
    const chain = async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { run, subagent } = attempt === 0 ? firstStep : await readStep()

        if (run?.status !== 'RUNNING' || run.attempts !== 1) return run?.status

        try {
          return await endConversationRun({
            ending: {
              kind: 'noted',
              status: ConversationRunStatus.FAILED,
              noteKind: ConversationNoteKind.FAILED,
              failure: 'The run sent its 25 requests',
              isAtLimit: true,
            },
            fence,
            lease: null,
            position: subagent?.nextMessagePosition ?? 0,
            isSubagent: true,
            parentId,
            chain: { runNumber: run.number, anchorPosition: run.anchorPosition, pendingToolResults: null },
          })
        } catch {
          continue
        }
      }

      return 'gave up'
    }
    const stop = () =>
      stopConversationSubagents(
        { organizationId: member.organizationId, userId: member.userId, conversationId: parentId },
        { subagentIds: [launched.subagentId] },
      )
    const results = await race<unknown>({ chain, stop }, jitter)
    const subagent = await readConversation(launched.subagentId)
    const runs = await readRuns(launched.subagentId)
    const statuses = runs.map(({ status }) => status).join(',')
    const stoppedNotes = (await readMessages(launched.subagentId)).filter(
      ({ kind, noteKind }) => kind === 'NOTE' && noteKind === 'STOPPED',
    )

    expect(
      'the stop goes through',
      results.stop?.status === 'fulfilled' && JSON.stringify(results.stop.value) === '{"outcome":"stopped"}',
      `chain ${describe(results.chain)}, stop ${describe(results.stop)}`,
    )
    expect(
      'the subagent ends stopped, chained first or not',
      ['STOPPED', 'CHAINED,STOPPED'].includes(statuses),
      statuses,
    )
    expect(
      'nothing of it is left going, and it reported',
      subagent?.activeRunId === null && runs.every(({ status }) => !isLive(status)) && subagent.reportedAt !== null,
    )
    expect('one note says it stopped', stoppedNotes.length === 1, `${stoppedNotes.length} notes`)
    expect('it chains once at most', countPassed('ChainSubagentRun') <= 1)
  },
}

// A parent's delete beside a launch of its agent's, into a free slot or waiting for one
const deleteBesideLaunch: RaceScenario = {
  name: 'delete-beside-launch',
  description: 'a parent’s delete beside a launch leaves no live subagent under it',
  async run({ round, jitter, expect }) {
    const member = await createMember('delete-beside-launch', round)
    const { conversationId: parentId } = await startConversationOf(member)

    // Every other round, the slots are taken under another parent, so the launch waits for one
    if (round % 2 === 0) {
      const { conversationId: otherId } = await startConversationOf(member)

      await launchAll(
        member,
        otherId,
        Array.from({ length: SLOTS }, (_, index) => `other-${index}`),
      )
    }

    const results = await race<unknown>(
      {
        launch: () => launch(member, parentId, 'raced'),
        delete: () =>
          asMember(member).run('DeleteConversation', {
            organizationId: member.organizationId,
            userId: member.userId,
            id: parentId,
          }),
      },
      jitter,
    )
    const parent = await readConversation(parentId)
    const subagents = await readSubagents(parentId)
    const runs = (await Promise.all(subagents.map(({ id }) => readRuns(id)))).flat()
    const outcome =
      results.launch?.status === 'fulfilled' ? (results.launch.value as { outcome: string }).outcome : null

    expect(
      'the delete goes through and the launch is answered launched or missing',
      results.delete?.status === 'fulfilled' && (outcome === 'launched' || outcome === 'missing'),
      `launch ${describe(results.launch)}, delete ${describe(results.delete)}`,
    )
    expect(
      'every subagent is deleted with its parent',
      parent?.deletedAt !== null && subagents.every(({ deletedAt }) => deletedAt === parent?.deletedAt),
      subagents.map(({ deletedAt }) => deletedAt).join(', '),
    )
    expect(
      'every run of theirs left going is asked to stop',
      runs.every(run => !isLive(run.status) || run.stopRequestedAt !== null),
      runs.map(({ status, stopRequestedAt }) => `${status} ${stopRequestedAt ? 'asked' : 'not asked'}`).join(', '),
    )
    expect(
      'the parent counts the subagents it has',
      parent?.subagentCount === subagents.length && subagents.length === (outcome === 'launched' ? 1 : 0),
      `${parent?.subagentCount} counted, ${subagents.length} found`,
    )
  },
}

const subagentScenarios = [
  launchesPastSlots,
  endsPromoting(1),
  endsPromoting(2),
  endBesideLaunch,
  reportsOfOneBatch,
  stopBesideChain,
  deleteBesideLaunch,
]

export default subagentScenarios
