import {
  type ConversationModelUsage,
  type ConversationRequestUsage,
  chargeUnsettledRequests,
  parseConversationRunUsage,
} from '~domain/conversations/conversationRunUsage'
import { priceConversationRequest } from '~domain/conversations/priceConversationUsage'

// A run as the usage report reads it, with whose it is
export type ReportedConversationRun = {
  id: string
  number: number
  trigger: string
  usage: unknown
  createdAt: string
  endedAt: string | null
  conversation: {
    id: string
    userId: string
    organizationId: string
    parentId: string | null
    user: { email: string } | null
    organization: { name: string; slug: string | null } | null
  }
}

// What some runs cost, in microdollars, a member's conversations' runs and subagents' apart
export type ConversationUsageTotals = {
  runs: number
  subagentRuns: number
  microdollars: number
  subagentMicrodollars: number
  // The side requests that tag conversations, counted in the totals above too
  taggingMicrodollars: number
}

// A request Claude billed past what its reservation held the run's cost limit to
export type RequestPastReservation = {
  runId: string
  conversationId: string
  model: string | null
  webSearchRequests: number
  billedMicrodollars: number
  reservedMicrodollars: number
  // What each of its searches brought back past its readings of the input, which the searches'
  // allowance (`WEB_SEARCH_RESULT_TOKEN_ALLOWANCE`) is set from, or null for a request without one
  searchResultTokensPerSearch: number | null
}

// How long members waited before writing again, by the lifetimes the prompt cache can be given
export type ConversationPauseBucket = {
  // Under five minutes, under an hour, or longer
  bucket: 'underFiveMinutes' | 'underAnHour' | 'longer'
  messages: number
  // What the first request answering each wrote to the cache and read from it
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
}

export type ConversationUsageSummary = {
  total: ConversationUsageTotals
  organizations: (ConversationUsageTotals & { organizationId: string; name: string; slug: string | null })[]
  accounts: (ConversationUsageTotals & { userId: string; email: string })[]
  byModel: Record<string, ConversationModelUsage>
  pastReservation: RequestPastReservation[]
  pauses: ConversationPauseBucket[]
}

const FIVE_MINUTES_MS = 5 * 60 * 1000

const AN_HOUR_MS = 60 * 60 * 1000

/*
  Sums the ledgers of some runs as the credits will count them, at list prices, each request
  settled or charged at its estimate (`chargeUnsettledRequests`), by organization and by account,
  the subagents' runs apart, and the tagging side requests among them. Beside the totals, what the
  decisions left for the recorded usage read: the tokens each model used, every request whose
  billed usage passed its reservation, which raises the searches' allowance, and how long members
  paused before writing again, which the prompt cache's lifetime is chosen from: a member's message
  is measured from the end of the run before it in the same conversation, when both are among the
  runs read
*/
function summarizeConversationUsage(runs: ReportedConversationRun[]): ConversationUsageSummary {
  const total = createTotals()
  const organizations = new Map<string, ConversationUsageSummary['organizations'][number]>()
  const accounts = new Map<string, ConversationUsageSummary['accounts'][number]>()
  const byModel: Record<string, ConversationModelUsage> = {}
  const pastReservation: RequestPastReservation[] = []

  for (const run of runs) {
    const { conversation } = run
    const isSubagent = conversation.parentId !== null
    const ledger = parseConversationRunUsage(run.usage)
    const charged = chargeUnsettledRequests(ledger)
    const prices = charged.requests.map(priceConversationRequest)
    const microdollars = sum(prices)
    const taggingMicrodollars = sum(prices.filter((_, index) => charged.requests[index]?.purpose === 'tagging'))
    const organization = getOrCreate(organizations, conversation.organizationId, () => ({
      ...createTotals(),
      organizationId: conversation.organizationId,
      name: conversation.organization?.name ?? '(deleted)',
      slug: conversation.organization?.slug ?? null,
    }))
    const account = getOrCreate(accounts, conversation.userId, () => ({
      ...createTotals(),
      userId: conversation.userId,
      email: conversation.user?.email ?? '(deleted)',
    }))

    for (const totals of [total, organization, account]) {
      totals[isSubagent ? 'subagentRuns' : 'runs']++
      totals[isSubagent ? 'subagentMicrodollars' : 'microdollars'] += microdollars
      totals.taggingMicrodollars += taggingMicrodollars
    }

    for (const [model, usage] of Object.entries(charged.byModel)) addModelUsage(byModel, model, usage)

    for (const request of ledger.requests) {
      const past = readPastReservation(run, request)

      if (past) pastReservation.push(past)
    }
  }

  return {
    total,
    organizations: [...organizations.values()].toSorted(byCost),
    accounts: [...accounts.values()].toSorted(byCost),
    byModel,
    pastReservation: pastReservation.toSorted((a, b) => b.billedMicrodollars - a.billedMicrodollars),
    pauses: readPauses(runs),
  }
}

