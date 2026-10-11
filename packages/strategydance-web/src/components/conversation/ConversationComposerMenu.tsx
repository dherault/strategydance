import { LightbulbIcon, PlusIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'strategydance-design-system/components/ui/DropdownMenu'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // Writes an `@` in the field and gives it the focus
  onMentionKnowledge: () => void
}

/*
  The "+" beside the message field: "Mention knowledge" for now, which writes an `@` at the caret
  and opens the list of knowledge to mention. Files and images come later.

  The menu is not modal, so a pick can move the focus to the field while it closes, within the
  press itself, which is what has a phone raise its keyboard. Closing after a pick leaves the
  focus there, rather than hand it back to "+" as Escape does. The tooltip hides while the menu is
  open, which it would otherwise cover
*/
function ConversationComposerMenu({ onMentionKnowledge }: Props) {
  const { formatMessage } = useIntl()
  const [isOpen, setIsOpen] = useState(false)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  // Whether the menu closes on a pick, which moved the focus to the field
  const isPickedRef = useRef(false)

  return (
    <DropdownMenu
      modal={false}
      open={isOpen}
      onOpenChange={open => {
        setIsOpen(open)

        if (open) setIsTooltipOpen(false)
      }}
    >
      <Tooltip
        content={formatMessage(conversationMessages.composerAttach)}
        side="top"
        open={isTooltipOpen && !isOpen}
        onOpenChange={setIsTooltipOpen}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="transparent"
            size="sm"
            icon={<PlusIcon />}
            aria-label={formatMessage(conversationMessages.composerAttach)}
          />
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent
        side="top"
        className="w-54"
        onCloseAutoFocus={event => {
          if (!isPickedRef.current) return

          event.preventDefault()
          isPickedRef.current = false
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            isPickedRef.current = true
            onMentionKnowledge()
          }}
        >
          <LightbulbIcon />
          {formatMessage(conversationMessages.composerMentionKnowledge)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ConversationComposerMenu
