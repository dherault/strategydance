import { type ReactNode, useState } from 'react'
import { type MessageDescriptor, useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { cn } from 'strategydance-design-system/lib/utils'

import { COMPANY_ASPECTS } from '~constants'

import toAspectSlug from '~utils/company/toAspectSlug'

import Spinner from '~components/common/Spinner'

import aspectMessages from '~data/intl/aspectMessages'

// The dialog's words, from the catalogue of what it tags
type AspectsDialogMessages = {
  title: MessageDescriptor
  description: MessageDescriptor
  // How many are picked, from `{count}`
  selected: MessageDescriptor
  cancel: MessageDescriptor
  save: MessageDescriptor
  close: MessageDescriptor
}

type Props = {
  aspects: CompanyAspect[]
  messages: AspectsDialogMessages
  // The aspects picked, each once, in `COMPANY_ASPECTS`' order
  onSave: (aspects: CompanyAspect[]) => void
  onClose: () => void
  // While a save goes, which the dialog waits for when it stays open until it lands
  isSaving?: boolean
  // When the aspects cannot change, Save is off, and `alert` says why
  isSaveDisabled?: boolean
  // Shown above the buttons: why the aspects cannot change, or why they did not
  alert?: ReactNode
}

/*
  Which aspects something is about, a document or a conversation, every aspect a tile to toggle,
  whether the organization has explored it yet or not. Nothing changes until Save. Mounted only
  while open
*/
function AspectsDialog({ aspects, messages, onSave, onClose, isSaving = false, isSaveDisabled = false, alert }: Props) {
  const { formatMessage } = useIntl()
  const [selected, setSelected] = useState(aspects)

  function toggle(aspect: CompanyAspect) {
    setSelected(current =>
      current.includes(aspect) ? current.filter(other => other !== aspect) : [...current, aspect],
    )
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(messages.close)}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>{formatMessage(messages.title)}</DialogTitle>
          <DialogDescription>{formatMessage(messages.description)}</DialogDescription>
        </DialogHeader>
        <div
          role="group"
          aria-label={formatMessage(messages.title)}
          className="grid grid-cols-3 gap-3"
        >
          {COMPANY_ASPECTS.map(aspect => {
            const isSelected = selected.includes(aspect)

            return (
              <button
                key={aspect}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(aspect)}
                className={cn(
                  'flex aspect-square min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xs border p-2 text-center font-sans text-xs leading-[1.3] font-medium transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary',
                  isSelected
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-neutral-200 bg-white text-foreground hover:border-neutral-300',
                )}
              >
                <CompanyAspectIcon
                  aspect={toAspectSlug(aspect)}
                  size={24}
                />
                <span className="wrap-anywhere">{formatMessage(aspectMessages[aspect])}</span>
              </button>
            )
          })}
        </div>
        {alert}
        <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4 sm:items-center">
          <span className="text-sm text-muted-foreground sm:mr-auto">
            {formatMessage(messages.selected, { count: selected.length })}
          </span>
          <Button
            variant="outline"
            onClick={onClose}
          >
            {formatMessage(messages.cancel)}
          </Button>
          <Button
            disabled={isSaveDisabled || isSaving}
            icon={isSaving ? <Spinner tone="current" /> : undefined}
            onClick={() => onSave(COMPANY_ASPECTS.filter(aspect => selected.includes(aspect)))}
          >
            {formatMessage(messages.save)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AspectsDialog
