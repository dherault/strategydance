import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'

import { PDFDocument } from 'pdf-lib'
import { DEVELOPMENT_API_URL, MAX_CONVERSATION_ATTACHMENT_SIZE } from 'strategydance-core'

import { authentication, dataConnect } from '~firebase'

/*
  Uploads twenty files of the largest size a conversation takes to one backend at once, and watches
  its memory, which has to stay within Cloud Run's default of 512 MiB for one instance:

    bun run load:conversation-attachments <email> [--organization <id or slug>]

  Each file is a one-page PDF just under 10 MiB, its bulk an embedded file of random bytes nothing
  compresses, so every upload streams the most a file holds into Storage and is read back whole. The
  backend reads files back one at a time, collecting its heap after each, which is what keeps it
  bounded: on 2026-10-12 a fresh development backend peaked at 433 MiB, from 220. It signs in to the Auth
  emulator as the account, as `send:conversation` does, uploads into a new draft, samples the
  backend's resident memory while the uploads go, removes the files after, and exits non-zero when
  an upload failed or the memory passed the bound.

  `bun run dev:backend` has to be running, on this machine, or the backend `API_URL` names, and the
  account must have fewer than 10 files waiting to be sent. Like `send:conversation`, it refuses to
  run unless it points at the emulators
*/
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'FIREBASE_AUTH_EMULATOR_HOST and DATA_CONNECT_EMULATOR_HOST are not set. This script only signs in to the emulators: run `bun run load:conversation-attachments`',
  )
  process.exit(1)
}

// How many uploads go at once, and the memory one instance has by default, in bytes
const UPLOADS = 20
const MEMORY_BOUND = 512 * 1024 * 1024

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: { organization: { type: 'string' } },
  allowPositionals: true,
})

const email = positionals[0]?.trim().toLowerCase()

if (!email) {
  console.error('Usage: bun run load:conversation-attachments <email> [--organization <id or slug>]')
  process.exit(1)
}

const apiUrl = process.env.API_URL ?? DEVELOPMENT_API_URL

function createId() {
  return randomUUID().replaceAll('-', '')
}

async function findOrganizationId(userId: string) {
  const { data } = await dataConnect.executeGraphql<
    { userOrganizations: { organizationId: string; organization: { slug: string | null } }[] },
    { userId: string }
  >(
    `query ReadMemberships($userId: String!) {
      userOrganizations(where: { userId: { eq: $userId } }) { organizationId organization { slug } }
    }`,
    { variables: { userId } },
  )
  const named = values.organization
  const membership = named
    ? data.userOrganizations.find(
        ({ organizationId, organization }) =>
          organizationId === named.replaceAll('-', '').toLowerCase() || organization.slug === named,
      )
    : data.userOrganizations.length === 1
      ? data.userOrganizations[0]
      : undefined

  if (!membership) {
    console.error(`Name one organization ${email} belongs to with --organization`)
    process.exit(1)
  }

  return membership.organizationId
}

async function signIn(userId: string) {
  const customToken = await authentication.createCustomToken(userId)
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )
  const { idToken } = (await response.json()) as { idToken?: string }

  if (!idToken) throw new Error(`The Auth emulator did not sign ${email} in: ${response.status}`)

  return idToken
}

// A one-page PDF just under the size a file may have, its bulk incompressible
async function buildLargestPdf() {
  const document = await PDFDocument.create()

  document.addPage()
  await document.attach(randomBytes(MAX_CONVERSATION_ATTACHMENT_SIZE - 64 * 1024), 'bulk.bin', {
    mimeType: 'application/octet-stream',
  })

  return new Uint8Array(await document.save())
}

// The resident memory of the process listening on the backend's port, in bytes
function readBackendMemory(pid: string) {
  return Number(execFileSync('ps', ['-o', 'rss=', '-p', pid]).toString().trim()) * 1024
}

const userId = (await authentication.getUserByEmail(email)).uid
const organizationId = await findOrganizationId(userId)
const idToken = await signIn(userId)
const pid = execFileSync('lsof', ['-t', '-iTCP:3003', '-sTCP:LISTEN']).toString().trim().split('\n')[0] ?? ''
const pdf = await buildLargestPdf()
const conversationId = createId()
const attachmentIds = Array.from({ length: UPLOADS }, createId)
const before = readBackendMemory(pid)
let peak = before

const sampler = setInterval(() => {
  peak = Math.max(peak, readBackendMemory(pid))
}, 50)

console.log(
  `Uploading ${UPLOADS} PDFs of ${pdf.length} bytes at once to ${apiUrl}, backend ${pid} at ${Math.round(before / 2 ** 20)} MiB`,
)

const started = Date.now()
const statuses = await Promise.all(
  attachmentIds.map(async attachmentId => {
    const response = await fetch(
      `${apiUrl}/organizations/${organizationId}/conversations/${conversationId}/attachments/${attachmentId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/pdf',
          'X-File-Name': encodeURIComponent(`Load ${attachmentId}.pdf`),
        },
        body: pdf,
      },
    )

    const answer = await response.text()

    return response.status === 201 ? 201 : `${response.status} ${answer}`
  }),
)

clearInterval(sampler)
peak = Math.max(peak, readBackendMemory(pid))

for (const attachmentId of attachmentIds) {
  await fetch(`${apiUrl}/organizations/${organizationId}/conversations/${conversationId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  })
}

const failed = statuses.filter(status => status !== 201)

console.log(`${UPLOADS - failed.length} of ${UPLOADS} stored in ${((Date.now() - started) / 1000).toFixed(1)} s`)
console.log(
  `Peak resident memory ${Math.round(peak / 2 ** 20)} MiB, ${Math.round((peak - before) / 2 ** 20)} MiB above where it started`,
)

if (failed.length) console.error(`Uploads answered ${failed.join(', ')}`)
if (peak > MEMORY_BOUND) console.error(`The backend passed ${MEMORY_BOUND / 2 ** 20} MiB`)
if (failed.length || peak > MEMORY_BOUND) process.exit(1)
