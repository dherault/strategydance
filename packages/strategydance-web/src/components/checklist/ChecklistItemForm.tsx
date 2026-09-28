import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_CHECKLIST_ITEM_NAME_LENGTH } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Input } from 'strategydance-design-system/components/ui/Input'

import checklistMessages from '~data/intl/messages/checklist'

type Props = {
  name: string
  canMoveLeft: boolean
  canMoveRight: boolean
  // A checklist keeps one column at least
  canRemove: boolean
  onRename: (name: string) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}

/*
  What a checklist column's popover holds: its name to change, the buttons that move it a place
  either way, and the one that removes it, which asks twice. Moving leaves it open, so a column can
  be walked along; saving and removing close it
*/
function ChecklistItemForm({ name, canMoveLeft, canMoveRight, canRemove, onRename, onMove, onRemove }: Props) {
  const { formatMessage } = useIntl()

  const [draft, setDraft] = useState(name)

  const trimmedDraft = draft.trim()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (trimmedDraft) onRename(trimmedDraft)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      <Input
        label={formatMessage(checklistMessages.itemName)}
        value={draft}
        maxLength={MAX_CHECKLIST_ITEM_NAME_LENGTH}
        onChange={event => setDraft(event.target.value.replace(/\s*[\r\n]+\s*/g, ' '))}
        onFocus={event => event.currentTarget.select()}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <div className="mr-auto flex gap-1">
          <Button
            variant="transparent"
            size="sm"
            icon={<ChevronLeftIcon />}
            aria-label={formatMessage(checklistMessages.moveLeft)}
            title={formatMessage(checklistMessages.moveLeft)}
            disabled={!canMoveLeft}
            onClick={() => onMove(-1)}
          />
          <Button
            variant="transparent"
            size="sm"
            icon={<ChevronRightIcon />}
            aria-label={formatMessage(checklistMessages.moveRight)}
            title={formatMessage(checklistMessages.moveRight)}
            disabled={!canMoveRight}
            onClick={() => onMove(1)}
          />
        </div>
        <Button
          variant="danger"
          size="sm"
          confirm={formatMessage(checklistMessages.confirm)}
          disabled={!canRemove}
          onClick={onRemove}
        >
          {formatMessage(checklistMessages.remove)}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!trimmedDraft}
        >
          {formatMessage(checklistMessages.save)}
        </Button>
      </div>
    </form>
  )
}

export default ChecklistItemForm
