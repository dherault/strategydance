import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as wait } from 'node:timers/promises'
import { parseArgs } from 'node:util'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import {
  CompanyAspect,
  ConversationActor,
  TaskStatus,
  connectorConfig,
  startConversation,
} from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

import type { ConversationRequestSettings } from '~domain/agent/conversationRequestSettings'
import SUBAGENT_REPORT_REQUEST from '~domain/agent/subagentReportRequest'
import { parseConversationRunUsage } from '~domain/conversations/conversationRunUsage'
import priceConversationUsage from '~domain/conversations/priceConversationUsage'
import stopConversationRun from '~domain/conversations/stopConversationRun'
import createKnowledgeDocument from '~domain/knowledge/createKnowledgeDocument'
import launchSubagent from '~domain/subagents/launchSubagent'
import reconcileSubagentRuns from '~domain/subagents/reconcileSubagentRuns'
import stopConversationSubagents from '~domain/subagents/stopConversationSubagents'
import createTask from '~domain/tasks/createTask'

/*
  Measures what a subagent costs and does on each model and effort David weighs for subagents, as
  M33 asks, before he chooses (`SUBAGENT_REQUEST_SETTINGS`):

    bun run measure:subagents [--configurations <name,…>] [--max-total <dollars>] [--max-subagent <dollars>]

  Three short briefs, each meant to end within one run, a piece of web research, a task read from
  the board and planned in its description, and a document written from what the knowledge holds,
  each run as a subagent on each configuration: Opus 5.5 at medium effort, today's, Opus 5.5 at low,
  Sonnet 5.5 at medium, and Opus 5.5 at medium with a task budget. Twelve subagents, as David chose
  on 2026-10-17 over the eighteen M33 first planned.

  Cheap by design: the script launches each subagent itself, on a parent of each configuration's
  whose own run never goes, so no parent's request is paid, and runs each configuration's three back
  to back, so they share the cached system prompt and tools. Each subagent is asked to stop once its ledger, priced at list
  prices, passes `--max-subagent` (1 dollar), and the script launches nothing more, and stops what
  goes, once the total passes `--max-total` (15 dollars). A stop lands within a request, so the
  caps bound the spend to about one request over.

  Each subagent records its tokens from its ledger, priced, its requests, how many runs it chained,
  whether its last run asked for its report, how it ended, its time and its report, printed as a
  table and written whole to `--out` (the OS temp directory by default) as JSON.

  It makes a throwaway account and organization in the emulators, as the checks do, and leaves them
  for the transcripts to be read. Its subagents run in this process, as every run does in
  development. With `CONVERSATION_AGENT=placeholder` the runs answer with a stand-in reply and cost
  nothing, which tries the script; otherwise they ask Claude, which costs money. It refuses to run
  unless it points at the emulators, which the package's `measure:subagents` script does
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run measure:subagents`',
  )
  process.exit(1)
}

// How often it reads where each subagent stands
const POLL_INTERVAL_MS = 2000

// How long a subagent may take before the script stops it, whatever it costs
const MAX_SUBAGENT_DURATION_MS = 15 * 60 * 1000

// The task budget the budgeted configuration paces its subagents by, in tokens
const TASK_BUDGET = 50000

type Configuration = { name: string; settings: ConversationRequestSettings }

const CONFIGURATIONS: Configuration[] = [
  { name: 'opus-medium', settings: { model: 'claude-opus-5-5', effort: 'medium', taskBudget: null } },
  { name: 'opus-low', settings: { model: 'claude-opus-5-5', effort: 'low', taskBudget: null } },
  { name: 'sonnet-medium', settings: { model: 'claude-sonnet-5-5', effort: 'medium', taskBudget: null } },
  { name: 'opus-medium-budget', settings: { model: 'claude-opus-5-5', effort: 'medium', taskBudget: TASK_BUDGET } },
]

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    configurations: { type: 'string' },
    'max-total': { type: 'string' },
    'max-subagent': { type: 'string' },
    out: { type: 'string' },
  },
})

const configurations = values.configurations
  ? CONFIGURATIONS.filter(({ name }) => values.configurations?.split(',').includes(name))
  : CONFIGURATIONS
const maxTotal = Number(values['max-total'] ?? 15)
const maxSubagent = Number(values['max-subagent'] ?? 1)
const outDirectory = values.out ?? `${process.env.TMPDIR ?? '/tmp'}/measure-subagents`

// The browser's connector, on an app of its own, as `checkConversationList.ts` explains
const webConnector = getDataConnect(
  { ...connectorConfig, connector: 'strategydance-web-connector' },
  initializeApp({ projectId: FIREBASE_PROJECT_ID }, 'web-connector'),
)

function createId() {
  return randomUUID().replaceAll('-', '')
}

const measureId = createId().slice(0, 8)
const userId = `measure-subagents-${measureId}`
const organizationId = createId()

async function write(query: string, variables: Record<string, unknown> = {}) {
  await dataConnect.executeGraphql(query, { variables })
}

// The member the subagents act as, signed up as the app has one do, in an organization of their own
async function setUp() {
  await webConnector.executeMutation(
    'CreateCurrentUser',
    { locale: 'EN', authenticationProviders: [] },
    { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } },
  )
  await write(
    `mutation SetUp($organizationId: UUID!, $userId: String!) {
      organization_insert(data: { id: $organizationId, name: "Measured organization", brief: "A small studio selling project management software to agencies." })
      userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: ADMINISTRATOR })
    }`,
    { organizationId, userId },
  )

  const { data } = await dataConnect.executeGraphql<
    { userOrganization: { createdAt: string } | null },
    Record<string, unknown>
  >(
    `query Membership($organizationId: UUID!, $userId: String!) {
      userOrganization(key: { userId: $userId, organizationId: $organizationId }) { createdAt }
    }`,
    { variables: { organizationId, userId } },
  )

  if (!data.userOrganization) throw new Error('The membership was not made')

  return data.userOrganization.createdAt
}

// The member as a module's caller, which the seeds are written through
function toCaller(membershipCreatedAt: string): ModuleCaller {
  return {
    kind: 'agent',
    userId,
    organizationId,
    membershipCreatedAt,
    scopes: ['knowledge:read', 'knowledge:write', 'tasks:read', 'tasks:write'],
    idempotencyScope: `measure:${measureId}`,
  }
}

// What the briefs work on: a task on the board and a document in the knowledge
async function seed(caller: ModuleCaller) {
  const task = await createTask(
    caller,
    {
      name: 'Draft the onboarding email for new agencies',
      status: TaskStatus.TODO,
      description: 'The first email an agency gets once it signs up.',
      assignee: 'agent',
    },
    null,
  )
  const document = await createKnowledgeDocument(
    caller,
    {
      title: 'Pricing notes',
      aspects: [CompanyAspect.FINANCES],
      content: [
        'We sell seats at 12 euros a month each, billed monthly.',
        '',
        'Agencies above ten seats asked for a yearly plan with two months free.',
        '',
        'Our two closest competitors charge 10 and 15 euros a seat.',
        '',
        'Churn is highest in the second month, when the trial credits run out.',
      ].join('\n'),
    },
    null,
  )

  if (task.outcome !== 'written' || document.outcome !== 'written') {
    throw new Error(`Seeding answered ${task.outcome} and ${document.outcome}`)
  }

  return { taskId: task.result.id, documentId: document.result.id }
}

// The three briefs, each meant to end within one run
function buildBriefs({ taskId, documentId }: { taskId: string; documentId: string }) {
  return [
    {
      name: 'research',
      text: 'Find what Linear and Notion each charge a month for their Business plan, as their pricing pages say today, with a link to each page. Write nothing into the knowledge or the tasks. Report the two prices and links in at most 120 words.',
    },
    {
      name: 'task',
      text: `Read the task ${taskId} on the board. Replace its description with what it says now followed by a plan of three short steps to do it. Do not move it, assign it or change anything else of it. Report what you wrote.`,
    },
    {
      name: 'document',
      text: `Read the document ${documentId} in the knowledge. Create a new document titled "Pricing summary" holding a summary of it in five bullets, tagged with the aspects it is about. Change nothing else. Report the new document's link.`,
    },
  ]
}

// A parent the subagents are launched from, whose own run never goes, so no parent's request is paid
async function startParent(membershipCreatedAt: string) {
  const parent = { organizationId, userId, conversationId: createId(), runId: createId() }

  await startConversation(dataConnect, {
    ...parent,
    membershipCreatedAt,
    messageId: createId(),
    title: 'Measuring subagents',
    text: 'Measure the subagents.',
    preview: { kind: 'MEMBER_TEXT', text: 'Measure the subagents.' },
    content: JSON.stringify([{ type: 'text', text: 'Measure the subagents.' }]),
    aspects: [CompanyAspect.PRODUCT],
    aspectsSetBy: ConversationActor.MEMBER,
  })

  return parent
}

type SubagentRead = {
  conversation: { report: string | null; reportedAt: string | null } | null
  conversationRuns: { number: number; status: string; usage: unknown; leaseExpiresAt: string | null }[]
  conversationTranscriptEntries: { content: string }[]
}

async function readSubagent(conversationId: string) {
  const { data } = await dataConnect.executeGraphql<SubagentRead, { id: string }>(
    `query ReadSubagent($id: UUID!) {
      conversation(id: $id) { report reportedAt }
      conversationRuns(where: { conversationId: { eq: $id } }, orderBy: [{ number: ASC }], limit: 10) {
        number
        status
        usage
        leaseExpiresAt
      }
      conversationTranscriptEntries(where: { conversationId: { eq: $id }, role: { eq: USER } }, orderBy: [{ position: DESC }], limit: 1) {
        content
      }
    }`,
    { variables: { id: conversationId } },
  )

  return data
}

// What a subagent's runs used, from their ledgers, priced at list prices (`priceConversationUsage`)
function measure(runs: SubagentRead['conversationRuns']) {
  const totals = { requests: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, webSearches: 0, cost: 0 }

  for (const run of runs) {
    const ledger = parseConversationRunUsage(run.usage)

    for (const usage of Object.values(ledger.byModel)) {
      totals.requests += usage.requests
      totals.input += usage.inputTokens
      totals.cacheRead += usage.cacheReadInputTokens
      totals.cacheWrite += usage.cacheCreationInputTokens
      totals.output += usage.outputTokens
      totals.webSearches += usage.webSearchRequests
    }

    totals.cost += priceConversationUsage(ledger) / 1_000_000
  }

  return totals
}

const membershipCreatedAt = await setUp()
const caller = toCaller(membershipCreatedAt)
const briefs = buildBriefs(await seed(caller))
const records: Record<string, unknown>[] = []
let total = 0
let isOverTotal = false

console.log(`Measuring as ${userId} in ${organizationId}`)

for (const configuration of configurations) {
  if (isOverTotal) break

  // A parent of its own, since a parent launches at most 10 subagents on one anchor
  const parent = await startParent(membershipCreatedAt)

  // Read by each run of a subagent's, in this process
  process.env.SUBAGENT_REQUEST_SETTINGS = JSON.stringify(configuration.settings)

  for (const brief of briefs) {
    if (total >= maxTotal) {
      isOverTotal = true

      break
    }

    const launched = await launchSubagent({
      organizationId,
      userId,
      parentId: parent.conversationId,
      key: randomUUID(),
      title: `${configuration.name}: ${brief.name}`,
      brief: brief.text,
      attachmentIds: [],
    })

    if (launched.outcome !== 'launched' && launched.outcome !== 'unavailable') {
      throw new Error(`The launch answered ${launched.outcome}`)
    }

    const startedAt = Date.now()
    let isAskedToStop = false
    let read = await readSubagent(launched.subagentId)

    while (!read.conversation?.reportedAt) {
      await wait(POLL_INTERVAL_MS)

      read = await readSubagent(launched.subagentId)

      // A run its worker left past its lease is finalized with its report, as a parent's page would
      const latest = read.conversationRuns.at(-1)

      if (latest?.leaseExpiresAt && Date.parse(latest.leaseExpiresAt) < Date.now()) {
        await reconcileSubagentRuns({ organizationId, userId })
      }

      const cost = measure(read.conversationRuns).cost
      const isOverCap = cost > maxSubagent || total + cost > maxTotal
      const isTooLong = Date.now() - startedAt > MAX_SUBAGENT_DURATION_MS

      if ((isOverCap || isTooLong) && !isAskedToStop) {
        console.log(`Stopping ${configuration.name}/${brief.name} at $${cost.toFixed(3)}`)
        isAskedToStop = true
        await stopConversationSubagents(parent, { subagentIds: [launched.subagentId] })
      }
    }

    const measured = measure(read.conversationRuns)
    const lastEntry = read.conversationTranscriptEntries[0]?.content ?? ''
    const record = {
      configuration: configuration.name,
      ...configuration.settings,
      brief: brief.name,
      subagentId: launched.subagentId,
      ...measured,
      cost: Number(measured.cost.toFixed(4)),
      runs: read.conversationRuns.length,
      endings: read.conversationRuns.map(({ status }) => status),
      isReportAsked: lastEntry.includes(SUBAGENT_REPORT_REQUEST),
      isStoppedAtCap: isAskedToStop,
      seconds: Math.round((Date.now() - startedAt) / 1000),
      report: read.conversation.report,
    }

    total += measured.cost
    records.push(record)
    console.log(
      `${configuration.name}/${brief.name}: $${record.cost} in ${record.requests} requests, ${record.runs} run(s), ${record.seconds}s, total $${total.toFixed(3)}`,
    )
  }

  // Its own run, queued since it was made, never went: it ends stopped, launching nothing, and frees
  // one of the member's 3 runs for the next parent
  await stopConversationRun(parent)
}

mkdirSync(outDirectory, { recursive: true })

const outPath = `${outDirectory}/measure-subagents-${measureId}.json`

writeFileSync(outPath, JSON.stringify({ total, records }, null, 2))

console.log(
  '\n| Configuration | Brief | Requests | Input | Cache read | Cache write | Output | Searches | Runs | Report asked | Seconds | Cost |',
)
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')

for (const record of records) {
  console.log(
    `| ${String(record.configuration)} | ${String(record.brief)} | ${String(record.requests)} | ${String(record.input)} | ${String(record.cacheRead)} | ${String(record.cacheWrite)} | ${String(record.output)} | ${String(record.webSearches)} | ${String(record.runs)} | ${record.isReportAsked ? 'yes' : 'no'} | ${String(record.seconds)} | $${String(record.cost)} |`,
  )
}

console.log(
  `\nTotal: $${total.toFixed(3)}${isOverTotal ? `, stopped at the $${maxTotal} cap` : ''}. Written to ${outPath}`,
)

process.exit(0)
