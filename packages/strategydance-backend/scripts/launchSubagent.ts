import { randomUUID } from 'node:crypto'
import { setTimeout as wait } from 'node:timers/promises'
import { parseArgs } from 'node:util'

import { buildConversationTitle } from 'strategydance-core'

import { authentication, dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import launchSubagent from '~domain/subagents/launchSubagent'

/*
  Launches a subagent of one of an account's conversations, in development, as Strategy Dance's
  agent will through the Subagents module, which no route serves yet:

    bun run launch:subagent <email> --conversation <id> [--file <attachment id>]… <brief>

  It acts as the account with that address, which has to have signed in to the app once, on the
  conversation named, which has to be theirs and no subagent itself, in its organization. The brief
  is what the subagent knows of it, titled after its first line, and each `--file` an id of a file
  that conversation sent, which the subagent is handed. It launches with a key of its own, so each
  run of the script launches another subagent, on the conversation's latest anchor.

  The subagent's run goes in this process, as every run does in development, so the script stays
  until it reports, then prints its transcript, entry by entry, and its report. It stops sooner,
  saying so, once the run ends without a report or is left past its lease, which nothing finalizes
  yet. With `CONVERSATION_AGENT=placeholder` the run answers with a stand-in reply, as
  `dev:backend` does; otherwise it asks Claude, which costs money.

  Like `serveModule.ts`, it refuses to run unless it points at the emulators, which the package's
  `launch:subagent` script does
*/
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'FIREBASE_AUTH_EMULATOR_HOST and DATA_CONNECT_EMULATOR_HOST are not set. This script only reads and writes the emulators: run `bun run launch:subagent`',
  )
  process.exit(1)
}

const USAGE = 'Usage: bun run launch:subagent <email> --conversation <id> [--file <attachment id>]… <brief>'

// How often it reads whether the subagent reported
const POLL_INTERVAL_MS = 2000

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    conversation: { type: 'string' },
    file: { type: 'string', multiple: true },
  },
  allowPositionals: true,
})

// Firebase lowercases the addresses it stores
const email = positionals[0]?.trim().toLowerCase()
const brief = positionals.slice(1).join(' ')

if (!email || !values.conversation || !brief.trim()) {
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

type ConversationRead = {
  conversation: {
    userId: string
    organizationId: string
    parentId: string | null
    deletedAt: string | null
    report: string | null
    reportedAt: string | null
  } | null
  conversationRuns: { status: string; leaseExpiresAt: string | null }[]
  conversationTranscriptEntries: { position: number; role: string; content: string }[]
}

// A conversation, its latest run and its transcript, as the emulator holds them
async function readConversation(conversationId: string) {
  const { data } = await dataConnect.executeGraphql<ConversationRead, { id: string }>(
    `query ReadConversation($id: UUID!) {
      conversation(id: $id) { userId organizationId parentId deletedAt report reportedAt }
      conversationRuns(where: { conversationId: { eq: $id } }, orderBy: [{ number: DESC }], limit: 1) {
        status
        leaseExpiresAt
      }
      conversationTranscriptEntries(where: { conversationId: { eq: $id } }, orderBy: [{ position: ASC }], limit: 1000) {
        position
        role
        content
      }
    }`,
    { variables: { id: conversationId } },
  )

  return data
}

// One line an entry of the transcript is printed as: its position, its role and each block, a text
// cut short, a call by its tool and a file by its id
function describeEntry({ position, role, content }: ConversationRead['conversationTranscriptEntries'][number]) {
  const blocks = JSON.parse(content) as Record<string, unknown>[]
  const described = blocks.map(block => {
    if (block.type === 'text') return JSON.stringify(String(block.text).slice(0, 160))
    if (block.type === 'tool_use' || block.type === 'server_tool_use') return `${block.type} ${String(block.name)}`
    if (block.type === 'image' || block.type === 'document') {
      return `${block.type} ${String((block.source as { file_id?: string } | undefined)?.file_id ?? '')}`
    }

    return String(block.type)
  })

  return `  ${position} ${role}: ${described.join(', ')}`
}

const userId = await findUserId()
const parentId = toCanonicalUuid(values.conversation)
const { conversation: parent } = await readConversation(parentId)

if (!parent || parent.userId !== userId || parent.deletedAt || parent.parentId) {
  console.error(`${values.conversation} is no conversation of ${email}'s that can launch a subagent`)
  process.exit(1)
}

const result = await launchSubagent({
  organizationId: parent.organizationId,
  userId,
  parentId,
  key: randomUUID(),
  title: buildConversationTitle(brief),
  brief,
  attachmentIds: (values.file ?? []).map(toCanonicalUuid),
})

console.log(`The launch answered ${result.outcome}`, result)

if (result.outcome !== 'launched' && result.outcome !== 'unavailable') process.exit(1)

for (;;) {
  await wait(POLL_INTERVAL_MS)

  const {
    conversation: subagent,
    conversationRuns,
    conversationTranscriptEntries,
  } = await readConversation(result.subagentId)
  const [run] = conversationRuns
  const isInFlight = run?.status === 'QUEUED' || run?.status === 'RUNNING'
  const isPastLease =
    run?.status === 'RUNNING' && run.leaseExpiresAt !== null && Date.parse(run.leaseExpiresAt) < Date.now()

  if (!subagent?.reportedAt && isInFlight && !isPastLease) continue

  console.log(`\nSubagent ${result.subagentId}, its run ${run?.status ?? 'missing'}, its transcript:`)

  for (const entry of conversationTranscriptEntries) console.log(describeEntry(entry))

  if (!subagent?.reportedAt) {
    console.error(
      isPastLease
        ? '\nIts run is past its lease, left by its worker, and nothing finalizes it yet'
        : '\nIts run ended without a report',
    )
    process.exit(1)
  }

  console.log(`\nIts report, written ${subagent.reportedAt}:\n\n${subagent.report ?? ''}`)
  process.exit(0)
}
