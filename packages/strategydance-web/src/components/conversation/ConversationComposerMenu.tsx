import { LightbulbIcon, PaperclipIcon, PlusIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { CONVERSATION_ATTACHMENT_CONTENT_TYPES } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'strategydance-design-system/components/ui/DropdownMenu'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import conversationMessages from '~data/intl/messages/conversation'

/*
  What the file picker offers: the types a conversation takes, and the extensions of those a
  browser may give no type, so a Markdown file can be picked where the picker reads extensions alone.
  Listing them, rather than any file, also has a phone hand over a photo it keeps as HEIC as a JPEG
*/
const ACCEPTED_FILES = [...CONVERSATION_ATTACHMENT_CONTENT_TYPES, '.md', '.markdown', '.csv', '.txt'].join(',')

type Props = {
  // Writes an `@` in the field and gives it the focus
  onMentionKnowledge: () => void
  // Opening the file picker, which the field takes the focus back from once it closes
  onFilesOpen: () => void
  // Attaches the files the reader picked
  onFilesPick: (files: File[]) => void
  // Whether files can be attached: not to a conversation that is full
  canAttachFiles: boolean
}

/*
  The "+" beside the message field: "Files and images", which opens the device's file picker, and
  "Mention knowledge", which writes an `@` at the caret and opens the list of knowledge to mention.

  The menu is not modal, so a pick can move the focus to the field while it closes, within the
  press itself, which is what has a phone raise its keyboard. Closing after a pick leaves the
  focus where the pick put it, rather than hand it back to "+" as Escape does, which would show its
  tooltip once the file picker closes. The tooltip hides while the menu is open, which it would
  otherwise cover. The picker opens within the press too, which is the only time a browser lets a
  page open it
*/
function ConversationComposerMenu({ onMentionKnowledge, onFilesOpen, onFilesPick, canAttachFiles }: Props) {
  const { formatMessage } = useIntl()
  const [isOpen, setIsOpen] = useState(false)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  // Whether the menu closes on a pick, which moved the focus to the field
  const isPickedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILES}
        hidden
        onChange={event => {
          const files = [...(event.target.files ?? [])]

          // Emptied, so picking the same file again tells as much
          event.target.value = ''

          if (files.length) onFilesPick(files)
        }}
      />
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
            disabled={!canAttachFiles}
            onSelect={() => {
              isPickedRef.current = true
              onFilesOpen()
              inputRef.current?.click()
            }}
          >
            <PaperclipIcon />
            {formatMessage(conversationMessages.composerFiles)}
          </DropdownMenuItem>
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
    </>
  )
}

export default ConversationComposerMenu
