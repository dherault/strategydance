import { ConversationTranscriptRole } from 'strategydance-database/backend'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import SUBAGENT_REPORT_REQUEST from '~domain/agent/subagentReportRequest'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'

/*
  Whether a transcript entry asks a subagent for its report: a results entry its last run stored,
  opening with a turn's results and ending with the report request, from before M42 as after. The
  request that answers it is the run's last, and nothing it calls runs. No other entry is trusted
  with it, since a member's message and a brief can hold the same words: `lastRunId` is the run's id
  when it is a subagent's fourth, and null for any other run
*/
function carriesSubagentReportRequest(
  entry: { role: ConversationTranscriptRole; content: string; runId: string } | undefined,
  lastRunId: string | null,
) {
  if (!entry || !lastRunId || entry.role !== ConversationTranscriptRole.USER) return false
  if (toCanonicalUuid(entry.runId) !== toCanonicalUuid(lastRunId)) return false

  const blocks = parseTranscriptContent(entry.content)
  const last = blocks.at(-1)

  return blocks[0]?.type === 'tool_result' && last?.type === 'text' && last.text === SUBAGENT_REPORT_REQUEST
}

export default carriesSubagentReportRequest
