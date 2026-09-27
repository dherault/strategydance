import { CheckIcon, CopyIcon } from 'lucide-react'
import { type ComponentProps, useEffect, useRef, useState } from 'react'

import { Button } from 'strategydance-design-system/components/ui/Button'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

// How long the button says it copied before it offers to copy again
const COPIED_DURATION_MS = 2000

type Props = Omit<ComponentProps<typeof Button>, 'icon' | 'iconPosition' | 'children' | 'confirm' | 'confirmTimeout' | 'aria-label' | 'onClick'> & {
  /** What a press puts on the clipboard */
  value: string
  /** The button's accessible name and tooltip. The default is English: a caller with a catalogue passes its own */
  label?: string
  /** What the name and tooltip say for a moment after a copy, and what a screen reader hears then */
  copiedLabel?: string
}

/*
  A square button that copies a string, then swaps its icon for a check and its tooltip for
  `copiedLabel` for a moment. The tooltip is held open meanwhile, since a press closes it
  otherwise, and a hidden status region beside the button announces the copy. Escape still
  dismisses it, by ending the moment early.

  A write the browser refuses, outside a secure context or without permission, leaves the button
  as it was
*/
function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  variant = 'transparent',
  size = 'sm',
  ...props
}: Props) {
  const [isCopied, setIsCopied] = useState(false)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(resetTimeoutRef.current), [])

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value)
    }
    catch {
      return
    }

    clearTimeout(resetTimeoutRef.current)
    setIsCopied(true)
    resetTimeoutRef.current = setTimeout(() => setIsCopied(false), COPIED_DURATION_MS)
  }

  const currentLabel = isCopied ? copiedLabel : label

  return (
    <>
      <Tooltip
        content={currentLabel}
        open={isCopied || isTooltipOpen}
        onOpenChange={setIsTooltipOpen}
        // While the copy holds it open, closing it is not enough for Escape to dismiss it
        onEscapeKeyDown={() => {
          clearTimeout(resetTimeoutRef.current)
          setIsCopied(false)
        }}
      >
        <Button
          variant={variant}
          size={size}
          icon={isCopied ? <CheckIcon /> : <CopyIcon />}
          aria-label={currentLabel}
          onClick={handleClick}
          {...props}
        />
      </Tooltip>
      <span
        role="status"
        className="sr-only"
      >
        {isCopied ? copiedLabel : null}
      </span>
    </>
  )
}

export { CopyButton }
