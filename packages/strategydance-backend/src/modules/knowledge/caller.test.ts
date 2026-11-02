import { afterEach, describe, expect, it, mock } from 'bun:test'

import { MARKETING_TACTICS } from 'strategydance-knowledge'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeTestOrganization } = await import('./testing/createKnowledgeTestOrganization')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const organization = createKnowledgeTestOrganization(fake, ORGANIZATION_ID)

const NOT_MEMBER = 'The member is no longer in this organization, so its knowledge is closed to you.'

const TACTIC = MARKETING_TACTICS[0]!.id

afterEach(() => fake.reset())

// A call to each write tool, each one that would write: the unlink the link's, which runs first
function writes(taskId: string) {
  return [
    ['set_knowledge_in_use', { kind: 'MARKETING_TACTIC', id: TACTIC, inUse: true }],
    ['link_knowledge', { kind: 'MARKETING_TACTIC', id: TACTIC, taskId }],
    ['unlink_knowledge', { kind: 'MARKETING_TACTIC', id: TACTIC, taskId }],
  ] as const
}

describe('the caller', () => {
  it('refuses every write of a connection granted read alone, before anything is read or written', async () => {
    const kit = await organization.connect({ scopes: ['knowledge:read'] })
    const task = organization.addTask()

    fake.calls.length = 0

    for (const [name, args] of writes(task.id)) {
      expect(await kit.refusal(name, args)).toBe('This connection may only read the knowledge.')
    }

    expect(fake.calls).toEqual([])
  })

  it('refuses every call of a removed member, writing nothing', async () => {
    const kit = await organization.connect()
    const task = organization.addTask()

    fake.removeMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('list_knowledge', { kind: 'MARKETING_TACTIC' })).toBe(NOT_MEMBER)
    expect(await kit.refusal('read_knowledge', { kind: 'MARKETING_TACTIC', ids: [TACTIC] })).toBe(NOT_MEMBER)

    for (const [name, args] of writes(task.id)) expect(await kit.refusal(name, args)).toBe(NOT_MEMBER)

    expect(fake.knowledgeUses).toEqual([])
    expect(fake.knowledgeLinks).toEqual([])
  })

  it('refuses a call carrying the membership of a member since removed and invited back', async () => {
    const kit = await organization.connect()
    const task = organization.addTask()

    fake.removeMember('member', ORGANIZATION_ID)
    fake.addMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('read_knowledge', { kind: 'MARKETING_TACTIC', ids: [TACTIC] })).toBe(NOT_MEMBER)

    for (const [name, args] of writes(task.id)) expect(await kit.refusal(name, args)).toBe(NOT_MEMBER)

    expect(fake.knowledgeUses).toEqual([])
  })

  it('refuses a write whose membership ends between the read and the write', async () => {
    const task = organization.addTask()

    for (const [name, args] of writes(task.id)) {
      const kit = await organization.connect()

      // The unlink finds a link to remove
      if (name === 'unlink_knowledge') {
        fake.insertLink({
          organizationId: ORGANIZATION_ID,
          kind: 'MARKETING_TACTIC',
          itemId: TACTIC,
          target: 'task',
          targetId: task.id,
        })
      }

      fake.beforeOperation = async operation => {
        if (operation.endsWith('ForAgent') && !operation.startsWith('Get')) fake.removeMember('member', ORGANIZATION_ID)
      }

      expect(await kit.refusal(name, args)).toBe(NOT_MEMBER)

      fake.beforeOperation = async () => {}
    }

    expect(fake.knowledgeUses).toEqual([])
    expect(fake.knowledgeLinks).toHaveLength(1)
  })

  it('records no day of activity for any write', async () => {
    const kit = await organization.connect()
    const task = organization.addTask()

    for (const [name, args] of writes(task.id)) await kit.answer(name, args)

    expect(fake.calls.filter(call => call.includes('Activity'))).toEqual([])
    expect(fake.sdk).not.toHaveProperty('recordActivity')
  })
})
