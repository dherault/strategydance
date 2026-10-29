import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import OrganizationDocuments from '~components/document/OrganizationDocuments'
import OrganizationDocumentsWait from '~components/document/OrganizationDocumentsWait'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// At module scope so the reference is stable across renders
const KNOWLEDGE_MESSAGE_TYPES: MessageType[] = ['knowledge']

// Every document of the current organization's knowledge
export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/knowledge/')({
  component: DocumentsRoute,
})

function DocumentsRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={KNOWLEDGE_MESSAGE_TYPES}>
      <OrganizationDocumentsWait key={organization?.id ?? 'none'}>
        <OrganizationDocuments />
      </OrganizationDocumentsWait>
    </IntlMessagesRegistration>
  )
}
