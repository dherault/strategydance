import { parseArgs } from 'node:util'

import { DAILY_SPEND_CEILINGS } from '~constants'

import { dataConnect } from '~firebase'

import summarizeConversationUsage, {
  type ConversationUsageTotals,
  type ReportedConversationRun,
} from '~domain/conversations/summarizeConversationUsage'
import summarizeDailySpend, { type DailySpend, type ReportedRunSpend } from '~domain/conversations/summarizeDailySpend'

/*
  Prints what conversations cost over the last day, or the last `--days`, from the runs' ledgers,
  at list prices, as the credits will count them, which the decisions left for the recorded usage
  are taken with (Release gate and Usage caps in documents/conversations.md):

    bun run report:usage --production [--days <n>] [--workspace-usage <dollars>]   # the project, with Application Default Credentials
    DATA_CONNECT_EMULATOR_HOST=localhost:9399 bun run report:usage [--days <n>]   # the emulators

  It sums the runs started in the window by organization and by account, the subagents' runs apart,
  and prints the tokens each model used, every request Claude billed past its reservation, which the
  searches' allowance is raised from, and how long members paused before writing again, which the
  prompt cache's lifetime is chosen from. Then, whatever the window, the last 24 hours of each daily
  spend ceiling's scope against it, the member's in each organization, the account's and the
  organization's, from what each run may have cost (`RunSpend`), which the ceilings are set from.

  A deleted organization's runs go with it, so the ledgers cannot say everything the workspace was
  billed: `--workspace-usage` takes the workspace's own usage over the same window, read in the
  Anthropic Console, and the difference is printed as unattributed, deleted organizations' runs,
  development's and the probes', which read the same key, and the gap between the ledgers'
  estimates and the bill.

  It reads through the Admin SDK's own GraphQL, never a connector operation, so it reads a project
  whatever its release. It refuses to read the project unless told to with `--production`
*/
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { production: { type: 'boolean' }, days: { type: 'string' }, 'workspace-usage': { type: 'string' } },
})

if (!process.env.DATA_CONNECT_EMULATOR_HOST && !values.production) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set: pass --production to read the project, or point this at the emulators',
  )
  process.exit(1)
}

const days = Number(values.days ?? 1)
const workspaceDollars = values['workspace-usage'] === undefined ? null : Number(values['workspace-usage'])

if (!Number.isFinite(days) || days <= 0 || days > 90) {
  console.error('--days takes a number of days, more than 0 and at most 90')
  process.exit(1)
}

if (workspaceDollars !== null && (!Number.isFinite(workspaceDollars) || workspaceDollars < 0)) {
  console.error('--workspace-usage takes the dollars the Anthropic Console reads for the window, such as 12.34')
  process.exit(1)
}

// Runs read at once, a few hundred kilobytes of ledgers at most
const PAGE_SIZE = 500

const until = new Date()
const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000)

type Variables = { since: string; until: string; offset: number; limit: number }

// The window is fixed, and its runs ordered by when they were made, so pages follow each other
async function readRuns() {
  const runs: ReportedConversationRun[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data } = await dataConnect.executeGraphqlRead<{ conversationRuns: ReportedConversationRun[] }, Variables>(
      `query ReportUsage($since: Timestamp!, $until: Timestamp!, $offset: Int!, $limit: Int!) {
        conversationRuns(
          where: { createdAt: { ge: $since, lt: $until } }
          orderBy: [{ createdAt: ASC }, { id: ASC }]
          offset: $offset
          limit: $limit
        ) {
          id number trigger usage createdAt endedAt
          conversation { id userId organizationId parentId user { email } organization { name slug } }
        }
      }`,
      { variables: { since: since.toISOString(), until: until.toISOString(), offset, limit: PAGE_SIZE } },
    )

    runs.push(...data.conversationRuns)

    if (data.conversationRuns.length < PAGE_SIZE) return runs
  }
}

/*
  What every run may have cost that spent in the last 24 hours, as the ceilings sum it, with the
  names of the organizations still there. A project from before M39 has no such table, and says so
*/
async function readDailySpend() {
  const spends: ReportedRunSpend[] = []
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000).toISOString()

  try {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data } = await dataConnect.executeGraphqlRead<
        { runSpends: ReportedRunSpend[] },
        { since: string; offset: number; limit: number }
      >(
        `query ReportDailySpend($since: Timestamp!, $offset: Int!, $limit: Int!) {
          runSpends(where: { spentAt: { gt: $since } }, orderBy: [{ spentAt: ASC }, { runId: ASC }], offset: $offset, limit: $limit) {
            userId organizationId costBound user { email }
          }
        }`,
        { variables: { since, offset, limit: PAGE_SIZE } },
      )

      spends.push(...data.runSpends)

      if (data.runSpends.length < PAGE_SIZE) break
    }
  } catch (error) {
    console.log(`\nWhat runs may have cost could not be read, as before M39's release: ${String(error)}`)

    return null
  }

  const ids = [...new Set(spends.map(({ organizationId }) => organizationId))]
  const { data } = await dataConnect.executeGraphqlRead<
    { organizations: { id: string; name: string; slug: string | null }[] },
    { ids: string[] }
  >(
    `query ReportDailySpendOrganizations($ids: [UUID!]!) { organizations(where: { id: { in: $ids } }) { id name slug } }`,
    {
      variables: { ids },
    },
  )

  return {
    spends,
    organizations: new Map(data.organizations.map(organization => [organization.id.replaceAll('-', ''), organization])),
  }
}

