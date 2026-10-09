import { type KeyboardEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_TASK_NAME_LENGTH } from 'strategydance-core'

import useClaimEscape from '~hooks/common/useClaimEscape'

import { TASK_EDITABLE_CLASS_NAME, TASK_NAME_INPUT_CLASS_NAME } from '~components/task/taskClassNames'

import taskMessages from '~data/intl/messages/task'

type Props = {
  value: string
  onSave: (name: string) => void
}

/*
  A task's name at the top of its dialog, which a click turns into a field. Enter or leaving it
  saves a name that changed, without the spaces at its ends; Escape, or an emptied field, keeps the
  one it had. Escape is the field's while it is open, so it never closes the dialog with it
*/
function TaskNameField({ value, onSave }: Props) {
  const { formatMessage } = useIntl()
  // What is typed, or null while the name is only shown
  const [draft, setDraft] = useState<string | null>(null)

  useClaimEscape(draft !== null)

  function finish(isSaved: boolean) {
    if (draft === null) return

    const name = draft.trim()

    if (isSaved && name && name !== value) onSave(name)

    setDraft(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return

    if (event.key === 'Enter') {
      event.preventDefault()
      finish(true)
    } else if (event.key === 'Escape') {
      finish(false)
    }
  }

  if (draft === null) {
    return (
      <button
        type="button"
        title={formatMessage(taskMessages.editName)}
        className={TASK_EDITABLE_CLASS_NAME}
        onClick={() => setDraft(value)}
      >
        {value}
      </button>
    )
  }

  return (
    <input
      autoFocus
      value={draft}
      maxLength={MAX_TASK_NAME_LENGTH}
      aria-label={formatMessage(taskMessages.namePlaceholder)}
      placeholder={formatMessage(taskMessages.namePlaceholder)}
      className={TASK_NAME_INPUT_CLASS_NAME}
      onFocus={event => event.target.select()}
      onChange={event => setDraft(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={handleKeyDown}
    />
  )
}

export default TaskNameField
