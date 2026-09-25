import { createFileRoute, notFound } from '@tanstack/react-router'
import { useIntl } from 'react-intl'

import parseAspectSlug from '~utils/company/parseAspectSlug'
import toAspectSlug from '~utils/company/toAspectSlug'

import ComingSoon from '~components/layout/ComingSoon'

import aspectMessages from '~data/intl/aspectMessages'

/*
  One page per aspect of the company, explored or not, at its lowercase name. Any other segment
  parses to null, which is a page that does not exist
*/
export const Route = createFileRoute('/-/$aspect')({
  params: {
    parse: ({ aspect }) => ({ aspect: parseAspectSlug(aspect) }),
    stringify: ({ aspect }) => ({ aspect: aspect ? toAspectSlug(aspect) : '' }),
  },
  beforeLoad: ({ params }) => {
    if (!params.aspect) throw notFound()
  },
  component: AspectRoute,
})

function AspectRoute() {
  const { aspect } = Route.useParams()
  const { formatMessage } = useIntl()

  if (!aspect) return null

  return (
    <ComingSoon page={formatMessage(aspectMessages[aspect])} />
  )
}
