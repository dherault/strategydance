import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'

import createClaudeFilesFake from '~domain/agent/testing/createClaudeFilesFake'
import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'

import createConversationDatabaseFake, { type FakeAttachment } from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()
const storage = createAttachmentStorageFake()
// What the Files API's next deletes fail with, which a test fills
const deleteFailures: Error[] = []
const files = createClaudeFilesFake({ deleteFailures })

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/conversationAttachmentStorage', () => ({ default: storage.storage }))

mock.module('~domain/agent/conversationClaudeFiles', () => ({ default: files.claudeFiles }))

const { default: pruneConversationAttachments } = await import('./pruneConversationAttachments')
const { default: pruneOrphanedClaudeFiles } = await import('./pruneOrphanedClaudeFiles')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const HOUR = 60 * 60 * 1000

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

// A file uploaded the given hours ago, its pending object and its file in the Files API there
function upload(hoursAgo: number, attachment: Partial<FakeAttachment> = {}) {
  const id = createId()
  const row: FakeAttachment = {
    id,
    userId: 'author',
    organizationId: ORGANIZATION_ID,
    conversationId: createId(),
    messageId: null,
    status: 'READY',
    name: 'Board.png',
    contentType: 'image/png',
    size: 10,
    pageCount: null,
    tokenCount: 371,
    claudeFileId: `file_${id}`,
    createdAt: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
    ...attachment,
  }

  fake.attachments.set(id, row)
  storage.objects.set(`pending/${ORGANIZATION_ID}/${row.userId}/${id}`, {
    bytes: new Uint8Array(10),
    contentType: 'image/png',
  })
  files.files.set(`file_${id}`, {
    id: `file_${id}`,
    name: id,
    contentType: 'image/png',
    bytes: new Uint8Array(10),
    createdAt: '',
  })

  return row
}

afterEach(() => setSystemTime())

beforeEach(() => {
  fake.reset()
  storage.objects.clear()
  files.files.clear()
  files.calls.length = 0
})

describe('pruneConversationAttachments', () => {
  test('deletes everybody’s expired unsent files with their files, and keeps the young and the sent', async () => {
    const stale = upload(1, { status: 'UPLOADING', userId: 'someone', claudeFileId: null })
    const old = upload(49, { userId: 'another' })
    const young = upload(47)
    const sent = upload(72, { messageId: createId() })

    expect(await pruneConversationAttachments()).toEqual({ claimed: 2, deleted: 2, kept: 0, orphans: null })

    for (const { id } of [stale, old]) expect(fake.attachments.has(id)).toBe(false)

    expect(files.files.has(`file_${old.id}`)).toBe(false)
    expect(fake.attachments.get(young.id)?.status).toBe('READY')
    expect(fake.attachments.get(sent.id)?.status).toBe('READY')
  })

  test('keeps a file whose files could not be deleted, claimed and counted, for the next sweep', async () => {
    const old = upload(49)

    storage.failures.delete = [new Error('Storage is down')]

    expect(await pruneConversationAttachments()).toMatchObject({ claimed: 1, deleted: 0, kept: 1 })
    expect(fake.attachments.get(old.id)?.status).toBe('PRUNING')
    expect(await pruneConversationAttachments()).toMatchObject({ claimed: 0, deleted: 1, kept: 0 })
    expect(fake.attachments.has(old.id)).toBe(false)
  })

  test('leaves the Files API’s listing alone outside production', async () => {
    await pruneConversationAttachments()

    expect(files.calls).not.toContain('list')
  })
})

describe('pruneOrphanedClaudeFiles', () => {
  test('deletes a day-old file of its own environment that no row names, and nothing else', async () => {
    const named = upload(1)
    const day = new Date(Date.now() - 25 * HOUR).toISOString()

    files.files.clear()

    for (const [id, name, createdAt] of [
      ['file_orphan', 'strategydance-development-orphan', day],
      [named.claudeFileId ?? '', `strategydance-development-${named.id}`, day],
      ['file_young', 'strategydance-development-young', new Date().toISOString()],
      ['file_production', 'strategydance-production-orphan', day],
      ['file_probe', 'probe.pdf', day],
    ] as const) {
      files.files.set(id, { id, name, contentType: 'application/pdf', bytes: new Uint8Array(1), createdAt })
    }

    expect(await pruneOrphanedClaudeFiles(Date.now() + 60_000)).toEqual({ deleted: 1, isComplete: true })
    expect([...files.files.keys()].sort()).toEqual(
      [named.claudeFileId ?? '', 'file_probe', 'file_production', 'file_young'].sort(),
    )
  })

  test('carries on past a file it cannot delete, leaving it for the next sweep', async () => {
    const day = new Date(Date.now() - 25 * HOUR).toISOString()

    for (const id of ['file_first', 'file_second']) {
      files.files.set(id, {
        id,
        name: `strategydance-development-${id}`,
        contentType: 'application/pdf',
        bytes: new Uint8Array(1),
        createdAt: day,
      })
    }

    deleteFailures.push(new Error('Overloaded'))

    expect(await pruneOrphanedClaudeFiles(Date.now() + 60_000)).toEqual({ deleted: 1, isComplete: true })
    expect(files.files.size).toBe(1)
  })
})
