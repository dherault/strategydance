import { MAX_CHECKLIST_ITEMS } from 'strategydance-core'

import { type Member, asMember, createId, createTeam, insertRows, read } from './raceFixtures'
import { type RaceScenario, describe, race } from './raceHarness'

async function readLiveItems(member: Member) {
  const data = await read<{ checklistItems: { id: string }[] }>(
    `query ReadLiveItems($organizationId: UUID!, $userId: String!) {
      checklistItems(
        where: { organizationId: { eq: $organizationId }, userId: { eq: $userId }, deletedAt: { isNull: true } }
        limit: 1000
      ) { id }
    }`,
    { organizationId: member.organizationId, userId: member.userId },
  )

  return data.checklistItems
}

function describeAll(results: Record<string, PromiseSettledResult<unknown>>) {
  return Object.entries(results)
    .map(([writer, result]) => `${writer} ${describe(result)}`)
    .join(', ')
}

function countPassedWriters(results: Record<string, PromiseSettledResult<unknown>>) {
  return Object.values(results).filter(({ status }) => status === 'fulfilled').length
}

// The Today page opened in two tabs at once, each starting a checklist nobody had
const firstVisits: RaceScenario = {
  name: 'first-visits',
  description: 'two first visits to the Today page start the checklist once, with its four habits',
  async run({ round, jitter, expect }) {
    const {
      members: [member],
    } = await createTeam('first-visits', round, ['MEMBER'])
    const start = () =>
      asMember(member!).run('CreateDefaultChecklistItems', {
        organizationId: member!.organizationId,
        firstName: 'Reflection',
        secondName: 'Talk to users',
        thirdName: 'Distribution',
        fourthName: 'Building',
      })
    const results = await race<unknown>({ 'one tab starts': start, 'another tab starts': start }, jitter)
    const items = await readLiveItems(member!)

    expect('one of the two goes through', countPassedWriters(results) === 1, describeAll(results))
    expect('the checklist holds four habits', items.length === 4, `${items.length} habits`)
  },
}

// Two columns added at once to a checklist one short of the columns it keeps
const columnsPastTheCap: RaceScenario = {
  name: 'columns-past-the-cap',
  description: `two columns added to a checklist of ${MAX_CHECKLIST_ITEMS - 1} leave ${MAX_CHECKLIST_ITEMS}, the most it keeps`,
  async run({ round, jitter, expect }) {
    const {
      members: [member],
    } = await createTeam('columns-past-the-cap', round, ['MEMBER'])

    await insertRows(
      'ChecklistItem',
      Array.from({ length: MAX_CHECKLIST_ITEMS - 1 }, (_, index) => ({
        userId: member!.userId,
        organizationId: member!.organizationId,
        name: `Raced column ${index + 1}`,
        position: index + 1,
      })),
    )

    const add = () =>
      asMember(member!).run('CreateChecklistItem', {
        organizationId: member!.organizationId,
        id: createId(),
        name: 'Raced column',
        position: MAX_CHECKLIST_ITEMS,
      })
    const results = await race<unknown>({ 'one tab adds': add, 'another tab adds': add }, jitter)
    const items = await readLiveItems(member!)

    expect('one of the two goes through', countPassedWriters(results) === 1, describeAll(results))
    expect(
      `the checklist keeps ${MAX_CHECKLIST_ITEMS} columns`,
      items.length === MAX_CHECKLIST_ITEMS,
      `${items.length} kept`,
    )
  },
}

const checklistScenarios = [firstVisits, columnsPastTheCap]

export default checklistScenarios
