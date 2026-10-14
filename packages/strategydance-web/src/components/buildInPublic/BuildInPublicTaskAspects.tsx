import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import { cn } from 'strategydance-design-system/lib/utils'

import { COMPANY_ASPECTS } from '~constants'

import toAspectSlug from '~utils/company/toAspectSlug'

import aspectMessages from '~data/intl/aspectMessages'

// As many as a card's corner holds
const MAX_ICONS = 3

type Props = {
  aspects: readonly CompanyAspect[]
  className?: string
}

// The aspects a task is about, as their icons in their usual order, the first three, named together
// for a screen reader. Nothing for a task about none
function BuildInPublicTaskAspects({ aspects, className }: Props) {
  const { formatMessage } = useIntl()

  const sorted = COMPANY_ASPECTS.filter(aspect => aspects.includes(aspect))

  if (!sorted.length) return null

  return (
    <span
      role="img"
      aria-label={sorted.map(aspect => formatMessage(aspectMessages[aspect])).join(', ')}
      className={cn('flex flex-none items-center gap-1.5', className)}
    >
      {sorted.slice(0, MAX_ICONS).map(aspect => (
        <CompanyAspectIcon
          key={aspect}
          aspect={toAspectSlug(aspect)}
          size={16}
        />
      ))}
    </span>
  )
}

export default BuildInPublicTaskAspects
