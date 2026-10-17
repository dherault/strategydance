import { ConversationRunStatus } from 'strategydance-database/web'

import type { ConversationRun, ConversationSubagent } from '~types'

import isConversationRunGoing from '~utils/conversation/isConversationRunGoing'

// The endings after which a conversation reacts to no report until the reader writes again
const UNREACTIVE_STATUSES: ReadonlySet<ConversationRunStatus> = new Set([
  ConversationRunStatus.STOPPED,
  ConversationRunStatus.FAILED,
  ConversationRunStatus.REFUSED,
  ConversationRunStatus.INTERRUPTED,
])

export type ConversationSubagentsSummary = {
  // How many of its subagents are busy, queued, working or waiting for a slot
  workingCount: number
  // Whether any of those is not asked to stop yet, which Stop all asks
  isStoppable: boolean
  // How many reports wait for the reader's next message to deliver them, since the conversation's
  // latest run ended where it reacts to none: 0 otherwise, a reaction then bringing them in
  waitingReportCount: number
}

/*
  What the strip above a conversation's composer says of its subagents: how many work, which Stop all
  stops, and how many reports wait while the conversation cannot react to them, its latest run
  stopped, failed, refused or interrupted, so only the reader's next message delivers them
*/
function getConversationSubagentsSummary(
  subagents: readonly ConversationSubagent[],
  run: ConversationRun | null,
): ConversationSubagentsSummary {
  const working = subagents.filter(({ activeRunId }) => activeRunId !== null)
  const isUnreactive = !!run && !isConversationRunGoing(run) && UNREACTIVE_STATUSES.has(run.status)

  return {
    workingCount: working.length,
    isStoppable: working.some(({ latestRuns }) => !latestRuns[0]?.stopRequestedAt),
    waitingReportCount: isUnreactive
      ? subagents.filter(({ reportedAt, reportDeliveredAt }) => reportedAt !== null && reportDeliveredAt === null)
          .length
      : 0,
  }
}

export default getConversationSubagentsSummary
