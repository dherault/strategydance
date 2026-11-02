import { afterEach, describe, expect, it, mock } from 'bun:test'

import { INACTIVE_DIRECTORIES, MARKETING_TACTICS, STRATEGIC_FRAMEWORKS } from 'strategydance-knowledge'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeTestOrganization } = await import('./testing/createKnowledgeTestOrganization')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const organization = createKnowledgeTestOrganization(fake, ORGANIZATION_ID)

const TACTIC = MARKETING_TACTICS[0]!.id

type Marked = { kind: string; id: string; use: { inUse: boolean; changedAt: string } | null }

afterEach(() => fake.reset())

function writes() {
  return fake.calls.filter(call => call === 'SetKnowledgeInUseForAgent')
}

describe('set_knowledge_in_use', () => {
  it('marks an item in use, then no longer, keeping its row with when it changed', async () => {
    const kit = await organization.connect()
    const marked = await kit.answer<Marked>('set_knowledge_in_use', {
      kind: 'MARKETING_TACTIC',
      id: TACTIC,
      inUse: true,
    })

    expect(marked).toMatchObject({ kind: 'MARKETING_TACTIC', id: TACTIC, use: { inUse: true } })
    expect(fake.knowledgeUses).toMatchObject([{ itemId: TACTIC, isInUse: true, changedById: 'member' }])

    const { changedAt } = fake.knowledgeUses[0]!
    const cleared = await kit.answer<Marked>('set_knowledge_in_use', {
      kind: 'MARKETING_TACTIC',
      id: TACTIC,
      inUse: false,
    })

    expect(cleared.use!.inUse).toBe(false)
    expect(fake.knowledgeUses).toHaveLength(1)
    expect(fake.knowledgeUses[0]!.isInUse).toBe(false)
    expect(fake.knowledgeUses[0]!.changedAt > changedAt).toBe(true)

    const { items } = await kit.answer<{ items: Marked[] }>('read_knowledge', {
      kind: 'MARKETING_TACTIC',
      ids: [TACTIC],
    })

    expect(items[0]!.use).toEqual({ inUse: false, changedAt: fake.knowledgeUses[0]!.changedAt })
  })

  it('writes nothing when the item holds the flag already, keeping the day it last changed', async () => {
    const kit = await organization.connect()
    const use = fake.insertUse({ organizationId: ORGANIZATION_ID, kind: 'MARKETING_TACTIC', itemId: TACTIC })
    const again = await kit.answer<Marked>('set_knowledge_in_use', {
      kind: 'MARKETING_TACTIC',
      id: TACTIC,
      inUse: true,
    })

    expect(again.use).toEqual({ inUse: true, changedAt: use.changedAt })
    expect(fake.knowledgeUses[0]!.changedAt).toBe(use.changedAt)
    expect(writes()).toEqual([])
  })

  it('writes nothing when an item never marked is cleared, so it is not told as one the company stopped', async () => {
    const kit = await organization.connect()
    const cleared = await kit.answer<Marked>('set_knowledge_in_use', {
      kind: 'MARKETING_TACTIC',
      id: TACTIC,
      inUse: false,
    })

    expect(cleared.use).toBeNull()
    expect(fake.knowledgeUses).toEqual([])
    expect(writes()).toEqual([])
  })

  it("refuses an id the kind's catalogue does not hold, a framework's among them, writing nothing", async () => {
    const kit = await organization.connect()

    fake.calls.length = 0

    expect(
      await kit.refusal('set_knowledge_in_use', { kind: 'MARKETING_TACTIC', id: 'no-such-tactic', inUse: true }),
    ).toBe(
      `Strategy Dance's knowledge holds no MARKETING_TACTIC with the id "no-such-tactic". List the kind to find the item's id.`,
    )
    expect(
      await kit.refusal('set_knowledge_in_use', {
        kind: 'MARKETING_TACTIC',
        id: STRATEGIC_FRAMEWORKS[0]!.id,
        inUse: true,
      }),
    ).toContain('holds no MARKETING_TACTIC')
    expect(fake.calls).toEqual([])
    expect(fake.knowledgeUses).toEqual([])
  })

  it('marks a directory that takes no submission today, which the company may have submitted to before', async () => {
    const kit = await organization.connect()
    const directory = INACTIVE_DIRECTORIES[0]!.id

    await kit.answer('set_knowledge_in_use', { kind: 'DIRECTORY', id: directory, inUse: true })

    expect(fake.knowledgeUses).toMatchObject([{ kind: 'DIRECTORY', itemId: directory, isInUse: true }])
  })
})
