import { ConversationToolStatus } from 'strategydance-database/backend'

import type { SubagentIntegrationCallEnding } from '~types'

// A call a subagent made to an integration: the server and the tool as they were named at call time
export type SubagentIntegrationCall = {
  integration: string
  tool: string
  ending: SubagentIntegrationCallEnding
}

type IntegrationCallRow = {
  integrationName?: string | null
  integrationToolName?: string | null
  toolStatus?: ConversationToolStatus | null
  toolDurationMs?: number | null
  isToolUnanswered?: boolean | null
}

/*
  A call that started, as `read_subagent` and the reports a parent is delivered name it: a call its
  server never answered is recorded so, and one finished as interrupted before that was has no
  duration, as one cancelled by the end of its run while it was under way has none
*/
function toSubagentIntegrationCall({
  integrationName,
  integrationToolName,
  toolStatus,
  toolDurationMs,
  isToolUnanswered,
}: IntegrationCallRow): SubagentIntegrationCall {
  return {
    integration: integrationName ?? '',
    tool: integrationToolName ?? '',
    ending: toEnding({ toolStatus, toolDurationMs, isToolUnanswered }),
  }
}

function toEnding({
  toolStatus,
  toolDurationMs,
  isToolUnanswered,
}: Pick<IntegrationCallRow, 'toolStatus' | 'toolDurationMs' | 'isToolUnanswered'>): SubagentIntegrationCallEnding {
  switch (toolStatus) {
    case ConversationToolStatus.SUCCEEDED:
      return 'SUCCEEDED'
    case ConversationToolStatus.FAILED:
      return isToolUnanswered || toolDurationMs === null || toolDurationMs === undefined ? 'UNANSWERED' : 'FAILED'
    case ConversationToolStatus.RUNNING:
      return 'RUNNING'
    default:
      return 'UNANSWERED'
  }
}

export default toSubagentIntegrationCall
