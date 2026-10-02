import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import { cn } from 'strategydance-design-system/lib/utils'

import { COMPANY_ASPECTS } from '~constants'

import toAspectSlug from '~utils/company/toAspectSlug'

import aspectMessages from '~data/intl/aspectMessages'

type Props = {
  aspects: CompanyAspect[]
  size: number
  className?: string
}

// The icons of the aspects a document is tagged with, in `COMPANY_ASPECTS`' order, each named
function KnowledgeDocumentAspectIcons({ aspects, size, className }: Props) {
  const { formatMessage } = useIntl()

  return (
    <span className={cn('flex items-center', className)}>
      {COMPANY_ASPECTS.filter(aspect => aspects.includes(aspect)).map(aspect => (
        <CompanyAspectIcon
          key={aspect}
          aspect={toAspectSlug(aspect)}
          size={size}
          title={formatMessage(aspectMessages[aspect])}
        />
      ))}
    </span>
  )
}

export default KnowledgeDocumentAspectIcons
