import type { IntlShape } from 'react-intl'

import getConversationNoteText from '~utils/conversation/getConversationNoteText'
import getConversationToolLabel from '~utils/conversation/getConversationToolLabel'
import parseConversationPreview from '~utils/conversation/parseConversationPreview'

import conversationMessages from '~data/intl/messages/conversation'

type Conversation = {
  activeRunId?: string | null
  preview?: unknown
}

/*
  The line the list shows under a conversation's title: "Thinking…" while a run goes, then what
  its last entry is, worded from the facts its preview keeps: a message of files alone by its
  file's name, or how many it sent, a call to an integration by its server, "Called Stripe", and an
  approval by its server and tool, "Approval: Stripe · create_payment_link". A conversation with no preview holds
  nothing yet. One whose preview this page cannot read, of a kind a later release added, shows no
  line rather than a wrong one
*/
function formatConversationPreview(intl: IntlShape, { activeRunId, preview }: Conversation) {
  const { formatMessage } = intl

  if (activeRunId) return formatMessage(conversationMessages.previewThinking)

  if (preview === null || preview === undefined) return formatMessage(conversationMessages.previewEmpty)

  const parsed = parseConversationPreview(preview)

  if (!parsed) return ''

  switch (parsed.kind) {
    case 'MEMBER_TEXT': {
      const { text, attachmentCount = 0, attachmentName = '' } = parsed

      if (text || !attachmentCount) return formatMessage(conversationMessages.previewMember, { text })

      // A message of files alone: its file's name, or how many it sent
      return formatMessage(conversationMessages.previewMember, {
        text:
          attachmentCount === 1
            ? attachmentName
            : formatMessage(conversationMessages.previewFiles, { count: attachmentCount }),
      })
    }
    case 'AGENT_TEXT':
      return parsed.text
    case 'TOOL_CALL':
      return formatToolCall(
        getConversationToolLabel(intl, parsed.toolName, parsed.toolStatus, parsed.integrationName),
        parsed.toolStatus,
      )
    case 'APPROVAL': {
      const names = { server: parsed.integrationName, tool: parsed.integrationToolName }

      if (parsed.approvalState === 'PENDING') return formatMessage(conversationMessages.previewApproval, names)

      // Denied by the member, or by a message they sent instead, before anything ran
      if (parsed.approvalState === 'DENIED' && parsed.toolStatus !== 'SUCCEEDED') {
        return formatMessage(conversationMessages.previewDenied, names)
      }

      if (!parsed.toolStatus) return formatMessage(conversationMessages.previewAllowed, names)

      return formatToolCall(
        getConversationToolLabel(intl, '', parsed.toolStatus, parsed.integrationName),
        parsed.toolStatus,
      )
    }
    case 'QUESTION':
      if (parsed.questionState === 'SKIPPED')
        return formatMessage(conversationMessages.previewSkipped, { text: parsed.text })

      if (parsed.questionState === 'ANSWERED')
        return formatMessage(conversationMessages.previewAnswered, { text: parsed.text })

      return formatMessage(conversationMessages.previewQuestion, { text: parsed.text })
    case 'NOTE':
      return getConversationNoteText(intl, parsed.noteKind)
  }

  // A call's label, with how it ended when it did not succeed
  function formatToolCall(label: string, toolStatus: string) {
    if (toolStatus === 'FAILED') return formatMessage(conversationMessages.previewToolFailed, { label })
    if (toolStatus === 'CANCELLED') return formatMessage(conversationMessages.previewToolCancelled, { label })

    return label
  }
}

export default formatConversationPreview
