import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import type { BetaStopReason } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import express, { type NextFunction, type Request, type Response } from 'express'
import { PDFDocument } from 'pdf-lib'
import {
  ERROR_CODE_CONVERSATIONS_SUSPENDED,
  ERROR_CODE_EMAIL_NOT_VERIFIED,
  ERROR_CODE_RECEIPT_READS_CAPPED,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  MAX_DAILY_RECEIPT_READS_PER_MEMBER,
} from 'strategydance-core'

import type { ClaudeClient } from '~types'

import createClaudeMessage from '~domain/agent/createClaudeMessage'
import createScriptedClaudeClient from '~domain/agent/testing/createScriptedClaudeClient'
import createBudgetDatabaseFake from '~domain/budget/testing/createBudgetDatabaseFake'
import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'
import createModuleDatabaseFakeBase from '~domain/modules/testing/createModuleDatabaseFakeBase'

const fake = createBudgetDatabaseFake(createModuleDatabaseFakeBase())
const storage = createAttachmentStorageFake()

mock.module('~firebase', () => ({ dataConnect: {}, bucket: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/budget/billReceiptStorage', () => ({ default: storage.storage }))

// The receipt reader's Claude, scripted afresh by each test
let claude = createScriptedClaudeClient()

const client: ClaudeClient = {
  stream: (body, options) => claude.client.stream(body, options),
  countTokens: body => claude.client.countTokens(body),
}

mock.module('~domain/agent/conversationClaudeClient', () => ({ default: client }))

function passThrough(_request: Request, _response: Response, next: NextFunction) {
  next()
}

mock.module('~middleware/appCheck', () => ({ default: passThrough }))

mock.module('~middleware/authentication', () => ({
  default: (request: Request, _response: Response, next: NextFunction) => {
    request.viewer = {
      id: request.header('x-viewer') ?? MEMBER,
      email: null,
      isEmailVerified: request.header('x-email-verified') !== 'false',
    }
    next()
  },
}))

// Membership is the operations' to check, which these tests read through the fake, and metering is
// the instance's, which these tests would exhaust between them
mock.module('~middleware/organizationMember', () => ({ default: passThrough }))
mock.module('~middleware/billReceiptUploadRateLimit', () => ({ default: passThrough }))
mock.module('~middleware/billReceiptReadRateLimit', () => ({ default: passThrough }))
mock.module('~middleware/billReceiptReaderRateLimit', () => ({ default: passThrough }))

const { default: createBudgetRouter } = await import('./budget')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const OTHER_ORGANIZATION_ID = '9e8d7c6b5a4f43e2a1b0c9d8e7f6a5b4'

const MEMBER = 'member'
const OTHER = 'other'
const OUTSIDER = 'outsider'

const HOUR_MS = 60 * 60 * 1000

const servers: Server[] = []
let origin = ''

// A PNG's signature and header, padded to a size
function png(size = 2000) {
  const bytes = Buffer.alloc(size)

  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).copy(bytes)
  bytes.write('IHDR', 12, 'ascii')

  return bytes
}

async function pdf(pageCount: number) {
  const document = await PDFDocument.create()

  for (let index = 0; index < pageCount; index++) document.addPage()

  return Buffer.from(await document.save())
}

function newId() {
  return crypto.randomUUID().replaceAll('-', '')
}

type Upload = {
  receiptId?: string
  bytes: Uint8Array
  contentType: string
  name?: string
  viewer?: string
}

function upload({ receiptId = newId(), bytes, contentType, name = 'Invoice', viewer = MEMBER }: Upload) {
  return fetch(`${origin}/organizations/${ORGANIZATION_ID}/budget/receipts/${receiptId}`, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'X-File-Name': encodeURIComponent(name), 'X-Viewer': viewer },
    body: new Uint8Array(bytes),
  })
}

function read(receiptId: string, viewer = MEMBER) {
  return fetch(`${origin}/organizations/${ORGANIZATION_ID}/budget/receipts/${receiptId}`, {
    headers: { 'X-Viewer': viewer },
  })
}

function objectName(receiptId: string, organizationId = ORGANIZATION_ID) {
  return `organizations/${organizationId}/receipts/${receiptId}`
}

beforeEach(async () => {
  claude = createScriptedClaudeClient()
  fake.reset()
  storage.objects.clear()
  storage.calls.length = 0
  fake.addMember(MEMBER, ORGANIZATION_ID)
  fake.addMember(OTHER, ORGANIZATION_ID)
  fake.addMember(OUTSIDER, OTHER_ORGANIZATION_ID)

  if (!origin) {
    const app = express()

    app.use('/organizations/:organizationId/budget', createBudgetRouter())

    const server = app.listen(0)

    await new Promise(resolve => server.once('listening', resolve))
    servers.push(server)
    origin = `http://localhost:${(server.address() as AddressInfo).port}`
  }
})

