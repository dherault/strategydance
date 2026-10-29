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

import useOrganizationDocuments from '~hooks/document/useOrganizationDocuments'

import filterDocuments from '~utils/document/filterDocuments'

import AddDocumentButton from '~components/document/AddDocumentButton'
import DocumentFilters from '~components/document/DocumentFilters'
import DocumentGrid from '~components/document/DocumentGrid'
import DocumentLoadFailed from '~components/document/DocumentLoadFailed'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'
import PageToolbar from '~components/layout/PageToolbar'
import ModuleAgentsButton from '~components/module/ModuleAgentsButton'

import documentMessages from '~data/intl/messages/document'
import navigationMessages from '~data/intl/messages/navigation'

/*
  The organization's documents, every one of them, the latest changed first. Each aspect's
  page shows the few tagged with it, and links here for the rest.

  Once there is any, its toolbar searches the documents' titles, the list holding none of their
  text, and filters them by aspect, and a search that leaves nothing says so with a way back
*/
function OrganizationDocuments() {
  const { formatMessage } = useIntl()
  const { data: organizationDocuments, loading, refetch, hasFailed } = useOrganizationDocuments()

  const [query, setQuery] = useState('')
  const [aspects, setAspects] = useState<CompanyAspect[]>([])

  const visibleDocuments = filterDocuments(organizationDocuments, { query, aspects })

  function clearFilters() {
    setQuery('')
    setAspects([])
  }

  function renderBody() {
    if (hasFailed) {
      return (
        <DocumentLoadFailed
          message={formatMessage(documentMessages.loadError)}
          isRetrying={loading}
          onRetry={refetch}
        />
      )
    }

    if (!organizationDocuments.length) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>{formatMessage(documentMessages.emptyTitle)}</EmptyTitle>
            <EmptyDescription>{formatMessage(documentMessages.emptyText)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <AddDocumentButton />
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
            <EmptyTitle>{formatMessage(documentMessages.noMatchTitle)}</EmptyTitle>
            <EmptyDescription>{formatMessage(documentMessages.noMatchText)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
            >
              {formatMessage(documentMessages.clearFilters)}
            </Button>
          </EmptyContent>
        </Empty>
      )
    }

    return <DocumentGrid organizationDocuments={visibleDocuments} />
  }

  return (
    <ContainerLayout className="gap-8">
      <PageHeader
        eyebrow={formatMessage(documentMessages.eyebrow)}
        title={formatMessage(navigationMessages.documents)}
        lead={
          organizationDocuments.length
            ? formatMessage(documentMessages.lead, { count: organizationDocuments.length })
            : undefined
        }
      />
      <div className="@container flex flex-col gap-3">
        <PageToolbar
          actions={
            <>
              <AddDocumentButton size="md" />
              <ModuleAgentsButton module="documents" />
            </>
          }
        >
          {organizationDocuments.length ? (
            <DocumentFilters
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

export default OrganizationDocuments
