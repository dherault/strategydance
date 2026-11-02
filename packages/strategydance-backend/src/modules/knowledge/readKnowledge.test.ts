import { afterAll, describe, expect, it, mock } from 'bun:test'

import {
  DIRECTORIES,
  DIRECTORY_BUSINESS_MODEL_DESCRIPTIONS,
  DIRECTORY_CATEGORY_DESCRIPTIONS,
  DIRECTORY_FIELDS,
  DIRECTORY_INACTIVE_REASON_DESCRIPTIONS,
  INACTIVE_DIRECTORIES,
  INACTIVE_DIRECTORY_FIELDS,
  MARKETING_TACTIC_CHANNEL_DESCRIPTIONS,
  MARKETING_TACTIC_EFFORT_DESCRIPTIONS,
  MARKETING_TACTIC_FIELDS,
  MARKETING_TACTIC_TIME_TO_RESULTS_DESCRIPTIONS,
  MARKETING_TACTICS,
  STRATEGIC_FRAMEWORK_FIELDS,
  STRATEGIC_FRAMEWORKS,
} from 'strategydance-knowledge'

import type { ModuleCaller } from '~types'

import { MAX_TOOL_RESULT_LENGTH } from '~domain/conversations/conversationToolResults'
import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const CALLER: ModuleCaller = {
  kind: 'agent',
  userId: 'member',
  organizationId: ORGANIZATION_ID,
  membershipCreatedAt: fake.addMember('member', ORGANIZATION_ID),
  scopes: ['knowledge:read', 'knowledge:write'],
  idempotencyScope: 'conversation:checked',
}

const kit = await createModuleTestKit('knowledge', CALLER)

type Item = { id: string } & Record<string, any>
type Page = { kind: string; items: Item[]; missing: string[] }

afterAll(() => kit.close())

// What the company keeps of an item, after the item's own fields
const STATE_FIELDS = ['use', 'documents', 'tasks', 'members']

// What an item the company never marked nor linked has of it
const NOTHING_KEPT = {
  use: null,
  documents: { items: [], total: 0 },
  tasks: { items: [], total: 0 },
  members: { items: [], total: 0 },
}

function read(kind: string, ids: string[]) {
  return kit.answer<Page>('read_knowledge', { kind, ids })
}

describe('read_knowledge', () => {
  it("answers every field of each kind, in the package's order, then what the company keeps of it", async () => {
    const directory = DIRECTORIES.find(({ categories }) => categories.length > 1)!
    const [framework] = (await read('STRATEGIC_FRAMEWORK', [STRATEGIC_FRAMEWORKS[0]!.id])).items
    const [tactic] = (await read('MARKETING_TACTIC', [MARKETING_TACTICS[0]!.id])).items
    const directories = (await read('DIRECTORY', [directory.id, INACTIVE_DIRECTORIES[0]!.id])).items

    expect(Object.keys(framework!)).toEqual([...STRATEGIC_FRAMEWORK_FIELDS, ...STATE_FIELDS])
    expect(framework).toEqual({ ...STRATEGIC_FRAMEWORKS[0]!, ...NOTHING_KEPT })
    expect(Object.keys(tactic!)).toEqual([...MARKETING_TACTIC_FIELDS, ...STATE_FIELDS])
    expect(Object.keys(directories[0]!)).toEqual([...DIRECTORY_FIELDS, ...STATE_FIELDS])
    expect(Object.keys(directories[1]!)).toEqual([...INACTIVE_DIRECTORY_FIELDS, ...STATE_FIELDS])
  })

  it('gives each value of an enum with its meaning, a directory keeping its type as it is', async () => {
    const tactic = MARKETING_TACTICS[0]!
    const directory = DIRECTORIES.find(({ categories }) => categories.length > 1)!
    const [readTactic] = (await read('MARKETING_TACTIC', [tactic.id])).items
    const [readDirectory] = (await read('DIRECTORY', [directory.id])).items

    expect(readTactic).toEqual({
      ...tactic,
      ...NOTHING_KEPT,
      channel: { value: tactic.channel, meaning: MARKETING_TACTIC_CHANNEL_DESCRIPTIONS[tactic.channel] },
      effort: { value: tactic.effort, meaning: MARKETING_TACTIC_EFFORT_DESCRIPTIONS[tactic.effort] },
      timeToResults: {
        value: tactic.timeToResults,
        meaning: MARKETING_TACTIC_TIME_TO_RESULTS_DESCRIPTIONS[tactic.timeToResults],
      },
    })
    expect(readDirectory).toEqual({
      ...directory,
      ...NOTHING_KEPT,
      categories: directory.categories.map(value => ({ value, meaning: DIRECTORY_CATEGORY_DESCRIPTIONS[value] })),
      businessModel: {
        value: directory.businessModel,
        meaning: DIRECTORY_BUSINESS_MODEL_DESCRIPTIONS[directory.businessModel],
      },
    })
    expect(readDirectory!.type).toBe(directory.type)
  })

  it('reads an inactive directory, with its reason', async () => {
    const directory = INACTIVE_DIRECTORIES[0]!
    const { items, missing } = await read('DIRECTORY', [directory.id])

    expect(missing).toEqual([])
    expect(items[0]!.inactiveReason).toEqual({
      value: directory.inactiveReason,
      meaning: DIRECTORY_INACTIVE_REASON_DESCRIPTIONS[directory.inactiveReason],
    })
  })

  it("names in `missing` the ids absent from the kind's catalogue, a framework's read as a tactic among them", async () => {
    const tactic = MARKETING_TACTICS[1]!.id
    const framework = STRATEGIC_FRAMEWORKS[0]!.id
    const { items, missing } = await read('MARKETING_TACTIC', [framework, tactic, 'no-such-tactic'])

    expect(items.map(({ id }) => id)).toEqual([tactic])
    expect(missing).toEqual([framework, 'no-such-tactic'])
  })

  it('refuses eleven ids, and answers an id given twice once, in the order given', async () => {
    const ids = MARKETING_TACTICS.slice(0, 11).map(({ id }) => id)
    const [first, second] = ids

    expect(await kit.refusal('read_knowledge', { kind: 'MARKETING_TACTIC', ids })).toContain('Input validation error')
    expect(await kit.refusal('read_knowledge', { kind: 'MARKETING_TACTIC', ids: ['Not An Id'] })).toContain(
      'Input validation error',
    )
    expect((await read('MARKETING_TACTIC', [second!, first!, second!])).items.map(({ id }) => id)).toEqual([
      second,
      first,
    ])
  })

  it('reads the ten longest items of each kind within a tool result', async () => {
    const kinds = {
      STRATEGIC_FRAMEWORK: STRATEGIC_FRAMEWORKS,
      MARKETING_TACTIC: MARKETING_TACTICS,
      DIRECTORY: [...DIRECTORIES, ...INACTIVE_DIRECTORIES],
    }

    for (const [kind, list] of Object.entries(kinds)) {
      const lengths = new Map<string, number>()

      for (let start = 0; start < list.length; start += 10) {
        const { items } = await read(
          kind,
          list.slice(start, start + 10).map(({ id }) => id),
        )

        for (const item of items) lengths.set(item.id, JSON.stringify(item).length)
      }

      const longest = [...lengths].toSorted(([, a], [, b]) => b - a).slice(0, 10)
      const result = await kit.call('read_knowledge', { kind, ids: longest.map(([id]) => id) })
      const [content] = result.content as { text: string }[]

      expect(lengths.size).toBe(list.length)
      expect(content!.text.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_LENGTH)
    }
  })
})
