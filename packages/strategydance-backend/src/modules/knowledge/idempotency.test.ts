import { afterEach, describe, expect, it, mock } from 'bun:test'

import { MARKETING_TACTICS } from 'strategydance-knowledge'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeTestOrganization } = await import('./testing/createKnowledgeTestOrganization')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const organization = createKnowledgeTestOrganization(fake, ORGANIZATION_ID)

const CONFLICT = 'That idempotency key was sent before with another call. Send a new key with each new call.'

const [TACTIC, OTHER_TACTIC] = MARKETING_TACTICS.map(({ id }) => id)

afterEach(() => fake.reset())

describe('idempotency keys', () => {
  it('marks once under one key, the second call answered with the first result', async () => {
    const kit = await organization.connect()
    const args = { kind: 'MARKETING_TACTIC', id: TACTIC, inUse: true }
    const first = await kit.answer('set_knowledge_in_use', args, 'key-1')

    // Cleared meanwhile, so a call that ran again would mark it anew
    fake.knowledgeUses[0]!.isInUse = false

    const second = await kit.answer(
      'set_knowledge_in_use',
      { inUse: true, id: TACTIC, kind: 'MARKETING_TACTIC' },
      'key-1',
    )

    expect(second).toEqual(first)
    expect(fake.calls.filter(call => call === 'SetKnowledgeInUseForAgent')).toHaveLength(1)
    expect(fake.knowledgeUses[0]!.isInUse).toBe(false)
  })

  it('refuses a key sent again with other arguments, from a call that wrote', async () => {
    const kit = await organization.connect()

    await kit.answer('set_knowledge_in_use', { kind: 'MARKETING_TACTIC', id: TACTIC, inUse: true }, 'key-1')

    expect(
      await kit.refusal('set_knowledge_in_use', { kind: 'MARKETING_TACTIC', id: OTHER_TACTIC, inUse: true }, 'key-1'),
    ).toBe(CONFLICT)
    expect(fake.knowledgeUses.map(use => use.itemId)).toEqual([TACTIC])
  })

  it('refuses a key sent again to another tool with the same arguments, a link then an unlink', async () => {
    const kit = await organization.connect()
    const task = organization.addTask()
    const args = { kind: 'MARKETING_TACTIC', id: TACTIC, taskId: task.id }

    await kit.answer('link_knowledge', args, 'key-2')

    expect(await kit.refusal('unlink_knowledge', args, 'key-2')).toBe(CONFLICT)
    expect(fake.knowledgeLinks).toHaveLength(1)
  })

  it('answers a link and an unlink sent again under their keys as they were, writing once each', async () => {
    const kit = await organization.connect()
    const task = organization.addTask()
    const args = { kind: 'MARKETING_TACTIC', id: TACTIC, taskId: task.id }
    const linked = await kit.answer('link_knowledge', args, 'key-1')
    const unlinked = await kit.answer('unlink_knowledge', args, 'key-2')

    expect(await kit.answer('link_knowledge', args, 'key-1')).toEqual(linked)
    expect(await kit.answer('unlink_knowledge', args, 'key-2')).toEqual(unlinked)
    expect(fake.knowledgeLinks).toEqual([])
    expect(fake.calls.filter(call => call.startsWith('LinkKnowledge') || call.startsWith('UnlinkKnowledge'))).toEqual([
      'LinkKnowledgeTaskForAgent',
      'UnlinkKnowledgeTaskForAgent',
    ])
  })

  it('makes one write of two calls at once under one key', async () => {
    const kit = await organization.connect()
    const args = { kind: 'MARKETING_TACTIC', id: TACTIC, inUse: true }
    const [first, second] = await Promise.all([
      kit.answer('set_knowledge_in_use', args, 'key-1'),
      kit.answer('set_knowledge_in_use', args, 'key-1'),
    ])

    expect(second).toEqual(first)
    expect(fake.knowledgeUses).toHaveLength(1)
    expect(fake.results.size).toBe(1)
  })
})
