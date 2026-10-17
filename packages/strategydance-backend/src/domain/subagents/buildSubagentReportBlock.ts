import type { ConversationTextBlock, SubagentStatus } from '~types'

import type { SubagentWrite } from '~domain/subagents/toSubagentWrite'

// A subagent's report as its parent is delivered it
export type DeliveredSubagentReport = {
  id: string
  title: string
  // How its last run ended: reported, stopped, failed or interrupted
  ending: SubagentStatus
  report: string
  // The first of what it wrote, oldest first, and how many writes it made, which `read_subagent`
  // pages through
  writes: SubagentWrite[]
  total: number
}

/*
  The text block a subagent's report reaches its parent's transcript in, in a reaction's entry, a
  send's or an answer's: one JSON object, `{"subagentReport": {...}}`, in one order of keys, as the
  system prompt names it. A report is written from whatever its subagent read, so as JSON it can
  neither pass for the member's words beside it nor close the block it sits in: its quotes, braces
  and line breaks are escaped
*/
function buildSubagentReportBlock({
  id,
  title,
  ending,
  report,
  writes,
  total,
}: DeliveredSubagentReport): ConversationTextBlock {
  return { type: 'text', text: JSON.stringify({ subagentReport: { id, title, ending, report, writes, total } }) }
}

export default buildSubagentReportBlock
