import { CheckIcon, CopyIcon, SendIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { Button, buttonVariants } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import { SUPPORT_CONTACT } from '~constants'

import supportMessages from '~data/intl/messages/support'

// How long the copy button says it copied before it offers to copy again
const COPIED_DURATION_MS = 2000

// The address, with a button that copies it and one that opens the reader's mail app on it
function SupportEmail() {
  const { formatMessage } = useIntl()
  const [isCopied, setIsCopied] = useState(false)
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(resetTimeoutRef.current), [])

  async function handleCopy() {
    // Outside a secure context there is no clipboard at all, and the call throws like a refusal
    try {
      await navigator.clipboard.writeText(SUPPORT_CONTACT.email)
    }
    catch {
      toast.error(formatMessage(supportMessages.copyError))

      return
    }

    clearTimeout(resetTimeoutRef.current)
    setIsCopied(true)
    toast.success(formatMessage(supportMessages.emailCopied))
    resetTimeoutRef.current = setTimeout(() => setIsCopied(false), COPIED_DURATION_MS)
  }

  // The buttons wrap under the address on a phone, rather than break it across three lines
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xs border border-neutral-200 bg-neutral-50 py-1.5 pr-1.5 pl-3.5 text-left">
      <span className="min-w-48 flex-1 text-sm font-medium wrap-anywhere text-secondary select-all">
        {SUPPORT_CONTACT.email}
      </span>
      <Button
        variant="transparent"
        size="sm"
        icon={isCopied ? <CheckIcon /> : <CopyIcon />}
        onClick={handleCopy}
      >
        {formatMessage(isCopied ? supportMessages.copied : supportMessages.copy)}
      </Button>
      <a
        href={`mailto:${SUPPORT_CONTACT.email}`}
        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
      >
        <SendIcon />
        {formatMessage(supportMessages.write)}
      </a>
    </div>
  )
}

export default SupportEmail
