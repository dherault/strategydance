import { createFileRoute, notFound } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import parseAspectSlug from '~utils/company/parseAspectSlug'
import toAspectSlug from '~utils/company/toAspectSlug'

import AspectPage from '~components/company/AspectPage'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import KnowledgeDocumentsWait from '~components/knowledge/KnowledgeDocumentsWait'

// At module scope so the reference is stable across renders
const ASPECT_MESSAGE_TYPES: MessageType[] = ['aspect', 'knowledge']

/*
  One page per aspect of the company, explored or not, at its lowercase name under `aspects/`.
  Any other segment parses to null, which is a page that does not exist.

  Not at the root, where any static route of the same name outranks a dynamic segment: the public
  `/legal` would have hidden the Legal aspect, and the build would not have said so.

  The page waits for the organization's knowledge, which its section lists the latest of
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
  const { organization } = useCurrentOrganization()

  if (!aspect) return null

  return (
    <IntlMessagesRegistration messageTypes={ASPECT_MESSAGE_TYPES}>
      <KnowledgeDocumentsWait key={organization?.id ?? 'none'}>
        <AspectPage aspect={aspect} />
      </KnowledgeDocumentsWait>
    </IntlMessagesRegistration>
  )
}
