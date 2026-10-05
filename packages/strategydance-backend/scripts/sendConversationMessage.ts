import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'

import { DEVELOPMENT_API_URL, DEVELOPMENT_APP_URL } from 'strategydance-core'

import { authentication, dataConnect } from '~firebase'

/*
  Sends a message to a conversation through the backend, as the page's composer will, in
  development:

    bun run send:conversation <email> [--organization <id>] [--conversation <id>] <text>

  It signs in to the Auth emulator as the account with that address, which has to have signed in
  to the app once and be staff (`bun run grant:administrator <email>`), and sends the text to the
  conversation named, or to a new one, in the organization named, or in the only one the account
  belongs to. It prints what the backend answered and the conversation's address, where the page
  shows the reply arrive. `bun run dev:backend` has to be running, or the backend `API_URL` names.

  Like `grantAdministrator.ts`, it refuses to run unless it points at the emulators, which the
  package's `send:conversation` script does
*/
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'FIREBASE_AUTH_EMULATOR_HOST and DATA_CONNECT_EMULATOR_HOST are not set. This script only signs in to the emulators: run `bun run send:conversation`',
  )
  process.exit(1)
}

const USAGE = 'Usage: bun run send:conversation <email> [--organization <id>] [--conversation <id>] <text>'

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    organization: { type: 'string' },
    conversation: { type: 'string' },
  },
  allowPositionals: true,
})

// Firebase lowercases the addresses it stores
const email = positionals[0]?.trim().toLowerCase()
const text = positionals.slice(1).join(' ')

if (!email || !text) {
  console.error(USAGE)
  process.exit(1)
}

const apiUrl = process.env.API_URL ?? DEVELOPMENT_API_URL

// Dashless, as Data Connect writes a UUID back, and as the page makes its ids
function createId() {
  return randomUUID().replaceAll('-', '')
}

async function findUserId() {
  try {
    return (await authentication.getUserByEmail(email ?? '')).uid
  } catch {
    console.error(`Nobody has signed up as ${email} in the emulators yet. Sign up once, then run this again`)
    process.exit(1)
  }
}

async function findOrganizationId(userId: string) {
  const { data } = await dataConnect.executeGraphql<
    { userOrganizations: { organizationId: string; organization: { name: string } }[] },
    { userId: string }
  >(
    `query ReadMemberships($userId: String!) {
      userOrganizations(where: { userId: { eq: $userId } }) { organizationId organization { name } }
    }`,
    { variables: { userId } },
  )
  const memberships = data.userOrganizations

  if (values.organization) return values.organization

  if (memberships.length === 1 && memberships[0]) return memberships[0].organizationId

  console.error(
    memberships.length
      ? `${email} belongs to several organizations: name one with --organization\n${memberships.map(({ organizationId, organization }) => `  ${organizationId}  ${organization.name}`).join('\n')}`
      : `${email} belongs to no organization yet`,
  )
  process.exit(1)
}

// An ID token for the account, from the Auth emulator, which takes a custom token the Admin SDK
// makes without signing it
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

const userId = await findUserId()
const organizationId = await findOrganizationId(userId)
const conversationId = values.conversation ?? createId()
const idToken = await signIn(userId)

let response: Response

try {
  response = await fetch(`${apiUrl}/organizations/${organizationId}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId: createId(), text }),
  })
} catch {
  console.error(`The backend does not answer on ${apiUrl}: start it with \`bun run dev:backend\``)
  process.exit(1)
}

console.log(`${response.status} ${JSON.stringify(await response.json())}`)
console.log(`${DEVELOPMENT_APP_URL}/conversations/${conversationId}`)

if (!response.ok) process.exit(1)
