import { ExternalLinkIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { Button, buttonVariants } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { cn } from 'strategydance-design-system/lib/utils'
import type { Directory } from 'strategydance-knowledge/src/directories/types'

import DirectoryBusinessModelBadge from '~components/directory/DirectoryBusinessModelBadge'
import DirectoryNotesField from '~components/directory/DirectoryNotesField'
import DirectoryStatusField from '~components/directory/DirectoryStatusField'

import directoryCategoryMessages from '~data/intl/directoryCategoryMessages'
import directoryMessages from '~data/intl/messages/directory'

// The label over each of the side column's facts
const FACT_LABEL_CLASS_NAME = 'text-xs font-medium text-muted-foreground'

type Props = {
  directory: Directory
  onClose: () => void
}

/*
  One directory, in its dialog, opened from the Directories page at its address or from a card of
  the Marketing aspect's page in place: its description, links to its submission page and its site,
  which open in a new tab, the team's notes, and beside them where the organization stands with
  it, what it charges, the kinds of product it lists, its type and whether its site was lately out
  of reach. The status and the notes save as they change, so Done only closes it. Radix gives the
  focus back only to a trigger of its own, which an address has none of, so the dialog takes note
  of what had it as it opened, the row, the link or the card, and gives it back there
*/
function DirectoryDialog({ directory, onClose }: Props) {
  const { formatMessage, formatDate } = useIntl()
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))
  const contentRef = useRef<HTMLDivElement>(null)

  const isReddit = directory.type === 'REDDIT_COMMUNITY'

  return (
    <Dialog
      open
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent
        ref={contentRef}
        aria-describedby={undefined}
        closeLabel={formatMessage(directoryMessages.close)}
        className="flex max-h-[calc(100dvh-3rem)] min-w-0 flex-col gap-0 p-0 sm:max-w-[760px]"
        onOpenAutoFocus={event => {
          event.preventDefault()
          contentRef.current?.focus()
        }}
        onCloseAutoFocus={event => {
          event.preventDefault()

          if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
        }}
      >
        <DialogHeader className="px-6 pt-6 pr-14">
          <DialogTitle className="wrap-anywhere">{directory.name}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-auto overflow-y-auto px-6 pt-5 pb-6">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_224px]">
            <div className="flex min-w-0 flex-col gap-5">
              <p
                className={cn(
                  'm-0 text-sm leading-[1.6] text-pretty',
                  directory.description ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {directory.description || formatMessage(directoryMessages.noDescription)}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={directory.submissionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: 'sm' })}
                >
                  <ExternalLinkIcon />
                  {formatMessage(directoryMessages.openSubmissionPage)}
                </a>
                <a
                  href={directory.rootUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  // Merged, so the outline's border wins over the base's transparent one
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  {formatMessage(isReddit ? directoryMessages.visitCommunity : directoryMessages.visitSite)}
                </a>
              </div>
              <DirectoryNotesField directory={directory} />
            </div>
            <div className="flex flex-col gap-4">
              <DirectoryStatusField directory={directory} />
              <div className="flex flex-col gap-1.5">
                <span className={FACT_LABEL_CLASS_NAME}>{formatMessage(directoryMessages.pricing)}</span>
                <div className="flex flex-wrap gap-1.5">
                  <DirectoryBusinessModelBadge businessModel={directory.businessModel} />
                </div>
              </div>
              {directory.categories.length ? (
                <div className="flex flex-col gap-1.5">
                  <span className={FACT_LABEL_CLASS_NAME}>{formatMessage(directoryMessages.categories)}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {directory.categories.map(category => (
                      <Badge
                        key={category}
                        size="sm"
                        appearance="outline"
                      >
                        {formatMessage(directoryCategoryMessages[category])}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <span className={FACT_LABEL_CLASS_NAME}>{formatMessage(directoryMessages.type)}</span>
                <span className="text-sm text-foreground">
                  {formatMessage(isReddit ? directoryMessages.redditCommunity : directoryMessages.website)}
                </span>
              </div>
              {directory.unreachableSince ? (
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    size="sm"
                    variant="danger"
                  >
                    {formatMessage(directoryMessages.unreachableSince, {
                      date: formatDate(`${directory.unreachableSince}T00:00:00`, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }),
                    })}
                  </Badge>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button onClick={onClose}>{formatMessage(directoryMessages.done)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DirectoryDialog
