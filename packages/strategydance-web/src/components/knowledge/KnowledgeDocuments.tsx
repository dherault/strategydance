import { BookOpenIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import useOrganizationKnowledgeDocuments from '~hooks/knowledge/useOrganizationKnowledgeDocuments'

import AddKnowledgeDocumentButton from '~components/knowledge/AddKnowledgeDocumentButton'
import KnowledgeDocumentGrid from '~components/knowledge/KnowledgeDocumentGrid'
import KnowledgeLoadFailed from '~components/knowledge/KnowledgeLoadFailed'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'

import knowledgeMessages from '~data/intl/messages/knowledge'
import navigationMessages from '~data/intl/messages/navigation'

/*
  The organization's knowledge, every document of it, the latest changed first. Each aspect's
  page shows the few tagged with it, and links here for the rest
*/
function KnowledgeDocuments() {
  const { formatMessage } = useIntl()
  const { data: knowledgeDocuments, loading, refetch, hasFailed } = useOrganizationKnowledgeDocuments()

  function renderBody() {
    if (hasFailed) {
      return (
        <KnowledgeLoadFailed
          message={formatMessage(knowledgeMessages.loadError)}
          isRetrying={loading}
          onRetry={refetch}
        />
      )
    }

    if (!knowledgeDocuments.length) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>{formatMessage(knowledgeMessages.emptyTitle)}</EmptyTitle>
            <EmptyDescription>{formatMessage(knowledgeMessages.emptyText)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <AddKnowledgeDocumentButton />
          </EmptyContent>
        </Empty>
      )
    }

    return <KnowledgeDocumentGrid knowledgeDocuments={knowledgeDocuments} />
  }

  return (
    <ContainerLayout className="gap-8">
      <PageHeader
        title={formatMessage(navigationMessages.knowledge)}
        lead={
          knowledgeDocuments.length
            ? formatMessage(knowledgeMessages.lead, { count: knowledgeDocuments.length })
            : undefined
        }
        actions={<AddKnowledgeDocumentButton />}
      />
      {renderBody()}
    </ContainerLayout>
  )
}

export default KnowledgeDocuments
