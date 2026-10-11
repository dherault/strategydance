import type { IntlShape, MessageDescriptor } from 'react-intl'
import type { ConversationPreview } from 'strategydance-core'

import conversationMessages from '~data/intl/messages/conversation'

type ToolStatus = Extract<ConversationPreview, { kind: 'TOOL_CALL' }>['toolStatus']

// What each of the agent's tools is called while it runs, and once it is done: its own, then the
// Knowledge module's and the Tasks module's
const TOOL_LABELS = new Map<string, { running: MessageDescriptor; done: MessageDescriptor }>([
  ['web_search', { running: conversationMessages.toolWebSearchRunning, done: conversationMessages.toolWebSearchDone }],
  [
    'search_documents',
    { running: conversationMessages.toolSearchKnowledgeRunning, done: conversationMessages.toolSearchKnowledgeDone },
  ],
  [
    'list_documents',
    { running: conversationMessages.toolListKnowledgeRunning, done: conversationMessages.toolListKnowledgeDone },
  ],
  [
    'read_document',
    { running: conversationMessages.toolReadKnowledgeRunning, done: conversationMessages.toolReadKnowledgeDone },
  ],
  [
    'create_document',
    { running: conversationMessages.toolCreateKnowledgeRunning, done: conversationMessages.toolCreateKnowledgeDone },
  ],
  [
    'update_document',
    { running: conversationMessages.toolUpdateKnowledgeRunning, done: conversationMessages.toolUpdateKnowledgeDone },
  ],
  [
    'set_document_aspects',
    { running: conversationMessages.toolTagKnowledgeRunning, done: conversationMessages.toolTagKnowledgeDone },
  ],
  [
    'delete_document',
    { running: conversationMessages.toolDeleteKnowledgeRunning, done: conversationMessages.toolDeleteKnowledgeDone },
  ],
  [
    'restore_document',
    { running: conversationMessages.toolRestoreKnowledgeRunning, done: conversationMessages.toolRestoreKnowledgeDone },
  ],
  ['list_tasks', { running: conversationMessages.toolListTasksRunning, done: conversationMessages.toolListTasksDone }],
  ['read_task', { running: conversationMessages.toolReadTaskRunning, done: conversationMessages.toolReadTaskDone }],
  [
    'create_task',
    { running: conversationMessages.toolCreateTaskRunning, done: conversationMessages.toolCreateTaskDone },
  ],
  [
    'update_task',
    { running: conversationMessages.toolUpdateTaskRunning, done: conversationMessages.toolUpdateTaskDone },
  ],
  [
    'add_task_dependency',
    { running: conversationMessages.toolLinkTasksRunning, done: conversationMessages.toolLinkTasksDone },
  ],
  [
    'remove_task_dependency',
    { running: conversationMessages.toolUnlinkTasksRunning, done: conversationMessages.toolUnlinkTasksDone },
  ],
  [
    'delete_task',
    { running: conversationMessages.toolDeleteTaskRunning, done: conversationMessages.toolDeleteTaskDone },
  ],
  [
    'restore_task',
    { running: conversationMessages.toolRestoreTaskRunning, done: conversationMessages.toolRestoreTaskDone },
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
