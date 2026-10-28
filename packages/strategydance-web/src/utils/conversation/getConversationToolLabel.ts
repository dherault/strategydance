import type { IntlShape, MessageDescriptor } from 'react-intl'
import type { ConversationPreview } from 'strategydance-core'

import conversationMessages from '~data/intl/messages/conversation'

type ToolStatus = Extract<ConversationPreview, { kind: 'TOOL_CALL' }>['toolStatus']

// What each of the agent's tools is called while it runs, and once it is done: its own, then the
// Knowledge module's, the Tasks module's, the Budget module's, its integrations' and the Subagents
// module's
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
  [
    'read_budget',
    { running: conversationMessages.toolReadBudgetRunning, done: conversationMessages.toolReadBudgetDone },
  ],
  ['list_bills', { running: conversationMessages.toolListBillsRunning, done: conversationMessages.toolListBillsDone }],
  ['read_bill', { running: conversationMessages.toolReadBillRunning, done: conversationMessages.toolReadBillDone }],
  ['add_bill', { running: conversationMessages.toolAddBillRunning, done: conversationMessages.toolAddBillDone }],
  [
    'update_bill',
    { running: conversationMessages.toolUpdateBillRunning, done: conversationMessages.toolUpdateBillDone },
  ],
  [
    'delete_bill',
    { running: conversationMessages.toolDeleteBillRunning, done: conversationMessages.toolDeleteBillDone },
  ],
  [
    'restore_bill',
    { running: conversationMessages.toolRestoreBillRunning, done: conversationMessages.toolRestoreBillDone },
  ],
  [
    'list_integrations',
    { running: conversationMessages.toolListIntegrationsRunning, done: conversationMessages.toolListIntegrationsDone },
  ],
  [
    'describe_integration_tool',
    {
      running: conversationMessages.toolDescribeIntegrationToolRunning,
      done: conversationMessages.toolDescribeIntegrationToolDone,
    },
  ],
  [
    'call_integration_tool',
    { running: conversationMessages.toolCallIntegrationRunning, done: conversationMessages.toolCallIntegrationDone },
  ],
  [
    'list_subagents',
    { running: conversationMessages.toolListSubagentsRunning, done: conversationMessages.toolListSubagentsDone },
  ],
  [
    'read_subagent',
    { running: conversationMessages.toolReadSubagentRunning, done: conversationMessages.toolReadSubagentDone },
  ],
  [
    'launch_subagent',
    { running: conversationMessages.toolLaunchSubagentRunning, done: conversationMessages.toolLaunchSubagentDone },
  ],
  [
    'stop_subagent',
    { running: conversationMessages.toolStopSubagentRunning, done: conversationMessages.toolStopSubagentDone },
  ],
])

/*
  What a tool call says it does, in the thread and in a conversation's preview: "Searching
  knowledge" until it has succeeded, and "Searched knowledge" once it has. A call that failed or was
  cancelled says what it tried. A call to an integration says which, "Calling Stripe", when its server
  is known. A tool the page has no words for, one a later release added, goes by its name
*/
function getConversationToolLabel(
  { formatMessage }: IntlShape,
  toolName: string,
  toolStatus: ToolStatus,
  integrationName?: string | null,
) {
  if (integrationName) {
    return formatMessage(
      toolStatus === 'SUCCEEDED'
        ? conversationMessages.integrationCallDone
        : conversationMessages.integrationCallRunning,
      { server: integrationName },
    )
  }

  const labels = TOOL_LABELS.get(toolName)

  if (!labels) return toolName

  return formatMessage(toolStatus === 'SUCCEEDED' ? labels.done : labels.running)
}

export default getConversationToolLabel
