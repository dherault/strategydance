import { useState } from 'react'
import { useIntl } from 'react-intl'
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

import aspectMessages from '~data/intl/aspectMessages'
import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = {
  aspects: CompanyAspect[]
  // The aspects picked, each once, in `COMPANY_ASPECTS`' order
  onSave: (aspects: CompanyAspect[]) => void
  onClose: () => void
}

/*
  Which aspects a document is about, every aspect a tile to toggle, whether the organization has
  explored it yet or not. Nothing changes until Save. Mounted only while open
*/
function KnowledgeDocumentAspectsDialog({ aspects, onSave, onClose }: Props) {
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
        closeLabel={formatMessage(knowledgeMessages.close)}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>{formatMessage(knowledgeMessages.aspectsTitle)}</DialogTitle>
          <DialogDescription>{formatMessage(knowledgeMessages.aspectsDescription)}</DialogDescription>
        </DialogHeader>
        <div
          role="group"
          aria-label={formatMessage(knowledgeMessages.aspectsTitle)}
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
        <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4 sm:items-center">
          <span className="text-sm text-muted-foreground sm:mr-auto">
            {formatMessage(knowledgeMessages.aspectsSelected, { count: selected.length })}
          </span>
          <Button
            variant="outline"
            onClick={onClose}
          >
            {formatMessage(knowledgeMessages.cancel)}
          </Button>
          <Button onClick={() => onSave(COMPANY_ASPECTS.filter(aspect => selected.includes(aspect)))}>
            {formatMessage(knowledgeMessages.save)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default KnowledgeDocumentAspectsDialog