function createTotals(): ConversationUsageTotals {
  return { runs: 0, subagentRuns: 0, microdollars: 0, subagentMicrodollars: 0, taggingMicrodollars: 0 }
}

function getOrCreate<Value>(map: Map<string, Value>, key: string, create: () => Value) {
  const existing = map.get(key)

  if (existing) return existing

  const created = create()

  map.set(key, created)

  return created
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

// The costliest first, a member's runs and their subagents' together
function byCost(a: ConversationUsageTotals, b: ConversationUsageTotals) {
  return b.microdollars + b.subagentMicrodollars - (a.microdollars + a.subagentMicrodollars)
}

function addModelUsage(byModel: Record<string, ConversationModelUsage>, model: string, usage: ConversationModelUsage) {
  const totals = (byModel[model] ??= {
    requests: 0,
    inputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    outputTokens: 0,
    webSearchRequests: 0,
  })

  totals.requests += usage.requests
  totals.inputTokens += usage.inputTokens
  totals.cacheReadInputTokens += usage.cacheReadInputTokens
  totals.cacheCreationInputTokens += usage.cacheCreationInputTokens
  totals.outputTokens += usage.outputTokens
  totals.webSearchRequests += usage.webSearchRequests
}

// A request Claude's answer settled past the worst case its reservation recorded, or null
function readPastReservation(
  run: ReportedConversationRun,
  request: ConversationRequestUsage,
): RequestPastReservation | null {
  if (!request.isSettled || request.isEstimated || request.worstCaseMicrodollars === undefined) return null

  const billedMicrodollars = priceConversationRequest(request)

  if (billedMicrodollars <= request.worstCaseMicrodollars) return null

  const input = request.inputTokens + request.cacheReadInputTokens + request.cacheCreationInputTokens
  const searches = request.webSearchRequests

  return {
    runId: run.id,
    conversationId: run.conversation.id,
    model: request.model,
    webSearchRequests: searches,
    billedMicrodollars,
    reservedMicrodollars: request.worstCaseMicrodollars,
    searchResultTokensPerSearch: searches
      ? Math.max(0, Math.round((input - (1 + searches) * request.estimatedInputTokens) / searches))
      : null,
  }
}

/*
  How long members paused before each message, from the end of the run before it in the same
  conversation, with what the first request answering it wrote to the cache and read from it: a
  pause past the cache's lifetime writes the whole conversation to it again
*/
function readPauses(runs: ReportedConversationRun[]): ConversationPauseBucket[] {
  const buckets: ConversationPauseBucket[] = (['underFiveMinutes', 'underAnHour', 'longer'] as const).map(bucket => ({
    bucket,
    messages: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  }))
  const byConversation = new Map<string, ReportedConversationRun[]>()

  for (const run of runs) getOrCreate(byConversation, run.conversation.id, () => []).push(run)

  for (const conversationRuns of byConversation.values()) {
    const ordered = conversationRuns.toSorted((a, b) => a.number - b.number)

    for (const [index, run] of ordered.entries()) {
      const previous = ordered[index - 1]

      if (run.trigger !== 'MESSAGE' || !previous?.endedAt || previous.number !== run.number - 1) continue

      const pauseMs = Date.parse(run.createdAt) - Date.parse(previous.endedAt)
      const bucket = buckets[pauseMs < FIVE_MINUTES_MS ? 0 : pauseMs < AN_HOUR_MS ? 1 : 2]!
      const [first] = parseConversationRunUsage(run.usage).requests.filter(({ purpose }) => purpose !== 'tagging')

      bucket.messages++
      bucket.cacheCreationInputTokens += first?.cacheCreationInputTokens ?? 0
      bucket.cacheReadInputTokens += first?.cacheReadInputTokens ?? 0
    }
  }

  return buckets
}

export default summarizeConversationUsage
