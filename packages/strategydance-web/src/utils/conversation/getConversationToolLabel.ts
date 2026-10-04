import type { IntlShape, MessageDescriptor } from 'react-intl'
import type { ConversationPreview } from 'strategydance-core'

import conversationMessages from '~data/intl/messages/conversation'

type ToolStatus = Extract<ConversationPreview, { kind: 'TOOL_CALL' }>['toolStatus']

// What each of the agent's own tools is called while it runs, and once it is done
const TOOL_LABELS = new Map<string, { running: MessageDescriptor; done: MessageDescriptor }>([
  ['web_search', { running: conversationMessages.toolWebSearchRunning, done: conversationMessages.toolWebSearchDone }],
  [
    'search_knowledge',
    { running: conversationMessages.toolSearchKnowledgeRunning, done: conversationMessages.toolSearchKnowledgeDone },
  ],
  [
    'read_knowledge',
    { running: conversationMessages.toolReadKnowledgeRunning, done: conversationMessages.toolReadKnowledgeDone },
  ],
  [
    'create_knowledge',
    { running: conversationMessages.toolCreateKnowledgeRunning, done: conversationMessages.toolCreateKnowledgeDone },
  ],
  [
    'update_knowledge',
    { running: conversationMessages.toolUpdateKnowledgeRunning, done: conversationMessages.toolUpdateKnowledgeDone },
  ],
  ['get_team', { running: conversationMessages.toolGetTeamRunning, done: conversationMessages.toolGetTeamDone }],
  ['read_log', { running: conversationMessages.toolReadLogRunning, done: conversationMessages.toolReadLogDone }],
  [
    'set_top_priority',
    { running: conversationMessages.toolSetTopPriorityRunning, done: conversationMessages.toolSetTopPriorityDone },
  ],
])

/*
  What a tool call says it does, in the thread and in a conversation's preview: "Searching
  knowledge" until it has succeeded, and "Searched knowledge" once it has. A call that failed or was
  cancelled says what it tried. A tool the page has no words for, one a later release added, goes by
  its name
*/
function getConversationToolLabel({ formatMessage }: IntlShape, toolName: string, toolStatus: ToolStatus) {
  const labels = TOOL_LABELS.get(toolName)

  if (!labels) return toolName

  return formatMessage(toolStatus === 'SUCCEEDED' ? labels.done : labels.running)
}

export default getConversationToolLabel
