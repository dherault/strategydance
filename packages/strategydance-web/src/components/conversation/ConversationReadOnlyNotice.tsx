import { EyeIcon } from 'lucide-react'
import { useIntl } from 'react-intl'

import type { ConversationAuthor } from '~types'

import getConversationAuthorName from '~utils/conversation/getConversationAuthorName'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The member who started the conversation, the only one who writes in it
  author: ConversationAuthor
}

/*
  What the foot of another member's conversation shows in place of the composer, where the composer
  sits: that its author started it, so only they write in it. The reader reads it all, and answers,
  stops, retries and changes nothing
*/
function ConversationReadOnlyNotice({ author }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div className="sticky bottom-0 z-10 bg-background pt-3 pb-5">
      <p className="m-0 flex items-center gap-2 rounded-xs border border-border bg-neutral-50 px-3.5 py-3 text-sm text-muted-foreground">
        <EyeIcon
          aria-hidden="true"
          className="size-4 shrink-0"
        />
        {formatMessage(conversationMessages.readOnly, { name: getConversationAuthorName(author) })}
      </p>
    </div>
  )
}

export default ConversationReadOnlyNotice
