import { SUBAGENT_REPORT_TIME_MS } from '~constants'

import type { ConversationRunLimits } from '~domain/conversations/requestConversationTurn'

/*
  Until when a subagent's request for its report may be sent, as M42 settles it: past the run's ten
  minutes, while two minutes are left before its stream would be cut, 12 minutes after the run was
  first claimed
*/
function readSubagentReportDeadline(startedAt: string, limits: ConversationRunLimits) {
  return Date.parse(startedAt) + Math.max(limits.maxDurationMs, limits.streamDeadlineMs - SUBAGENT_REPORT_TIME_MS)
}

export default readSubagentReportDeadline
