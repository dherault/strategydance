import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'

import { serveStdio } from '@modelcontextprotocol/server/stdio'

import type { ModuleCaller } from '~types'

import { authentication, dataConnect } from '~firebase'

import createKnowledgeServer from '~modules/knowledge/createKnowledgeServer'

/*
  Serves the Knowledge module over stdio, as one account of the emulators, so an MCP client on this
  machine, Claude Code say, reaches it before the authorization server exists:

    bun run mcp:knowledge <email> [--organization <id or slug>]
    claude mcp add strategydance-knowledge-local -- bun run mcp:knowledge <email>

  It acts as the account with that address, which has to have signed in to the app once, in the
  organization named, or in the only one the account belongs to, with every scope, as an external
  agent would: its results carry each document's address on the local web app. Its idempotency keys
  are kept under a scope of its own, made each time it starts, as a connection's are.

  stdout is the protocol's, so everything else this process prints goes to stderr. Like
  `sendConversationMessage.ts`, it refuses to run unless it points at the emulators, which the
  package's `mcp:knowledge` script does
*/
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'FIREBASE_AUTH_EMULATOR_HOST and DATA_CONNECT_EMULATOR_HOST are not set. This script only reads and writes the emulators: run `bun run mcp:knowledge`',
  )
  process.exit(1)
}

// The backend's logger writes its info lines to stdout, where they would break the protocol
console.log = console.error
console.info = console.error

const USAGE = 'Usage: bun run mcp:knowledge <email> [--organization <id or slug>]'

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: { organization: { type: 'string' } },
  allowPositionals: true,
})

// Firebase lowercases the addresses it stores
const email = positionals[0]?.trim().toLowerCase()

if (!email || positionals.length > 1) {
  console.error(USAGE)
  process.exit(1)
}

async function findUserId() {
  try {
    return (await authentication.getUserByEmail(email ?? '')).uid
  } catch {
    console.error(`Nobody has signed up as ${email} in the emulators yet. Sign up once, then run this again`)
    process.exit(1)
  }
}

// The membership the module acts through, with its `createdAt`, which every operation matches
async function findMembership(userId: string) {
  const { data } = await dataConnect.executeGraphql<
    {
      userOrganizations: {
        organizationId: string
        createdAt: string
        organization: { name: string; slug: string | null }
      }[]
    },
    { userId: string }
  >(
    `query ReadMemberships($userId: String!) {
      userOrganizations(where: { userId: { eq: $userId } }) { organizationId createdAt organization { name slug } }
    }`,
    { variables: { userId } },
  )
  const memberships = data.userOrganizations
  const named = values.organization
  const membership = named
    ? memberships.find(
        ({ organizationId, organization }) =>
          organizationId === named.replaceAll('-', '').toLowerCase() || organization.slug === named,
      )
    : memberships.length === 1
      ? memberships[0]
      : undefined

  if (named && !membership) {
    console.error(`${email} is not a member of ${named}`)
    process.exit(1)
  }

  if (membership) return membership

  console.error(
    memberships.length
      ? `${email} belongs to several organizations: name one with --organization\n${memberships.map(({ organizationId, organization }) => `  ${organization.slug ?? organizationId}  ${organization.name}`).join('\n')}`
      : `${email} belongs to no organization yet`,
  )
  process.exit(1)
}

const userId = await findUserId()
const membership = await findMembership(userId)
const caller: ModuleCaller = {
  kind: 'external',
  userId,
  organizationId: membership.organizationId,
  membershipCreatedAt: membership.createdAt,
  scopes: ['knowledge:read', 'knowledge:write'],
  idempotencyScope: `connection:${randomUUID()}`,
}

serveStdio(() => createKnowledgeServer(caller), {
  onerror: error => console.error('The Knowledge module failed', error),
})

console.error(
  `Serving the Knowledge module over stdio as ${email} in ${membership.organization.slug ?? membership.organizationId}`,
)
