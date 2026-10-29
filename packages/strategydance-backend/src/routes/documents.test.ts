import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import express, { type NextFunction, type Request, type Response } from 'express'
import {
  ERROR_CODE_CONFLICT,
  ERROR_CODE_DOCUMENT_REVISION_UNRESTORABLE,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_UNAUTHORIZED_AUTHENTICATION,
} from 'strategydance-core'
import { RICH_TEXT_YJS_FRAGMENT } from 'strategydance-design-system/lib/richText'
import { richTextToMarkdown } from 'strategydance-design-system/lib/richTextToMarkdown'
import * as Y from 'yjs'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

function passThrough(_request: Request, _response: Response, next: NextFunction) {
  next()
}

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~middleware/appCheck', () => ({ default: passThrough }))
// Metering is the instance's, which these tests would exhaust between them
mock.module('~middleware/documentRevisionRateLimit', () => ({ default: passThrough }))
// Membership is the operations' to check, which these tests read through the fake
mock.module('~middleware/organizationMember', () => ({ default: passThrough }))

// The caller the request names, or nobody, refused as the real middleware refuses a request with no token
mock.module('~middleware/authentication', () => ({
  default: (request: Request, response: Response, next: NextFunction) => {
    const viewer = request.header('x-viewer')

    if (!viewer) {
      response.status(401).json({ status: 'error', code: ERROR_CODE_UNAUTHORIZED_AUTHENTICATION, message: 'No token' })

      return
    }

    request.viewer = { id: viewer, email: null, isEmailVerified: true }
    next()
  },
}))

const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')
const { default: createTestDocuments } = await import('~modules/documents/testing/createTestDocuments')
const { default: createDocumentsRouter } = await import('./documents')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const CONVERSATION_ID = '5a4b3c2d1e0f4a9b8c7d6e5f4a3b2c1d'
const MEMBER = 'member'

const documents = createTestDocuments(fake, ORGANIZATION_ID)

const app = express()

app.use('/organizations/:organizationId/documents', createDocumentsRouter())

const server: Server = app.listen(0)

await new Promise(resolve => server.once('listening', resolve))

const origin = `http://localhost:${(server.address() as AddressInfo).port}`

afterAll(() => server.close())
afterEach(() => fake.reset())

// Strategy Dance's agent in the member's conversation, each write keyed with Claude's id for the call
async function connectAgent(conversationId = CONVERSATION_ID, userId = MEMBER) {
  return createModuleTestKit('documents', {
    kind: 'agent',
    userId,
    organizationId: ORGANIZATION_ID,
    membershipCreatedAt: fake.addMember(userId, ORGANIZATION_ID),
    scopes: ['documents:read', 'documents:write'],
    idempotencyScope: `conversation:${conversationId}`,
  })
}

