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
}

/*
  A call that started, as `read_subagent` and the reports a parent is delivered name it: a call that
  finished has its duration, and one finished as interrupted, or cancelled by the end of its run while
  it was under way, has none
*/
function toSubagentIntegrationCall({
  integrationName,
  integrationToolName,
  toolStatus,
  toolDurationMs,
}: IntegrationCallRow): SubagentIntegrationCall {
  return {
    integration: integrationName ?? '',
    tool: integrationToolName ?? '',
    ending: toEnding(toolStatus, toolDurationMs),
  }
}

function toEnding(
  toolStatus: IntegrationCallRow['toolStatus'],
  toolDurationMs: IntegrationCallRow['toolDurationMs'],
): SubagentIntegrationCallEnding {
  switch (toolStatus) {
    case ConversationToolStatus.SUCCEEDED:
      return 'SUCCEEDED'
    case ConversationToolStatus.FAILED:
      return toolDurationMs === null || toolDurationMs === undefined ? 'INTERRUPTED' : 'FAILED'
    case ConversationToolStatus.RUNNING:
      return 'RUNNING'
    default:
      return 'INTERRUPTED'
  }
}

export default toSubagentIntegrationCall
