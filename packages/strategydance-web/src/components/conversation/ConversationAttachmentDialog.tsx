import { useIntl } from 'react-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'

import formatConversationAttachmentSize from '~utils/conversation/formatConversationAttachmentSize'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  name: string
  size: number
  // Where the image is drawn from, its bytes already read
  url: string
  onClose: () => void
}

// An image a message sent, at the size the screen allows, under its name and its size
function ConversationAttachmentDialog({ name, size, url, onClose }: Props) {
  const intl = useIntl()

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={intl.formatMessage(conversationMessages.close)}
        className="max-h-[calc(100dvh-3rem)] min-w-0 overflow-y-auto sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="pr-8 wrap-anywhere">{name}</DialogTitle>
          <DialogDescription>{formatConversationAttachmentSize(intl, size)}</DialogDescription>
        </DialogHeader>
        <img
          src={url}
          alt={name}
          className="mx-auto block max-h-[70vh] max-w-full rounded-xs"
        />
      </DialogContent>
    </Dialog>
  )
}

export default ConversationAttachmentDialog