async function call(method: string, path: string, body?: unknown, viewer: string | null = MEMBER) {
  const response = await fetch(`${origin}/organizations/${ORGANIZATION_ID}/documents${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(viewer && { 'x-viewer': viewer }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  return { status: response.status, body: (await response.json()) as Record<string, any> }
}

function restore(documentId: string, revisionId: string, isUndo: boolean, viewer?: string | null) {
  return call('POST', `/${documentId}/revisions/${revisionId}/restore`, { isUndo }, viewer)
}

function undoable(conversationId = CONVERSATION_ID, viewer?: string | null) {
  return call('GET', `/revisions/undoable/${conversationId}`, undefined, viewer)
}

// A member aligning a table's first cell, as a tab pushes the change: nothing its Markdown says
function alignFirstCell(documentId: string) {
  const doc = documents.open(documentId)
  const before = Y.encodeStateVector(doc)
  const [cell] = doc
    .getXmlFragment(RICH_TEXT_YJS_FRAGMENT)
    .createTreeWalker(type => type instanceof Y.XmlElement && type.nodeName === 'tableCell')

  ;(cell as Y.XmlElement).setAttribute('textAlignment', 'center')
  fake.pushUpdate(documentId, Buffer.from(Y.encodeStateAsUpdate(doc, before)).toString('base64'))
}

function markdownOf(documentId: string) {
  return documents.read(documentId).map(block => block.markdown)
}

function revisionOf(callKey: string) {
  const revision = fake.revisions.find(candidate => candidate.callKey === callKey)

  if (!revision) throw new Error(`No revision for the call ${callKey}`)

  return revision
}

describe('POST /:documentId/revisions/:revisionId/restore', () => {
  test("undoes an agent's edit, its text and its ids as they were, keeping a revision that redoes it", async () => {
    const agent = await connectAgent()
    const document = documents.store('Intro\n\nOutro')
    const before = documents.read(document.id)

    await agent.answer('update_document', { id: document.id, append: 'Added' }, 'toolu_append')

    const undone = await restore(document.id, revisionOf('toolu_append').id, true)

    expect(undone.status).toBe(200)
    expect(documents.read(document.id)).toEqual(before)

    const kept = fake.revisions.find(revision => revision.id === undone.body.data.revisionId)

    expect(kept).toMatchObject({
      userId: MEMBER,
      scope: null,
      callKey: null,
      restoredVersionAt: revisionOf('toolu_append').createdAt,
    })
    expect(richTextToMarkdown(JSON.parse(kept?.content ?? '[]'))).toBe('Intro\n\nOutro\n\nAdded')

    const redone = await restore(document.id, undone.body.data.revisionId, true)

    expect(redone.status).toBe(200)
    expect(markdownOf(document.id)).toEqual(['Intro', 'Outro', 'Added'])
  })

  test('refuses an Undo once somebody wrote since, and restores from the history with what they wrote going too', async () => {
    const agent = await connectAgent()
    const document = documents.store('Intro\n\nOutro')

    await agent.answer(
      'update_document',
      { id: document.id, replaceText: { find: 'Outro', replace: 'Ending' } },
      'toolu_text',
    )
    documents.type(document.id, 0, 5, ' typed')

    const revision = revisionOf('toolu_text')
    const refused = await restore(document.id, revision.id, true)

    expect(refused).toMatchObject({ status: 409, body: { code: ERROR_CODE_CONFLICT } })
    expect(markdownOf(document.id)).toEqual(['Intro typed', 'Ending'])

    const restored = await restore(document.id, revision.id, false)

    expect(restored.status).toBe(200)
    expect(markdownOf(document.id)).toEqual(['Intro', 'Outro'])
    expect(fake.pendingUpdates(document.id)).toEqual([])
    expect(richTextToMarkdown(JSON.parse(fake.revisions.at(-1)?.content ?? '[]'))).toBe('Intro typed\n\nEnding')
  })

  test("refuses an Undo once somebody changed what Markdown cannot say, a table's alignment", async () => {
    const agent = await connectAgent()
    const document = documents.store('| Head | Other |\n| --- | --- |\n| Alpha | x |')

    await agent.answer('update_document', { id: document.id, append: 'Added' }, 'toolu_append')

    const markdown = markdownOf(document.id)

    alignFirstCell(document.id)

    expect(markdownOf(document.id)).toEqual(markdown)
    expect((await undoable()).body.data.revisions).toEqual([])
    expect(await restore(document.id, revisionOf('toolu_append').id, true)).toMatchObject({
      status: 409,
      body: { code: ERROR_CODE_CONFLICT },
    })
    expect(fake.pendingUpdates(document.id)).toHaveLength(1)
  })

  test('refuses an Undo when a push lands between its read and its write', async () => {
    const agent = await connectAgent()
    const document = documents.store('Intro')

    await agent.answer('update_document', { id: document.id, append: 'Added' }, 'toolu_append')

    let hasTyped = false

    fake.beforeOperation = async name => {
      if (name !== 'RestoreDocumentRevision' || hasTyped) return

      hasTyped = true
      documents.type(document.id, 0, 0, 'Typed ')
    }

    expect(await restore(document.id, revisionOf('toolu_append').id, true)).toMatchObject({
      status: 409,
      body: { code: ERROR_CODE_CONFLICT },
    })
    expect(markdownOf(document.id)).toEqual(['Typed Intro', 'Added'])
  })

  test('restores from the history while somebody types in a block it keeps, which stays pending and merges', async () => {
    const agent = await connectAgent()
    const document = documents.store('Intro\n\nOutro')

    await agent.answer('update_document', { id: document.id, append: 'Added' }, 'toolu_append')

    let hasTyped = false

    fake.beforeOperation = async name => {
      if (name !== 'RestoreDocumentRevision' || hasTyped) return

      hasTyped = true
      documents.type(document.id, 0, 5, ' typed')
    }

    expect((await restore(document.id, revisionOf('toolu_append').id, false)).status).toBe(200)
    expect(fake.pendingUpdates(document.id)).toHaveLength(1)
    expect(markdownOf(document.id)).toEqual(['Intro typed', 'Outro'])
  })

  test('reads again and restores when somebody folded meanwhile', async () => {
    const agent = await connectAgent()
    const document = documents.store('Intro\n\nOutro')

    await agent.answer('update_document', { id: document.id, append: 'Added' }, 'toolu_append')

    let hasFolded = false

    fake.beforeOperation = async name => {
      if (name !== 'RestoreDocumentRevision' || hasFolded) return

      hasFolded = true
      fake.documents.get(document.id)!.revision += 1
    }

    expect((await restore(document.id, revisionOf('toolu_append').id, false)).status).toBe(200)
    expect(fake.calls.filter(name => name === 'RestoreDocumentRevision')).toHaveLength(2)
    expect(markdownOf(document.id)).toEqual(['Intro', 'Outro'])
  })

  test('writes nothing when the text reads as the version already, as a restore sent again finds it', async () => {
    const agent = await connectAgent()
    const document = documents.store('Intro')

    await agent.answer('update_document', { id: document.id, append: 'Added' }, 'toolu_append')

    const revision = revisionOf('toolu_append')

    expect((await restore(document.id, revision.id, false)).status).toBe(200)

    const count = fake.revisions.length
    const again = await restore(document.id, revision.id, false)

    expect(again).toMatchObject({ status: 200, body: { data: { revisionId: null } } })
    expect(fake.revisions).toHaveLength(count)
  })

  test('restores a document the team keeps from AI, which only members read', async () => {
    const agent = await connectAgent()
    const document = documents.store('Intro')

    await agent.answer('update_document', { id: document.id, append: 'Added' }, 'toolu_append')
    Object.assign(fake.documents.get(document.id)!, { isAiReadable: false, isAiWritable: false })

    expect((await restore(document.id, revisionOf('toolu_append').id, true)).status).toBe(200)
    expect(markdownOf(document.id)).toEqual(['Intro'])
  })

  test('answers 404 for a revision of another document, a deleted document, or a caller outside the organization', async () => {
    const agent = await connectAgent()
    const document = documents.store('Intro')
    const other = documents.store('Other')

    await agent.answer('update_document', { id: document.id, append: 'Added' }, 'toolu_append')

    const revision = revisionOf('toolu_append')

    expect(await restore(other.id, revision.id, false)).toMatchObject({
      status: 404,
      body: { code: ERROR_CODE_NOT_FOUND },
    })
    expect((await restore(document.id, revision.id, false, 'stranger')).status).toBe(404)

    fake.documents.get(document.id)!.deletedAt = fake.stamp()

    expect((await restore(document.id, revision.id, false)).status).toBe(404)
  })

  test('refuses a version that cannot be written back as the document stands', async () => {
    const agent = await connectAgent()
    const document = documents.store('Intro')

    await agent.answer('update_document', { id: document.id, append: 'Added' }, 'toolu_append')
    revisionOf('toolu_append').compressedState = Buffer.from('not a snapshot').toString('base64')

    expect(await restore(document.id, revisionOf('toolu_append').id, false)).toMatchObject({
      status: 409,
      body: { code: ERROR_CODE_DOCUMENT_REVISION_UNRESTORABLE },
    })
    expect(markdownOf(document.id)).toEqual(['Intro', 'Added'])
  })

  test('refuses a caller with no token', async () => {
    expect((await restore('0'.repeat(32), '1'.repeat(32), false, null)).status).toBe(401)
  })
})

describe('GET /revisions/undoable/:conversationId', () => {
  test("lists each document's newest edit nobody has written over since, by its call's key", async () => {
    const agent = await connectAgent()
    const plan = documents.store('Plan')
    const notes = documents.store('Notes')
    const typed = documents.store('Typed')

    await agent.answer('update_document', { id: plan.id, append: 'First' }, 'toolu_first')
    await agent.answer('update_document', { id: plan.id, append: 'Second' }, 'toolu_second')
    await agent.answer('update_document', { id: notes.id, append: 'More' }, 'toolu_notes')
    await agent.answer('update_document', { id: typed.id, append: 'More' }, 'toolu_typed')
    documents.type(typed.id, 0, 0, 'Somebody ')

    const { status, body } = await undoable()

    expect(status).toBe(200)
    expect(body.data.revisions).toEqual([
      { id: revisionOf('toolu_notes').id, callKey: 'toolu_notes', documentId: notes.id },
      { id: revisionOf('toolu_second').id, callKey: 'toolu_second', documentId: plan.id },
    ])
  })

  test('offers the edit before once the newest is undone, and none of a deleted document', async () => {
    const agent = await connectAgent()
    const plan = documents.store('Plan')

    await agent.answer('update_document', { id: plan.id, append: 'First' }, 'toolu_first')
    await agent.answer('update_document', { id: plan.id, append: 'Second' }, 'toolu_second')
    await restore(plan.id, revisionOf('toolu_second').id, true)

    expect((await undoable()).body.data.revisions.map((revision: { callKey: string }) => revision.callKey)).toEqual([
      'toolu_first',
    ])

    fake.documents.get(plan.id)!.deletedAt = fake.stamp()

    expect((await undoable()).body.data.revisions).toEqual([])
  })

  test("lists nothing of another member's conversation, nor of an external agent's edits", async () => {
    const agent = await connectAgent(CONVERSATION_ID, 'teammate')
    const plan = documents.store('Plan')

    fake.addMember(MEMBER, ORGANIZATION_ID)
    await agent.answer('update_document', { id: plan.id, append: 'First' }, 'toolu_first')

    expect((await undoable()).body.data.revisions).toEqual([])
    expect((await undoable(CONVERSATION_ID, 'teammate')).body.data.revisions).toHaveLength(1)
  })
})
