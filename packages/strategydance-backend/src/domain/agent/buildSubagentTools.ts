import type { BetaTool } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRequestTools } from '~domain/agent/buildConversationTools'
import CONVERSATION_TOOLS, { ASK_USER_TOOL_NAME } from '~domain/agent/conversationTools'

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
  The tools a subagent's requests send: the agent's own but `ask_user`, since nobody is there to
  answer, web search then the three integration tools, then the tools of the modules its agent uses,
  as the run's worker listed them, in `CONVERSATION_MODULES`' order, less those it never gets
  (`isSubagentTool`). Its calls to an integration run only when an administrator lets the tool run
  without approval, since nobody can approve one for a subagent: any other is drawn failed, saying to
  report it (`decideConversationIntegrationCall`). The same list for every subagent, so their
  requests share a cached prefix, which a list granted per launch would split
*/
function buildSubagentTools(moduleTools: BetaTool[]): ConversationRequestTools {
  return [
    ...CONVERSATION_TOOLS.filter(tool => !('name' in tool) || tool.name !== ASK_USER_TOOL_NAME),
    ...moduleTools.filter(tool => isSubagentTool(tool.name)),
  ]
}

export default buildSubagentTools
