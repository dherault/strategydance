import { useIntl } from 'react-intl'

import ConversationComposerTrayItem from '~components/conversation/ConversationComposerTrayItem'

import type { ConversationComposerAttachment } from '~data/conversationComposerDrafts'
import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  attachments: readonly ConversationComposerAttachment[]
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

// The files attached to the message being written, above its field, in the order they were added
function ConversationComposerTray({ attachments, onRemove, onRetry }: Props) {
  const { formatMessage } = useIntl()

  return (
    <ul
      aria-label={formatMessage(conversationMessages.composerAttachmentsLabel)}
      className="m-0 flex list-none flex-wrap gap-1.5 p-0"
    >
      {attachments.map(attachment => (
        <li
          key={attachment.id}
          className="min-w-0"
        >
          <ConversationComposerTrayItem
            attachment={attachment}
            onRemove={() => onRemove(attachment.id)}
            onRetry={() => onRetry(attachment.id)}
          />
        </li>
      ))}
    </ul>
  )
}

export default ConversationComposerTray
