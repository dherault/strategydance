import { createFileRoute, notFound } from '@tanstack/react-router'
import { useIntl } from 'react-intl'
import { type CompanyAspect, CompanyAspects } from 'strategydance-design-system/components/company/CompanyAspectIcon'

import ComingSoon from '~components/layout/ComingSoon'

import aspectMessages from '~data/intl/aspectMessages'

function isCompanyAspect(value: string): value is CompanyAspect {
  return CompanyAspects.some(({ id }) => id === value)
}

// One page per aspect of the company. Any other segment is a page that does not exist
export const Route = createFileRoute('/-/$aspect')({
  params: {
    parse: ({ aspect }) => ({ aspect: aspect as CompanyAspect }),
    stringify: ({ aspect }) => ({ aspect }),
  },
  beforeLoad: ({ params }) => {
    if (!isCompanyAspect(params.aspect)) throw notFound()
  },
  component: AspectRoute,
})

function AspectRoute() {
  const { aspect } = Route.useParams()
  const { formatMessage } = useIntl()

  return (
    <ComingSoon page={formatMessage(aspectMessages[aspect])} />
  )
}