afterAll(() => {
  for (const server of servers) server.close()
})

describe('PUT /receipts/:receiptId', () => {
  test("stores a receipt in its organization's folder, ready, and answers it as stored", async () => {
    const receiptId = newId()
    const bytes = await pdf(2)
    const response = await upload({ receiptId, bytes, contentType: 'application/pdf', name: 'Facture d’été.pdf' })

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      status: 'success',
      data: { id: receiptId, name: 'Facture d’été.pdf', contentType: 'application/pdf', size: bytes.length },
    })
    expect(fake.receipts.get(receiptId)).toMatchObject({ userId: MEMBER, status: 'READY', size: bytes.length })
    expect(storage.objects.get(objectName(receiptId))?.bytes).toEqual(new Uint8Array(bytes))
  })

  test('reads a PDF or a text file back to check it, and takes a photo on its signature', async () => {
    const photo = newId()
    const text = newId()

    expect((await upload({ receiptId: photo, bytes: png(), contentType: 'image/png' })).status).toBe(201)
    expect(
      (await upload({ receiptId: text, bytes: Buffer.from('Total: 12.00'), contentType: 'text/plain' })).status,
    ).toBe(201)
    expect(storage.calls.filter(call => call.startsWith('read'))).toEqual([`read ${objectName(text)}`])
  })

  test('refuses bytes that are not their declared type, storing nothing, and leaves its row to the sweep', async () => {
    const receiptId = newId()

    expect((await upload({ receiptId, bytes: png(), contentType: 'application/pdf' })).status).toBe(415)
    expect(storage.objects.size).toBe(0)
    expect(fake.receipts.get(receiptId)?.status).toBe('UPLOADING')
  })

  test('refuses a PDF past 20 pages, or text that is not text, deleting what it stored', async () => {
    const long = newId()
    const binary = newId()

    expect((await upload({ receiptId: newId(), bytes: await pdf(20), contentType: 'application/pdf' })).status).toBe(
      201,
    )
    expect((await upload({ receiptId: long, bytes: await pdf(21), contentType: 'application/pdf' })).status).toBe(413)
    expect(
      (await upload({ receiptId: binary, bytes: Buffer.from([0xff, 0xfe, 0x41]), contentType: 'text/plain' })).status,
    ).toBe(415)
    expect(storage.objects.has(objectName(long))).toBe(false)
    expect(storage.objects.has(objectName(binary))).toBe(false)
    expect(fake.receipts.get(long)?.status).toBe('UPLOADING')
  })

  test('refuses a type a bill does not take before anything is reserved', async () => {
    const response = await upload({ bytes: Buffer.from('GIF89a'), contentType: 'image/gif' })

    expect(response.status).toBe(415)
    expect(((await response.json()) as { message: string }).message).toBe('A receipt is a PDF, a text file or a photo')
    expect(fake.receipts.size).toBe(0)
  })

  test('stores an upload sent again once, whether or not its id is spelled with hyphens', async () => {
    const receiptId = crypto.randomUUID()
    const bytes = png()

    expect((await upload({ receiptId, bytes, contentType: 'image/png' })).status).toBe(201)
    expect((await upload({ receiptId: receiptId.replaceAll('-', ''), bytes, contentType: 'image/png' })).status).toBe(
      201,
    )
    expect(fake.receipts.size).toBe(1)
    expect(storage.objects.size).toBe(1)
    expect(storage.calls.filter(call => call.startsWith('write'))).toHaveLength(1)
  })

  test('finishes a reservation an upload left, and refuses one over a day old', async () => {
    const left = newId()
    const old = newId()

    fake.insertReceipt({
      id: left,
      organizationId: ORGANIZATION_ID,
      userId: MEMBER,
      status: 'UPLOADING',
      contentType: 'image/png',
      size: 2000,
      name: 'Invoice',
    })
    fake.insertReceipt({
      id: old,
      organizationId: ORGANIZATION_ID,
      userId: MEMBER,
      status: 'UPLOADING',
      contentType: 'image/png',
      size: 2000,
      name: 'Invoice',
      createdAt: new Date(Date.now() - 25 * HOUR_MS).toISOString(),
    })

    expect((await upload({ receiptId: left, bytes: png(), contentType: 'image/png' })).status).toBe(201)
    expect(fake.receipts.get(left)?.status).toBe('READY')
    expect((await upload({ receiptId: old, bytes: png(), contentType: 'image/png' })).status).toBe(409)
    expect(storage.objects.has(objectName(old))).toBe(false)
  })

  test("refuses an id another member's or another organization's receipt holds, or this one's otherwise", async () => {
    const theirs = fake.insertReceipt({ organizationId: ORGANIZATION_ID, userId: OTHER })
    const elsewhere = fake.insertReceipt({ organizationId: OTHER_ORGANIZATION_ID, userId: OUTSIDER })
    const mine = newId()

    expect((await upload({ receiptId: theirs.id, bytes: await pdf(1), contentType: 'application/pdf' })).status).toBe(
      409,
    )
    expect(
      (await upload({ receiptId: elsewhere.id, bytes: await pdf(1), contentType: 'application/pdf' })).status,
    ).toBe(409)
    expect((await upload({ receiptId: mine, bytes: png(), contentType: 'image/png' })).status).toBe(201)
    expect((await upload({ receiptId: mine, bytes: png(3000), contentType: 'image/png' })).status).toBe(409)
    expect(storage.objects.size).toBe(1)
  })

  test('refuses a member of another organization, reserving nothing', async () => {
    const response = await upload({ bytes: png(), contentType: 'image/png', viewer: OUTSIDER })

    expect(response.status).toBe(403)
    expect(fake.receipts.size).toBe(0)
    expect(storage.objects.size).toBe(0)
  })

  test('keeps its receipt when finishing went through but its answer was lost', async () => {
    const receiptId = newId()
    let isLost = false

    fake.beforeOperation = async (name, variables) => {
      if (name !== 'CompleteBillReceiptUpload' || isLost) return

      isLost = true
      await (
        fake.sdk as Record<string, (dataConnect: unknown, variables: unknown) => Promise<unknown>>
      ).completeBillReceiptUpload?.({}, variables)

      throw new Error('The connection was reset')
    }

    expect((await upload({ receiptId, bytes: png(), contentType: 'image/png' })).status).toBe(201)
    expect(fake.receipts.get(receiptId)?.status).toBe('READY')
    expect(storage.objects.has(objectName(receiptId))).toBe(true)
  })

  test('deletes its object when its row went while it uploaded, as its organization going takes it', async () => {
    const receiptId = newId()

    fake.beforeOperation = async name => {
      if (name !== 'CompleteBillReceiptUpload') return

      fake.receipts.delete(receiptId)

      throw new Error('The receipt is no longer being uploaded')
    }

    expect((await upload({ receiptId, bytes: png(), contentType: 'image/png' })).status).toBe(409)
    expect(storage.objects.size).toBe(0)
  })
})

