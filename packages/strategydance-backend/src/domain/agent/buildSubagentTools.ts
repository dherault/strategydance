import type { BetaTool } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRequestTools } from '~domain/agent/buildConversationTools'
import { WEB_SEARCH_TOOL } from '~domain/agent/conversationTools'

/*
  The module tools a subagent never gets, by name: the Subagents module's, since a subagent launches
  and reaches none, which keeps them one level deep, and the deletes, as David chose on 2026-10-16,
  since a subagent works with nobody watching, and what it deletes is gone for good once the day's
  restore has passed, perhaps before anybody reads its report. It says in its report what it would
  delete and why, and its parent asks the member
*/
const SUBAGENT_WITHHELD_TOOLS: readonly string[] = [
  'delete_document',
  'delete_task',
  'list_subagents',
  'read_subagent',
  'launch_subagent',
  'stop_subagent',
]

// Whether a subagent gets a tool of the modules its agent uses, whose runner it is given too, so a
// call to one it was not sent is planned as a call to a tool nobody runs
export function isSubagentTool(name: string) {
  return !SUBAGENT_WITHHELD_TOOLS.includes(name)
}

/*
  The tools a subagent's requests send: web search, then the tools of the modules its agent uses, as
  the run's worker listed them, in `CONVERSATION_MODULES`' order, less those it never gets
  (`isSubagentTool`). Everything the agent that launched it has but `ask_user`, since nobody is there
  to answer, and, for now, the integration tools, whose calls wait for an approval nobody can give a
  subagent. The same list for every subagent, so their requests share a cached prefix, which a list
  granted per launch would split
*/
function buildSubagentTools(moduleTools: BetaTool[]): ConversationRequestTools {
  return [WEB_SEARCH_TOOL, ...moduleTools.filter(tool => isSubagentTool(tool.name))]
}

export default buildSubagentTools
