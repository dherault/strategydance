import { ConversationMessageKind } from 'strategydance-database/web'

import type { ConversationMessageBody, ConversationThreadEntry } from '~types'

// The tool whose row offers Restore, which the organization's board says it can
export const DELETE_TASK_TOOL_NAME = 'delete_task'

/*
  Whether a thread draws anything the organization's board decides: a reply or a subagent's brief
  that links a task, as `task:<id>`, whatever the case of its scheme, drawn with its current name, or
  a row that deleted one, which offers Restore while the task is off the board. A thread without
  either never reads the board
*/
function needsConversationTasks(
  entries: ConversationThreadEntry[],
  bodies: ReadonlyMap<string, ConversationMessageBody>,
) {
  return entries.some(entry => {
    if (entry.kind === ConversationMessageKind.TOOL_CALL) return entry.toolName === DELETE_TASK_TOOL_NAME

    return (
      (entry.kind === ConversationMessageKind.AGENT_TEXT || entry.kind === ConversationMessageKind.BRIEF)
      && /task:/i.test(bodies.get(entry.id)?.text ?? '')
    )
  })
}

export default needsConversationTasks