describe('GET /receipts/:receiptId', () => {
  test('serves a receipt to any member of its organization, with private cache headers', async () => {
    const bytes = await pdf(1)
    const receipt = fake.insertReceipt({
      organizationId: ORGANIZATION_ID,
      userId: MEMBER,
      name: "Facture d'été (v2).pdf",
      size: bytes.length,
    })

    storage.objects.set(objectName(receipt.id), { bytes, contentType: 'application/pdf' })

    const response = await read(receipt.id, OTHER)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-length')).toBe(String(bytes.length))
    expect(response.headers.get('cache-control')).toBe('private, max-age=31536000, immutable')
    expect(response.headers.get('content-disposition')).toBe(
      "inline; filename*=UTF-8''Facture%20d%27%C3%A9t%C3%A9%20%28v2%29.pdf",
    )
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
  })

  test('serves a receipt whose uploader has left the organization', async () => {
    const bytes = Buffer.from('Total: 12.00')
    const receipt = fake.insertReceipt({
      organizationId: ORGANIZATION_ID,
      userId: MEMBER,
      contentType: 'text/plain',
      size: bytes.length,
    })

    storage.objects.set(objectName(receipt.id), { bytes, contentType: 'text/plain' })
    fake.removeMember(MEMBER, ORGANIZATION_ID)

    const response = await read(receipt.id, OTHER)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await response.text()).toBe('Total: 12.00')
  })

  test("serves nothing of a receipt still uploading, or of another organization's", async () => {
    const uploading = fake.insertReceipt({ organizationId: ORGANIZATION_ID, userId: MEMBER, status: 'UPLOADING' })
    const elsewhere = fake.insertReceipt({ organizationId: OTHER_ORGANIZATION_ID, userId: OUTSIDER })

    storage.objects.set(objectName(uploading.id), { bytes: await pdf(1), contentType: 'application/pdf' })
    storage.objects.set(objectName(elsewhere.id, OTHER_ORGANIZATION_ID), {
      bytes: await pdf(1),
      contentType: 'application/pdf',
    })

    expect((await read(uploading.id)).status).toBe(404)
    expect((await read(elsewhere.id)).status).toBe(404)
    expect((await read(newId())).status).toBe(404)
  })

  test('refuses a member of another organization', async () => {
    const receipt = fake.insertReceipt({ organizationId: ORGANIZATION_ID, userId: MEMBER })

    storage.objects.set(objectName(receipt.id), { bytes: await pdf(1), contentType: 'application/pdf' })

    expect((await read(receipt.id, OUTSIDER)).status).toBe(403)
  })
})

