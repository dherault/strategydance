import { ConversationTranscriptRole } from 'strategydance-database/backend'

import SUBAGENT_REPORT_REQUEST from '~domain/agent/subagentReportRequest'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'

/*
  Whether a transcript entry asks a subagent for its report: a `USER` entry whose last block is the
  report request, as a fourth run's results entry carries it, from before M42 as after. The request
  that answers it is the run's last, and nothing it calls runs
*/
function carriesSubagentReportRequest(entry: { role: ConversationTranscriptRole; content: string } | undefined) {
  if (entry?.role !== ConversationTranscriptRole.USER) return false

  const last = parseTranscriptContent(entry.content).at(-1)

  return last?.type === 'text' && last.text === SUBAGENT_REPORT_REQUEST
}

export default carriesSubagentReportRequest
