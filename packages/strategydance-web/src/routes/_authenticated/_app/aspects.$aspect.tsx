import { createFileRoute, notFound } from '@tanstack/react-router'
import { useIntl } from 'react-intl'

import parseAspectSlug from '~utils/company/parseAspectSlug'
import toAspectSlug from '~utils/company/toAspectSlug'

import ComingSoon from '~components/layout/ComingSoon'

import aspectMessages from '~data/intl/aspectMessages'

/*
  One page per aspect of the company, explored or not, at its lowercase name under `aspects/`.
  Any other segment parses to null, which is a page that does not exist.

  Not at the root, where any static route of the same name outranks a dynamic segment: the public
  `/legal` would have hidden the Legal aspect, and the build would not have said so
*/
export const Route = createFileRoute('/_authenticated/_app/aspects/$aspect')({
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

  return <ComingSoon page={formatMessage(aspectMessages[aspect])} />
}
