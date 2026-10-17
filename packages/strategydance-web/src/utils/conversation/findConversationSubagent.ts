import type { ConversationSubagent } from '~types'

/*
  The subagent a launch's call launched, found by the call's id, Claude's, which the subagent keeps
  as the call that launched it, or undefined while the call's body or the subagents are not read,
  when the launch was refused, or once its subagent is gone
*/
function findConversationSubagent(
  subagents: readonly ConversationSubagent[],
  toolUseId: string | null | undefined,
): ConversationSubagent | undefined {
  if (!toolUseId) return undefined

  return subagents.find(({ launchToolUseId }) => launchToolUseId === toolUseId)
}

export default findConversationSubagent