function dollars(microdollars: number) {
  return `$${(microdollars / 1_000_000).toFixed(2)}`
}

function count(value: number) {
  return value.toLocaleString('en-US')
}

function table(head: string[], rows: string[][]) {
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function totalsRow(totals: ConversationUsageTotals) {
  return [
    count(totals.runs),
    dollars(totals.microdollars),
    count(totals.subagentRuns),
    dollars(totals.subagentMicrodollars),
    dollars(totals.microdollars + totals.subagentMicrodollars),
  ]
}

const TOTALS_HEAD = ["Members' runs", 'Cost', "Subagents' runs", 'Cost', 'Total']

const summary = summarizeConversationUsage(await readRuns())
const { total } = summary
const totalMicrodollars = total.microdollars + total.subagentMicrodollars

console.log(
  `Conversation usage from ${since.toISOString()} to ${until.toISOString()}, ${days === 1 ? 'one day' : `${days} days`}, at list prices\n`,
)
console.log(table(['', ...TOTALS_HEAD], [['All', ...totalsRow(total)]]))
console.log(`\nThe side requests tagging conversations, among them: ${dollars(total.taggingMicrodollars)}`)

if (workspaceDollars === null) {
  console.log(
    `\nRead the workspace's usage in the Anthropic Console for the same window, and pass it with --workspace-usage <dollars>: what the ledgers do not account for is printed as unattributed`,
  )
} else {
  const unattributed = workspaceDollars * 1_000_000 - totalMicrodollars

  console.log(
    `\nThe workspace's usage, read in the Anthropic Console: $${workspaceDollars.toFixed(2)}. Unattributed: ${dollars(unattributed)}, deleted organizations' runs, development's and the probes', and the gap between the ledgers' estimates and the bill`,
  )
}

console.log('\nBy organization\n')
console.log(
  table(
    ['Organization', ...TOTALS_HEAD],
    summary.organizations.map(organization => [
      `${organization.name} (${organization.slug ?? organization.organizationId})`,
      ...totalsRow(organization),
    ]),
  ),
)

console.log('\nBy account\n')
console.log(
  table(
    ['Account', ...TOTALS_HEAD],
    summary.accounts.map(account => [account.email, ...totalsRow(account)]),
  ),
)

const daily = await readDailySpend()

if (daily) {
  const spend = summarizeDailySpend(daily.spends, DAILY_SPEND_CEILINGS)
  const nameOrganization = (id: string | null) => {
    const organization = id ? daily.organizations.get(id.replaceAll('-', '')) : undefined

    return organization ? `${organization.name} (${organization.slug ?? organization.id})` : `(deleted) ${id}`
  }
  const row = (day: DailySpend, whose: string) => [
    whose,
    dollars(day.microdollars),
    dollars(day.ceiling),
    `${Math.round((day.microdollars / day.ceiling) * 100)}%`,
  ]
  const HEAD = ['Spent at most', 'Ceiling', 'Share']

  console.log(`\nThe daily spend ceilings, the last 24 hours to ${until.toISOString()}, the 20 nearest theirs\n`)
  console.log(
    table(
      ['Member in an organization', ...HEAD],
      spend.members
        .slice(0, 20)
        .map(day => row(day, `${day.email ?? day.userId} in ${nameOrganization(day.organizationId)}`)),
    ),
  )
  console.log('')
  console.log(
    table(
      ['Account', ...HEAD],
      spend.accounts.slice(0, 20).map(day => row(day, day.email ?? String(day.userId))),
    ),
  )
  console.log('')
  console.log(
    table(
      ['Organization', ...HEAD],
      spend.organizations.slice(0, 20).map(day => row(day, nameOrganization(day.organizationId))),
    ),
  )
}

console.log('\nBy model\n')
console.log(
  table(
    ['Model', 'Requests', 'Input', 'Cache reads', 'Cache writes', 'Output', 'Searches'],
    Object.entries(summary.byModel).map(([model, usage]) => [
      model,
      count(usage.requests),
      count(usage.inputTokens),
      count(usage.cacheReadInputTokens),
      count(usage.cacheCreationInputTokens),
      count(usage.outputTokens),
      count(usage.webSearchRequests),
    ]),
  ),
)

console.log('\nRequests Claude billed past their reservation\n')
console.log(
  summary.pastReservation.length
    ? table(
        ['Run', 'Model', 'Searches', 'Billed', 'Reserved', 'Brought back a search'],
        summary.pastReservation.map(request => [
          request.runId,
          request.model ?? '',
          count(request.webSearchRequests),
          dollars(request.billedMicrodollars),
          dollars(request.reservedMicrodollars),
          request.searchResultTokensPerSearch === null ? '' : `${count(request.searchResultTokensPerSearch)} tokens`,
        ]),
      )
    : 'None',
)

const pausedMessages = summary.pauses.reduce((sum, { messages }) => sum + messages, 0)
const PAUSE_NAMES = { underFiveMinutes: 'Under five minutes', underAnHour: 'Five minutes to an hour', longer: 'Longer' }

console.log("\nPauses before members' messages, from the end of the run before\n")
console.log(
  table(
    ['Pause', 'Messages', 'Share', 'Cache writes', 'Cache reads'],
    summary.pauses.map(bucket => [
      PAUSE_NAMES[bucket.bucket],
      count(bucket.messages),
      pausedMessages ? `${Math.round((bucket.messages / pausedMessages) * 100)}%` : '',
      count(bucket.cacheCreationInputTokens),
      count(bucket.cacheReadInputTokens),
    ]),
  ),
)

process.exit(0)
