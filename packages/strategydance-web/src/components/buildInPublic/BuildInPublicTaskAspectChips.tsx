import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'

import { COMPANY_ASPECTS } from '~constants'

import toAspectSlug from '~utils/company/toAspectSlug'

import aspectMessages from '~data/intl/aspectMessages'

// As many as the line could ever hold
const MAX_CHIPS = 3

type Props = {
  aspects: readonly CompanyAspect[]
}

/*
  The aspects a task is about, each its icon and name, on one line: those that do not fit wrap to
  a second line the row's height leaves out, so whole names show or none, at any length a language
  gives them. An empty line for a task about none, which keeps the card's layout
*/
function BuildInPublicTaskAspectChips({ aspects }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div className="flex h-4 min-w-0 flex-none flex-wrap gap-x-3.5 overflow-hidden">
      {COMPANY_ASPECTS.filter(aspect => aspects.includes(aspect))
        .slice(0, MAX_CHIPS)
        .map(aspect => (
          <span
            key={aspect}
            className="inline-flex h-4 items-center gap-1.5 text-xs leading-4 font-medium whitespace-nowrap"
          >
            <CompanyAspectIcon
              aspect={toAspectSlug(aspect)}
              size={14}
              className="block flex-none"
            />
            {formatMessage(aspectMessages[aspect])}
          </span>
        ))}
    </div>
  )
}

export default BuildInPublicTaskAspectChips
