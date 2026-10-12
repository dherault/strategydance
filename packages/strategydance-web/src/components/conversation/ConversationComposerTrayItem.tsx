import { FileTextIcon, RotateCwIcon, XIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Progress } from 'strategydance-design-system/components/ui/Progress'
import { cn } from 'strategydance-design-system/lib/utils'

import useObjectUrl from '~hooks/common/useObjectUrl'

import type { ConversationComposerAttachment } from '~data/conversationComposerDrafts'
import conversationMessages from '~data/intl/messages/conversation'

const SMALL_BUTTON_CLASS_NAME =
  'grid size-5 cursor-pointer place-items-center rounded-full border-0 p-0 text-neutral-600 hover:bg-neutral-100 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3'

type Props = {
  attachment: ConversationComposerAttachment
  // Whether it can be taken out of the message now: not while the message that sends it goes
  canRemove: boolean
  onRemove: () => void
  onRetry: () => void
}

/*
  A file in the tray above the message field, as the design draws it: an image as a small square of
  itself, any other file as its name beside an icon, each with a cross that takes it out. A thin bar
  along its foot says how far it has gone up, and one that failed is outlined in red, its icon, or
  its image, a button that uploads it again
*/
function ConversationComposerTrayItem({ attachment, canRemove, onRemove, onRetry }: Props) {
  const { formatMessage } = useIntl()
  const { name, contentType, file, status, progress } = attachment
  const isImage = contentType.startsWith('image/')
  const imageUrl = useObjectUrl(isImage ? file : null)
  const isFailed = status === 'failed'

  const retry = isFailed ? (
    <button
      type="button"
      aria-label={formatMessage(conversationMessages.composerAttachmentRetry, { name })}
      className={cn(
        SMALL_BUTTON_CLASS_NAME,
        'text-danger',
        isImage ? 'absolute inset-0 m-auto bg-white/92' : 'shrink-0 bg-transparent',
      )}
      onClick={onRetry}
    >
      <RotateCwIcon />
    </button>
  ) : null

  return (
    <div
      title={name}
      className={cn(
        'relative box-border flex h-10 items-center overflow-hidden rounded-xs border bg-background text-xs text-foreground',
        isImage ? 'w-10' : 'max-w-[200px] gap-1.5 pr-[30px] pl-2.5',
        isFailed ? 'border-danger' : 'border-border',
      )}
    >
      {isImage ? (
        imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className={cn('size-full object-cover', status === 'uploading' && 'opacity-60')}
          />
        ) : null
      ) : (
        <>
          {retry ?? <FileTextIcon className="size-3.5 shrink-0 text-neutral-500" />}
          <span className="min-w-0 truncate">{name}</span>
        </>
      )}
      {isImage ? retry : null}
      <button
        type="button"
        aria-label={formatMessage(conversationMessages.composerAttachmentRemove, { name })}
        disabled={!canRemove}
        className={cn(
          SMALL_BUTTON_CLASS_NAME,
          'absolute bg-white/92',
          isImage ? 'top-0.5 right-0.5' : 'top-[9px] right-[5px]',
        )}
        // Keeps the field focused, so a touch screen keeps its keyboard up
        onMouseDown={event => event.preventDefault()}
        onClick={onRemove}
      >
        <XIcon />
      </button>
      {status === 'uploading' ? (
        <Progress
          value={progress}
          aria-label={formatMessage(conversationMessages.composerAttachmentUploading, { name })}
          className="absolute inset-x-0 bottom-0 h-0.5 rounded-none bg-transparent"
        />
      ) : null}
    </div>
  )
}

export default ConversationComposerTrayItem
