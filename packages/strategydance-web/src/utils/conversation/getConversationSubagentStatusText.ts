import type { IntlShape } from 'react-intl'

import type { ConversationSubagentStatus } from '~types'

import conversationMessages from '~data/intl/messages/conversation'

const STATUS_MESSAGES = {
  queued: conversationMessages.subagentStatusQueued,
  waitingForSlot: conversationMessages.subagentStatusWaitingForSlot,
  working: conversationMessages.subagentStatusWorking,
  stopping: conversationMessages.subagentStatusStopping,
  reported: conversationMessages.subagentStatusReported,
  stopped: conversationMessages.subagentStatusStopped,
  failed: conversationMessages.subagentStatusFailed,
  interrupted: conversationMessages.subagentStatusInterrupted,
} satisfies Record<ConversationSubagentStatus, unknown>

// What a subagent's row and its viewer say of where it stands
function getConversationSubagentStatusText({ formatMessage }: IntlShape, status: ConversationSubagentStatus) {
  return formatMessage(STATUS_MESSAGES[status])
}

export default getConversationSubagentStatusText
