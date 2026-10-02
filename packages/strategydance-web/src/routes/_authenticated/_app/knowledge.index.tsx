import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import KnowledgeDocuments from '~components/knowledge/KnowledgeDocuments'
import KnowledgeDocumentsWait from '~components/knowledge/KnowledgeDocumentsWait'

// At module scope so the reference is stable across renders
const KNOWLEDGE_MESSAGE_TYPES: MessageType[] = ['knowledge']

// Every document of the current organization's knowledge
export const Route = createFileRoute('/_authenticated/_app/knowledge/')({
  component: KnowledgeRoute,
})

function KnowledgeRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={KNOWLEDGE_MESSAGE_TYPES}>
      <KnowledgeDocumentsWait key={organization?.id ?? 'none'}>
        <KnowledgeDocuments />
      </KnowledgeDocumentsWait>
    </IntlMessagesRegistration>
  )
}
