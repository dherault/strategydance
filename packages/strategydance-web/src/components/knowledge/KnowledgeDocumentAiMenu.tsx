import { SparklesIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from 'strategydance-design-system/components/ui/DropdownMenu'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import type { KnowledgeDocumentFields } from '~types'

import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = Pick<KnowledgeDocumentFields, 'isAiReadable' | 'isAiWritable'> & {
  onChange: (fields: Partial<Pick<KnowledgeDocumentFields, 'isAiReadable' | 'isAiWritable'>>) => void
}

// A pick keeps the menu open, so the reader sees Write follow Read
function keepOpen(event: Event) {
  event.preventDefault()
}

/*
  What the product's AI agents may do with a document: read it, and change it, which they may only
  while they may read it. So Write shows unchecked and disabled while Read is, and keeps its own
  value underneath, which comes back with Read. The tooltip says what they may do now, and hides
  while the menu is open: the menu's trigger prevents the press that would otherwise close it, and
  it would cover the menu's heading
*/
function KnowledgeDocumentAiMenu({ isAiReadable, isAiWritable, onChange }: Props) {
  const { formatMessage } = useIntl()
  const [isOpen, setIsOpen] = useState(false)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const isWritable = isAiReadable && isAiWritable

  function getTooltip() {
    if (isWritable) return knowledgeMessages.aiReadWrite
    if (isAiReadable) return knowledgeMessages.aiReadOnly

    return knowledgeMessages.aiNoAccess
  }

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={open => {
        setIsOpen(open)

        if (open) setIsTooltipOpen(false)
      }}
    >
      <Tooltip
        content={formatMessage(getTooltip())}
        side="bottom"
        open={isTooltipOpen && !isOpen}
        onOpenChange={setIsTooltipOpen}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="transparent"
            size="sm"
            icon={<SparklesIcon />}
            aria-label={formatMessage(knowledgeMessages.aiPermissions)}
          />
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent className="w-48">
        <DropdownMenuLabel>{formatMessage(knowledgeMessages.aiPermissions)}</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={isAiReadable}
          onCheckedChange={checked => onChange({ isAiReadable: checked })}
          onSelect={keepOpen}
        >
          {formatMessage(knowledgeMessages.aiRead)}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={isWritable}
          disabled={!isAiReadable}
          onCheckedChange={checked => onChange({ isAiWritable: checked })}
          onSelect={keepOpen}
        >
          {formatMessage(knowledgeMessages.aiWrite)}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default KnowledgeDocumentAiMenu
