import { ImageOffIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Skeleton } from 'strategydance-design-system/components/ui/Skeleton'

import type { ConversationMessageAttachment } from '~types'

import useImageThumbnail from '~hooks/common/useImageThumbnail'
import useObjectUrl from '~hooks/common/useObjectUrl'
import useConversationAttachmentFile from '~hooks/conversation/useConversationAttachmentFile'

import ConversationAttachmentDialog from '~components/conversation/ConversationAttachmentDialog'

import conversationMessages from '~data/intl/messages/conversation'

// The box an image stands in while its bytes are read, or once they could not be
const PLACEHOLDER_CLASS_NAME = 'h-30 w-40 rounded-sm'

// The longest side of the copy a thumbnail draws, twice the 200 pixels it is drawn at at most, for
// a screen of two pixels a point
const THUMBNAIL_SIZE = 400

type Props = {
  conversationId: string
  attachment: ConversationMessageAttachment
}

/*
  An image a message sent, as a thumbnail above its words, which opens it whole in a dialog. Its
  bytes come from the backend with the reader's token, a placeholder standing in meanwhile, and a
  muted picture once they could not be read. The thumbnail is a small copy drawn from them, so a
  thread of large images never holds them all decoded; only the dialog draws the image whole
*/
function ConversationAttachmentImage({ conversationId, attachment }: Props) {
  const { formatMessage } = useIntl()
  const { file, key, hasFailed } = useConversationAttachmentFile(conversationId, attachment.id)
  const thumbnail = useImageThumbnail(key, file, THUMBNAIL_SIZE)
  const thumbnailUrl = useObjectUrl(thumbnail ?? null)
  const [isOpen, setIsOpen] = useState(false)
  const url = useObjectUrl(isOpen ? file : null)
  const { name, size } = attachment

  if (hasFailed || thumbnail === null) {
    return (
      <span
        role="img"
        aria-label={formatMessage(conversationMessages.attachmentImageFailed, { name })}
        title={name}
        className={`${PLACEHOLDER_CLASS_NAME} grid place-items-center border border-border bg-neutral-100 text-muted-foreground`}
      >
        <ImageOffIcon className="size-5" />
      </span>
    )
  }

  if (!thumbnailUrl) return <Skeleton className={PLACEHOLDER_CLASS_NAME} />

  return (
    <>
      <button
        type="button"
        aria-label={formatMessage(conversationMessages.attachmentOpen, { name })}
        className="block cursor-zoom-in overflow-hidden rounded-sm border border-border bg-neutral-100 p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        onClick={() => setIsOpen(true)}
      >
        <img
          src={thumbnailUrl}
          alt=""
          className="block max-h-40 max-w-[200px] object-cover"
        />
      </button>
      {isOpen && url ? (
        <ConversationAttachmentDialog
          name={name}
          size={size}
          url={url}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  )
}

export default ConversationAttachmentImage
