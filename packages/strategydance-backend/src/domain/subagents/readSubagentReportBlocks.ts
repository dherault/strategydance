import { type ConversationRunStatus, getSubagentWritesForAgent } from 'strategydance-database/backend'

import type { ConversationTextBlock } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import toConversationModuleScope from '~domain/agent/toConversationModuleScope'
import buildSubagentReportBlock from '~domain/subagents/buildSubagentReportBlock'
import toSubagentStatus from '~domain/subagents/toSubagentStatus'
import toSubagentWrite from '~domain/subagents/toSubagentWrite'

// How many of a subagent's writes its report names, `read_subagent` paging the rest
const MAX_REPORT_WRITES = 20

// The instant the writes are read past, before anything was written
const FIRST_WRITE_AFTER = '1970-01-01T00:00:00Z'

type ReportedSubagent = {
  id: string
  title: string
  report?: string | null
  latestRuns: { status: ConversationRunStatus }[]
}

type Member = { organizationId: string; userId: string; membershipCreatedAt: string }

/*
  The text blocks a parent is delivered its subagents' reports in, one per report, in the order
  given: each its subagent's id, title, how its last run ended, its report, and the first 20 of what
  it wrote, the documents and tasks its successful module writes named, with their total, read from
  what those writes keep under its own scope (`buildSubagentReportBlock`)
*/
async function readSubagentReportBlocks(
  { organizationId, userId, membershipCreatedAt }: Member,
  subagents: readonly ReportedSubagent[],
): Promise<ConversationTextBlock[]> {
  const blocks: ConversationTextBlock[] = []

  for (const subagent of subagents) {
    const id = toCanonicalUuid(subagent.id)
    const { data } = await getSubagentWritesForAgent(dataConnect, {
      organizationId,
      userId,
      membershipCreatedAt,
      scope: toConversationModuleScope(id),
      afterCreatedAt: FIRST_WRITE_AFTER,
      afterKey: '',
    })
    const [run] = subagent.latestRuns

    blocks.push(
      buildSubagentReportBlock({
        id,
        title: subagent.title,
        ending: run ? toSubagentStatus(run.status) : 'INTERRUPTED',
        report: subagent.report ?? '',
        writes: data.writes.slice(0, MAX_REPORT_WRITES).map(toSubagentWrite),
        total: data.total[0]?._count ?? 0,
      }),
    )
  }

  return blocks
}

export default readSubagentReportBlocks
