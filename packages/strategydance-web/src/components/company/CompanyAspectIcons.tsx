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

/*
  The icons of the aspects a document or a conversation is tagged with, in `COMPANY_ASPECTS`' order,
  as one image whose title names them all: the tooltip hovering any of them shows, and the image's
  accessible name. None draws nothing, since an image with no name is a gap to assistive technology
*/
function CompanyAspectIcons({ aspects, size, className }: Props) {
  const { formatMessage, formatList } = useIntl()

  const taggedAspects = COMPANY_ASPECTS.filter(aspect => aspects.includes(aspect))

  if (!taggedAspects.length) return null

  return (
    <span
      role="img"
      title={formatList(
        taggedAspects.map(aspect => formatMessage(aspectMessages[aspect])),
        { type: 'conjunction' },
      )}
      className={cn('flex items-center', className)}
    >
      {taggedAspects.map(aspect => (
        <CompanyAspectIcon
          key={aspect}
          aspect={toAspectSlug(aspect)}
          size={size}
        />
      ))}
    </span>
  )
}

export default CompanyAspectIcons
