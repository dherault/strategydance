import { randomUUID } from 'node:crypto'
import { setTimeout as wait } from 'node:timers/promises'
import { parseArgs } from 'node:util'

import { MAX_SUBAGENTS_PER_ACTION, buildConversationTitle } from 'strategydance-core'

import { authentication, dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import launchSubagent from '~domain/subagents/launchSubagent'
import reconcileSubagentRuns from '~domain/subagents/reconcileSubagentRuns'

/*
  Launches a subagent of one of an account's conversations, in development, as Strategy Dance's
  agent will through the Subagents module, which no route serves yet:

    bun run launch:subagent <email> --conversation <id> [--count <n>] [--file <attachment id>]… <brief>

  It acts as the account with that address, which has to have signed in to the app once, on the
  conversation named, which has to be theirs and no subagent itself, in its organization. The brief
  is what the subagent knows of it, titled after its first line, and each `--file` an id of a file
  that conversation sent, which the subagent is handed. `--count` launches that many at once, 1 to
  10, the same brief each. Each launches with a key of its own, so each run of the script launches
  more subagents, on the conversation's latest anchor. Past the account's five subagent runs at
  once, a subagent waits for a slot, which the end of another's run promotes it into.

  The subagents' runs go in this process, as every run does in development, a run promoted or
  chained to included, so the script stays until every one has reported, printing each run as it
  waits for a slot, chains or ends, then prints each transcript, entry by entry, and its report. A
  promotion runs the subagent in the process of the run whose end freed its slot, so subagents of
  one account are launched together, from one script, rather than from scripts side by side. A run
  its worker left past its lease is reconciled as a parent's page would, finalized with its report
  and its slot promoted into, and the script gives up on one still past its lease after three
  reconciles, or that ended without a report, saying so. With
  `CONVERSATION_AGENT=placeholder` the runs answer with a stand-in reply, as `dev:backend` does;
  otherwise they ask Claude, which costs money.

  Like `serveModule.ts`, it refuses to run unless it points at the emulators, which the package's
  `launch:subagent` script does
*/
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'FIREBASE_AUTH_EMULATOR_HOST and DATA_CONNECT_EMULATOR_HOST are not set. This script only reads and writes the emulators: run `bun run launch:subagent`',
  )
  process.exit(1)
}

const USAGE =
  'Usage: bun run launch:subagent <email> --conversation <id> [--count <n>] [--file <attachment id>]… <brief>'

// How often it reads whether the subagent reported
const POLL_INTERVAL_MS = 2000

// How many reconciles a run may stay past its lease through before the script gives up on it
const MAX_RECONCILES = 3

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    conversation: { type: 'string' },
    count: { type: 'string' },
    file: { type: 'string', multiple: true },
  },
  allowPositionals: true,
})

// Firebase lowercases the addresses it stores
const email = positionals[0]?.trim().toLowerCase()
const brief = positionals.slice(1).join(' ')

const count = Number(values.count ?? 1)

if (
  !email
  || !values.conversation
  || !brief.trim()
  || !Number.isInteger(count)
  || count < 1
  || count > MAX_SUBAGENTS_PER_ACTION
) {
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
  conversationRuns: { number: number; status: string; leaseExpiresAt: string | null }[]
  conversationTranscriptEntries: { position: number; role: string; content: string }[]
}

// A conversation, its latest run and its transcript, as the emulator holds them
async function readConversation(conversationId: string) {
  const { data } = await dataConnect.executeGraphql<ConversationRead, { id: string }>(
    `query ReadConversation($id: UUID!) {
      conversation(id: $id) { userId organizationId parentId deletedAt report reportedAt }
      conversationRuns(where: { conversationId: { eq: $id } }, orderBy: [{ number: DESC }], limit: 1) {
        number
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

const subagentIds: string[] = []

for (let index = 0; index < count; index++) {
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

  subagentIds.push(result.subagentId)
}

// Each subagent's latest run as last printed, which a change of prints again, and how many
// reconciles its run has stayed past its lease through
const printed = new Map<string, string>()
const reconciles = new Map<string, number>()
const finished = new Map<string, ConversationRead>()

while (finished.size < subagentIds.length) {
  await wait(POLL_INTERVAL_MS)

  for (const subagentId of subagentIds) {
    if (finished.has(subagentId)) continue

    const read = await readConversation(subagentId)
    const [run] = read.conversationRuns
    const state = `run ${run?.number ?? '?'} ${run?.status ?? 'missing'}`

    if (printed.get(subagentId) !== state) {
      printed.set(subagentId, state)
      console.log(
        `Subagent ${subagentId}: ${state}${run?.status === 'PENDING' ? ', waiting for one of the five slots' : ''}`,
      )
    }

    const isInFlight = run?.status === 'QUEUED' || run?.status === 'RUNNING' || run?.status === 'PENDING'
    const isPastLease =
      (run?.status === 'QUEUED' || run?.status === 'RUNNING')
      && run.leaseExpiresAt !== null
      && Date.parse(run.leaseExpiresAt) < Date.now()

    if (read.conversation?.reportedAt || !isInFlight) {
      finished.set(subagentId, read)

      continue
    }

    if (!isPastLease) continue

    // Its worker left it, holding a slot: finalized with its report, and the run waiting promoted
    const count = (reconciles.get(subagentId) ?? 0) + 1

    reconciles.set(subagentId, count)

    if (count > MAX_RECONCILES) {
      finished.set(subagentId, read)

      continue
    }

    console.log(`Subagent ${subagentId}: its run is past its lease, reconciled`)

    await reconcileSubagentRuns({ organizationId: parent.organizationId, userId }).catch((error: unknown) => {
      console.error('The reconcile failed', error)
    })
  }
}

let hasFailed = false

for (const [subagentId, { conversation: subagent, conversationRuns, conversationTranscriptEntries }] of finished) {
  console.log(`\nSubagent ${subagentId}, its run ${conversationRuns[0]?.status ?? 'missing'}, its transcript:`)

  for (const entry of conversationTranscriptEntries) console.log(describeEntry(entry))

  if (!subagent?.reportedAt) {
    hasFailed = true
    console.error('\nIts run ended without a report, or stayed past its lease through three reconciles')

    continue
  }

  console.log(`\nIts report, written ${subagent.reportedAt}:\n\n${subagent.report ?? ''}`)
}

process.exit(hasFailed ? 1 : 0)
