import { EllipsisIcon, HistoryIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'strategydance-design-system/components/ui/DropdownMenu'

import knowledgeMessages from '~data/intl/messages/knowledge'

// How long an armed Delete waits for its second click, as the design system's `confirm` does
const CONFIRM_TIMEOUT_MS = 3000

type Props = {
  onOpenHistory: () => void
  onDelete: () => void
}

/*
  A document's menu: its History, the text as it stood before each change an agent made, and
  Delete. Delete asks twice, as a button with `confirm` does: the first click turns it into
  "Confirm?" and keeps the menu open, the second deletes. It disarms after three seconds, or when
  the menu closes
*/
function DocumentMoreMenu({ onOpenHistory, onDelete }: Props) {
  const { formatMessage } = useIntl()
  const [isOpen, setIsOpen] = useState(false)
  const [isArmed, setIsArmed] = useState(false)

  useEffect(() => {
    if (!isArmed) return

    const timeout = setTimeout(() => setIsArmed(false), CONFIRM_TIMEOUT_MS)

    return () => clearTimeout(timeout)
  }, [isArmed])

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={open => {
        setIsOpen(open)

        if (!open) setIsArmed(false)
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="transparent"
          size="sm"
          icon={<EllipsisIcon />}
          aria-label={formatMessage(knowledgeMessages.moreActions)}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
      >
        <DropdownMenuItem onSelect={onOpenHistory}>
          <HistoryIcon />
          {formatMessage(knowledgeMessages.history)}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={event => {
            if (isArmed) {
              onDelete()

              return
            }

            event.preventDefault()
            setIsArmed(true)
          }}
        >
          <Trash2Icon />
          {formatMessage(isArmed ? knowledgeMessages.confirm : knowledgeMessages.delete)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default DocumentMoreMenu
