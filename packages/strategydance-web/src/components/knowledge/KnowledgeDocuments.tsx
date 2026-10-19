import { BookOpenIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import useOrganizationKnowledgeDocuments from '~hooks/knowledge/useOrganizationKnowledgeDocuments'

import filterKnowledgeDocuments from '~utils/knowledge/filterKnowledgeDocuments'

import AddKnowledgeDocumentButton from '~components/knowledge/AddKnowledgeDocumentButton'
import KnowledgeDocumentFilters from '~components/knowledge/KnowledgeDocumentFilters'
import KnowledgeDocumentGrid from '~components/knowledge/KnowledgeDocumentGrid'
import KnowledgeLoadFailed from '~components/knowledge/KnowledgeLoadFailed'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'
import PageToolbar from '~components/layout/PageToolbar'
import ModuleAgentsButton from '~components/module/ModuleAgentsButton'

import knowledgeMessages from '~data/intl/messages/knowledge'
import navigationMessages from '~data/intl/messages/navigation'

/*
  The organization's knowledge, every document of it, the latest changed first. Each aspect's
  page shows the few tagged with it, and links here for the rest.

  Once there is any, its toolbar searches the documents' titles, the list holding none of their
  text, and filters them by aspect, and a search that leaves nothing says so with a way back
*/
function KnowledgeDocuments() {
  const { formatMessage } = useIntl()
  const { data: knowledgeDocuments, loading, refetch, hasFailed } = useOrganizationKnowledgeDocuments()

  const [query, setQuery] = useState('')
  const [aspects, setAspects] = useState<CompanyAspect[]>([])

  const visibleDocuments = filterKnowledgeDocuments(knowledgeDocuments, { query, aspects })

  function clearFilters() {
    setQuery('')
    setAspects([])
  }

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

    if (!visibleDocuments.length) {
      return (
        <Empty size="sm">
          <EmptyHeader>
            <EmptyMedia>
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>{formatMessage(knowledgeMessages.noMatchTitle)}</EmptyTitle>
            <EmptyDescription>{formatMessage(knowledgeMessages.noMatchText)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
            >
              {formatMessage(knowledgeMessages.clearFilters)}
            </Button>
          </EmptyContent>
        </Empty>
      )
    }

    return <KnowledgeDocumentGrid knowledgeDocuments={visibleDocuments} />
  }

  return (
    <ContainerLayout className="gap-8">
      <PageHeader
        eyebrow={formatMessage(knowledgeMessages.eyebrow)}
        title={formatMessage(navigationMessages.knowledge)}
        lead={
          knowledgeDocuments.length
            ? formatMessage(knowledgeMessages.lead, { count: knowledgeDocuments.length })
            : undefined
        }
      />
      <div className="@container flex flex-col gap-3">
        <PageToolbar
          actions={
            <>
              <AddKnowledgeDocumentButton size="md" />
              <ModuleAgentsButton module="knowledge" />
            </>
          }
        >
          {knowledgeDocuments.length ? (
            <KnowledgeDocumentFilters
              query={query}
              aspects={aspects}
              onQueryChange={setQuery}
              onAspectsChange={setAspects}
            />
          ) : null}
        </PageToolbar>
        {renderBody()}
      </div>
    </ContainerLayout>
  )
}

export default KnowledgeDocuments