const FIELDS = {
  name: 'Figma Professional',
  description: '',
  company: 'Figma',
  amount: '45.00',
  currency: 'USD',
  paidOn: '2026-10-03',
  recurrence: 'MONTHLY',
}

function answer(stopReason: BetaStopReason = 'end_turn') {
  return createClaudeMessage({
    content: [{ type: 'text', text: JSON.stringify(FIELDS), citations: null }],
    stopReason,
    model: 'claude-haiku-5-5',
  })
}

// A receipt the member uploaded, its file stored
async function stored(userId = MEMBER) {
  const receipt = fake.insertReceipt({ organizationId: ORGANIZATION_ID, userId })

  storage.objects.set(objectName(receipt.id), { bytes: await pdf(1), contentType: 'application/pdf' })

  return receipt
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

type Ask = {
  viewer?: string
  day?: unknown
  isEmailVerified?: boolean
}

function ask(receiptId: string, { viewer = MEMBER, day = today(), isEmailVerified = true }: Ask = {}) {
  return fetch(`${origin}/organizations/${ORGANIZATION_ID}/budget/receipts/${receiptId}/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Viewer': viewer,
      'X-Email-Verified': String(isEmailVerified),
    },
    body: JSON.stringify({ today: day }),
  })
}

describe('POST /receipts/:receiptId/read', () => {
  test('answers what the receipt says, then the same again for nothing', async () => {
    const receipt = await stored()

    claude = createScriptedClaudeClient({ answers: [answer()] })

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await ask(receipt.id)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ status: 'success', data: { fields: FIELDS } })
    }

    expect(claude.requests).toHaveLength(1)
  })

  test('refuses a read past the member’s daily cap with a 429 saying when it has room', async () => {
    const receipt = await stored()

    for (let index = 0; index < MAX_DAILY_RECEIPT_READS_PER_MEMBER; index++) {
      fake.insertReceipt({
        organizationId: ORGANIZATION_ID,
        userId: MEMBER,
        readAt: new Date(Date.now() - HOUR_MS - index * 1000).toISOString(),
        readFields: JSON.stringify(FIELDS),
      })
    }

    const response = await ask(receipt.id)

    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({ code: ERROR_CODE_RECEIPT_READS_CAPPED })
    expect(Math.abs(Number(response.headers.get('retry-after')) - (23 * 3600 - 49))).toBeLessThanOrEqual(5)
    expect(claude.requests).toHaveLength(0)
  })

  test('answers a refusal with a 503 and lets the receipt go, to be asked again', async () => {
    const receipt = await stored()

    claude = createScriptedClaudeClient({ answers: [answer('refusal'), answer()] })

    const refused = await ask(receipt.id)

    expect(refused.status).toBe(503)
    expect(await refused.json()).toMatchObject({ code: ERROR_CODE_SERVICE_UNAVAILABLE })
    expect(fake.receipts.get(receipt.id)?.readAt).toBeNull()
    expect((await ask(receipt.id)).status).toBe(200)
  })

  test('refuses a caller whose address is not confirmed, before anything is claimed', async () => {
    const receipt = await stored()
    const response = await ask(receipt.id, { isEmailVerified: false })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: ERROR_CODE_EMAIL_NOT_VERIFIED })
    expect(fake.receipts.get(receipt.id)?.readAt).toBeNull()
    expect(claude.requests).toHaveLength(0)
  })

  test('refuses a member whose conversations staff suspended, before anything is claimed, and reads once lifted', async () => {
    const receipt = await stored()

    for (const suspended of [MEMBER, fake.id(ORGANIZATION_ID)]) {
      fake.suspended.add(suspended)

      const response = await ask(receipt.id)

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: ERROR_CODE_CONVERSATIONS_SUSPENDED })
      expect(fake.receipts.get(receipt.id)?.readAt).toBeNull()

      fake.suspended.clear()
    }

    claude = createScriptedClaudeClient({ answers: [answer()] })

    expect((await ask(receipt.id)).status).toBe(200)
  })

  test('refuses another member’s receipt, and a member of another organization', async () => {
    const receipt = await stored()

    expect((await ask(receipt.id, { viewer: OTHER })).status).toBe(403)
    expect((await ask(receipt.id, { viewer: OUTSIDER })).status).toBe(403)
    expect((await ask(newId())).status).toBe(404)
    expect(claude.requests).toHaveLength(0)
  })

  test('refuses a today that is not a day, or more than one away from the server’s', async () => {
    const receipt = await stored()
    const [year, month, date] = today().split('-').map(Number) as [number, number, number]
    const far = new Date(Date.UTC(year, month - 1, date + 2)).toISOString().slice(0, 10)

    for (const day of ['2026-02-30', 'tomorrow', 20261027, far]) {
      expect((await ask(receipt.id, { day })).status).toBe(400)
    }

    expect(claude.requests).toHaveLength(0)
  })
})
