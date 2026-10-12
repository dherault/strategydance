import { FileTextIcon } from 'lucide-react'
import { useIntl } from 'react-intl'

import type { ConversationMessageAttachment } from '~types'

import formatConversationAttachmentSize from '~utils/conversation/formatConversationAttachmentSize'

type Props = {
  attachment: ConversationMessageAttachment
}

// A file a message sent other than an image, a PDF or a text file, as its icon, its name and its size
function ConversationAttachmentChip({ attachment }: Props) {
  const intl = useIntl()
  const { name, size } = attachment

  return (
    <span
      title={name}
      className="box-border flex max-w-full min-w-0 items-center gap-2.5 rounded-sm border border-border bg-background py-2 pr-3 pl-2"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-xs bg-neutral-100 text-neutral-600">
        <FileTextIcon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{formatConversationAttachmentSize(intl, size)}</span>
      </span>
    </span>
  )
}

export default ConversationAttachmentChip
