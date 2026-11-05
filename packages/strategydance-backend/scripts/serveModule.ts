import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'

import { serveStdio } from '@modelcontextprotocol/server/stdio'
import {
  MAX_AGENT_CONNECTION_ORGANIZATIONS,
  MODULES,
  SERVED_MODULES,
  toOrganizationPathSegment,
} from 'strategydance-core'

import type { ModuleAccess } from '~types'

import { authentication, dataConnect } from '~firebase'

import MODULE_SERVERS from '~modules/moduleServers'

/*
  Serves a module over stdio, as one account of the emulators, so an MCP client on this machine,
  Claude Code say, reaches it before the authorization server exists. The package's scripts name the
  module, one each:

    bun run mcp:documents <email> [--organization <id or slug>]…
    bun run mcp:tasks <email> [--organization <id or slug>]…
    bun run mcp:budget <email> [--organization <id or slug>]…
    claude mcp add strategydance-documents-local -- bun run mcp:documents <email>
    claude mcp add strategydance-tasks-local -- bun run mcp:tasks <email>
    claude mcp add strategydance-budget-local -- bun run mcp:budget <email>

  A module served to no external agent, as Knowledge is, has no script, since no member adds it: run
  `bun scripts/serveModule.ts knowledge <email>` with the three emulators' variables set.

  It acts as the account with that address, which has to have signed in to the app once, in the
  organizations named, or in every one the account belongs to, up to as many as a connection
  reaches, with every scope of the module, as an external agent would: each call names the
  organization it acts in, and its results carry each document's or task's address on the local web
  app. Knowledge, whose tools name no organization, acts in the one named, or in the account's only
  one.
  Its idempotency keys are kept under a scope of its own, made each time it starts, as a connection's
  are.

  stdout is the protocol's, so everything else this process prints goes to stderr. Like
  `sendConversationMessage.ts`, it refuses to run unless it points at the emulators, Storage's
  included, where the Budget module writes the receipts an agent hands it, which the package's
  scripts do
*/
if (
  !process.env.FIREBASE_AUTH_EMULATOR_HOST
  || !process.env.DATA_CONNECT_EMULATOR_HOST
  || !process.env.FIREBASE_STORAGE_EMULATOR_HOST
) {
  console.error(
    'FIREBASE_AUTH_EMULATOR_HOST, DATA_CONNECT_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST are not all set. This script only reads and writes the emulators: run `bun run mcp:documents`, `bun run mcp:tasks` or `bun run mcp:budget`',
  )
  process.exit(1)
}

// The backend's logger writes its info lines to stdout, where they would break the protocol
console.log = console.error
console.info = console.error

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: { organization: { type: 'string', multiple: true } },
  allowPositionals: true,
})

// The module the package's script names, then the account
const served = MODULES.find(({ name }) => name === positionals[0])
// Firebase lowercases the addresses it stores
const email = positionals[1]?.trim().toLowerCase()

if (!served || !email || positionals.length > 2) {
  console.error(
    `Usage: bun run mcp:${served?.name ?? `<${MODULES.map(({ name }) => name).join(' | ')}>`} <email> [--organization <id or slug>]…`,
  )
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

// The memberships the module acts through, with their `createdAt`, which every operation matches
async function findMemberships(userId: string) {
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
  const named = values.organization ?? []
  const chosen = named.map(name =>
    memberships.find(
      ({ organizationId, organization }) =>
        organizationId === name.replaceAll('-', '').toLowerCase() || organization.slug === name,
    ),
  )
  const unknown = named.filter((_, index) => !chosen[index])

  if (unknown.length) {
    console.error(`${email} is not a member of ${unknown.join(', ')}`)
    process.exit(1)
  }

  const reached = named.length ? [...new Set(chosen.filter(membership => membership !== undefined))] : memberships
  const most =
    served && SERVED_MODULES.some(({ name }) => name === served.name) ? MAX_AGENT_CONNECTION_ORGANIZATIONS : 1

  if (reached.length && reached.length <= most) return reached

  console.error(
    memberships.length
      ? `${email} belongs to ${memberships.length} organizations, more than this module reaches at once (${most}): name ${most === 1 ? 'one' : 'some'} with --organization\n${memberships.map(({ organizationId, organization }) => `  ${organization.slug ?? organizationId}  ${organization.name}`).join('\n')}`
      : `${email} belongs to no organization yet`,
  )
  process.exit(1)
}

const userId = await findUserId()
const memberships = await findMemberships(userId)
const access: ModuleAccess = {
  kind: 'external',
  userId,
  scopes: [served.scopes.read, served.scopes.write],
  idempotencyScope: `connection:${randomUUID()}`,
  organizations: memberships.map(({ organizationId, createdAt, organization }) => ({
    organizationId,
    membershipCreatedAt: createdAt,
    segment: toOrganizationPathSegment({ id: organizationId, slug: organization.slug }),
    name: organization.name,
  })),
}

serveStdio(() => MODULE_SERVERS[served.name](access), {
  onerror: error => console.error(`${served.title} failed`, error),
})

console.error(
  `Serving ${served.title} over stdio as ${email} in ${memberships.map(({ organizationId, organization }) => organization.slug ?? organizationId).join(', ')}`,
)
