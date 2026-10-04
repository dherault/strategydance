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
  The line the list and the aspect page's cards show under a conversation's title: "Thinking…"
  while a run goes, then what its last entry is, worded from the facts its preview keeps. A
  conversation with no preview holds nothing yet. One whose preview this page cannot read, of a
  kind a later release added, shows no line rather than a wrong one
*/
function formatConversationPreview(intl: IntlShape, { activeRunId, preview }: Conversation) {
  const { formatMessage } = intl

  if (activeRunId) return formatMessage(conversationMessages.previewThinking)

  if (preview === null || preview === undefined) return formatMessage(conversationMessages.previewEmpty)

  const parsed = parseConversationPreview(preview)

  if (!parsed) return ''

  switch (parsed.kind) {
    case 'MEMBER_TEXT':
      return formatMessage(conversationMessages.previewMember, { text: parsed.text })
    case 'AGENT_TEXT':
      return parsed.text
    case 'TOOL_CALL': {
      const label = getConversationToolLabel(intl, parsed.toolName, parsed.toolStatus)

      if (parsed.toolStatus === 'FAILED') return formatMessage(conversationMessages.previewToolFailed, { label })

      if (parsed.toolStatus === 'CANCELLED') return formatMessage(conversationMessages.previewToolCancelled, { label })

      return label
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
}

export default formatConversationPreview
