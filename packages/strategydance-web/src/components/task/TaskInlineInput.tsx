import { useRef, useState } from 'react'
import { inputClassName } from 'strategydance-design-system/components/ui/Input'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  value: string
  maxLength: number
  'aria-label': string
  className?: string
  // Called with the trimmed value when it changed and is not empty
  onSave: (value: string) => void
  // Called when it closes with nothing to save, or on Escape
  onCancel: () => void
}

/*
  A name or a task edited where it is shown. It opens focused with its text selected, saves on Enter
  or when the focus leaves it, and puts the text back on Escape. It closes once, whichever of those
  comes first, since Enter is followed by the blur of the input it unmounts
*/
function TaskInlineInput({ value, maxLength, 'aria-label': ariaLabel, className, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(value)
  const isClosedRef = useRef(false)

  function commit() {
    if (isClosedRef.current) return

    isClosedRef.current = true

    const trimmed = draft.trim()

    if (trimmed && trimmed !== value) onSave(trimmed)
    else onCancel()
  }

  return (
    <input
      value={draft}
      maxLength={maxLength}
      aria-label={ariaLabel}
      className={cn(inputClassName, '-ml-2.5 h-8 min-w-0 flex-1 bg-white px-2 focus:bg-white', className)}
      // A task is one line, so a pasted newline becomes a space
      onChange={event => setDraft(event.target.value.replace(/\s*[\r\n]+\s*/g, ' '))}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault()
          commit()
        }
        else if (event.key === 'Escape') {
          event.preventDefault()
          isClosedRef.current = true
          onCancel()
        }
      }}
      onFocus={event => event.currentTarget.select()}
      autoFocus
    />
  )
}

export default TaskInlineInput
