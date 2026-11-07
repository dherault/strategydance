import { FileTextIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { ConversationMessageAttachment } from '~types'

import useDownloadConversationAttachment from '~hooks/conversation/useDownloadConversationAttachment'

import formatFileSize from '~utils/common/formatFileSize'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The conversation whose files it is among, which serves its bytes
  conversationId: string
  attachment: ConversationMessageAttachment
}

/*
  A file a message sent other than an image, as its icon, its name and its size, which downloads it
  when clicked, a spinner standing in for the icon while its bytes are read. A file that is gone, or
  could not be read, says so in a toast
*/
function ConversationAttachmentChip({ conversationId, attachment }: Props) {
  const intl = useIntl()
  const { formatMessage } = intl
  const download = useDownloadConversationAttachment()
  const [isDownloading, setIsDownloading] = useState(false)
  const { name, size } = attachment
  const label = formatMessage(conversationMessages.attachmentDownload, { name })

  async function handleClick() {
    if (isDownloading) return

    setIsDownloading(true)

    try {
      if (!(await download(conversationId, attachment))) {
        toast.error(formatMessage(conversationMessages.attachmentUnavailable, { name }))
      }
    } catch (error) {
      console.error('Failed to download a conversation file', error)
      toast.error(formatMessage(conversationMessages.attachmentDownloadFailed, { name }))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-busy={isDownloading || undefined}
      className="box-border flex max-w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-sm border border-border bg-background py-2 pr-3 pl-2 text-left transition-colors duration-150 ease-in-out hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      onClick={handleClick}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-xs bg-neutral-100 text-neutral-600">
        {isDownloading ? (
          <Spinner
            size="sm"
            tone="muted"
          />
        ) : (
          <FileTextIcon className="size-4" />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{formatFileSize(intl, size)}</span>
      </span>
    </button>
  )
}

export default ConversationAttachmentChip
