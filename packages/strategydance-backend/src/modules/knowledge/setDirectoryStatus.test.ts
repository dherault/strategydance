import { afterEach, describe, expect, it, mock } from 'bun:test'

import { DIRECTORIES, INACTIVE_DIRECTORIES, MARKETING_TACTICS } from 'strategydance-knowledge'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeTestOrganization } = await import('./testing/createKnowledgeTestOrganization')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const organization = createKnowledgeTestOrganization(fake, ORGANIZATION_ID)

const DIRECTORY = DIRECTORIES[0]!.id

type Set = { id: string; use: { inUse: boolean; changedAt: string; status?: string | null } | null }

afterEach(() => fake.reset())

function writes() {
  return fake.calls.filter(call => call === 'SetDirectoryStatusForAgent')
}

describe('set_directory_status', () => {
  it('sets a status, in use while submitted or listed, then takes it back, keeping the row', async () => {
    const kit = await organization.connect()
    const submitted = await kit.answer<Set>('set_directory_status', { id: DIRECTORY, status: 'SUBMITTED' })

    expect(submitted).toMatchObject({ id: DIRECTORY, use: { inUse: true, status: 'SUBMITTED' } })
    expect(fake.knowledgeUses).toMatchObject([
      { kind: 'DIRECTORY', itemId: DIRECTORY, isInUse: true, directoryStatus: 'SUBMITTED', changedById: 'member' },
    ])

    const listed = await kit.answer<Set>('set_directory_status', { id: DIRECTORY, status: 'LISTED' })
    const dismissed = await kit.answer<Set>('set_directory_status', { id: DIRECTORY, status: 'DISMISSED' })

    expect(listed.use).toMatchObject({ inUse: true, status: 'LISTED' })
    expect(dismissed.use).toMatchObject({ inUse: false, status: 'DISMISSED' })

    const toDo = await kit.answer<Set>('set_directory_status', { id: DIRECTORY, status: 'TO_DO' })

    expect(toDo.use).toMatchObject({ inUse: false, status: null })
    expect(fake.knowledgeUses).toHaveLength(1)
    expect(fake.knowledgeUses[0]).toMatchObject({ isInUse: false, directoryStatus: null })

    const { items } = await kit.answer<{ items: Set[] }>('read_knowledge', { kind: 'DIRECTORY', ids: [DIRECTORY] })

    expect(items[0]!.use).toEqual({ inUse: false, changedAt: fake.knowledgeUses[0]!.changedAt, status: null })
  })

  it('writes nothing for the status a directory holds, nor to do for one never marked', async () => {
    const kit = await organization.connect()

    expect(await kit.answer<Set>('set_directory_status', { id: DIRECTORY, status: 'TO_DO' })).toEqual({
      id: DIRECTORY,
      use: null,
    })

    await kit.answer('set_directory_status', { id: DIRECTORY, status: 'LISTED' })

    const { changedAt } = fake.knowledgeUses[0]!
    const again = await kit.answer<Set>('set_directory_status', { id: DIRECTORY, status: 'LISTED' })

    expect(again.use).toEqual({ inUse: true, changedAt, status: 'LISTED' })
    expect(writes()).toHaveLength(1)
  })

  it('reads a row from before statuses as submitted, so submitted writes nothing and to do clears it', async () => {
    const kit = await organization.connect()

    fake.insertUse({ organizationId: ORGANIZATION_ID, kind: 'DIRECTORY', itemId: DIRECTORY, isInUse: true })

    await kit.answer('set_directory_status', { id: DIRECTORY, status: 'SUBMITTED' })

    expect(writes()).toEqual([])

    await kit.answer('set_directory_status', { id: DIRECTORY, status: 'TO_DO' })

    expect(fake.knowledgeUses[0]).toMatchObject({ isInUse: false, directoryStatus: null })
  })

  it("sets an inactive directory's status, and refuses an id no directory has, writing nothing", async () => {
    const kit = await organization.connect()
    const inactive = INACTIVE_DIRECTORIES[0]!.id

    await kit.answer('set_directory_status', { id: inactive, status: 'LISTED' })

    expect(fake.knowledgeUses).toMatchObject([{ itemId: inactive, directoryStatus: 'LISTED' }])
    expect(await kit.refusal('set_directory_status', { id: MARKETING_TACTICS[0]!.id, status: 'SUBMITTED' })).toContain(
      'holds no DIRECTORY',
    )
    expect(await kit.refusal('set_directory_status', { id: DIRECTORY, status: 'DONE' })).toContain(
      'Input validation error',
    )
    expect(writes()).toHaveLength(1)
  })

  it('answers a call sent again under its key as it was, writing once', async () => {
    const kit = await organization.connect()
    const first = await kit.answer<Set>('set_directory_status', { id: DIRECTORY, status: 'SUBMITTED' }, 'status-1')

    await kit.answer('set_directory_status', { id: DIRECTORY, status: 'LISTED' })

    const again = await kit.answer<Set>('set_directory_status', { id: DIRECTORY, status: 'SUBMITTED' }, 'status-1')

    expect(again).toEqual(first)
    expect(writes()).toHaveLength(2)
  })

  it('refuses a removed member, writing nothing', async () => {
    const kit = await organization.connect()

    fake.removeMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('set_directory_status', { id: DIRECTORY, status: 'SUBMITTED' })).toBe(
      'The member is no longer in this organization, so its knowledge is closed to you.',
    )
    expect(fake.knowledgeUses).toEqual([])
  })
})
