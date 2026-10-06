import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import useOrganizationKnowledgeDocuments from '~hooks/knowledge/useOrganizationKnowledgeDocuments'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import toAspectSlug from '~utils/company/toAspectSlug'

import AddKnowledgeDocumentButton from '~components/knowledge/AddKnowledgeDocumentButton'
import KnowledgeDocumentGrid from '~components/knowledge/KnowledgeDocumentGrid'
import KnowledgeLoadFailed from '~components/knowledge/KnowledgeLoadFailed'
import PageSection from '~components/layout/PageSection'

import aspectMessages from '~data/intl/aspectMessages'
import knowledgeMessages from '~data/intl/messages/knowledge'
import navigationMessages from '~data/intl/messages/navigation'

// How many documents an aspect's page shows, the latest changed, before "All knowledge"
const MAX_SHOWN = 6

type Props = {
  aspect: CompanyAspect
}

/*
  The knowledge section of an aspect's page: the latest documents tagged with it, and a way to add
  one already tagged. Read from the organization's whole list, which the Knowledge page keeps live
  too, rather than from a query of its own
*/
function AspectKnowledge({ aspect }: Props) {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: knowledgeDocuments, loading, refetch, hasFailed } = useOrganizationKnowledgeDocuments()

  const aspectName = formatMessage(aspectMessages[aspect])
  // The list comes the latest changed first
  const tagged = knowledgeDocuments.filter(knowledgeDocument => knowledgeDocument.aspects.includes(aspect))

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

    if (!tagged.length) {
      return (
        <Empty size="sm">
          <EmptyHeader>
            <EmptyMedia>
              <CompanyAspectIcon aspect={toAspectSlug(aspect)} />
            </EmptyMedia>
            <EmptyTitle>{formatMessage(knowledgeMessages.aspectEmptyTitle, { aspect: aspectName })}</EmptyTitle>
            <EmptyDescription>
              {formatMessage(knowledgeMessages.aspectEmptyText, { aspect: aspectName })}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }

    return <KnowledgeDocumentGrid knowledgeDocuments={tagged.slice(0, MAX_SHOWN)} />
  }

  return (
    <PageSection
      title={formatMessage(navigationMessages.knowledge)}
      actions={<AddKnowledgeDocumentButton aspect={aspect} />}
    >
      {renderBody()}
      {knowledgeDocuments.length ? (
        <div className="-mt-1 flex justify-end">
          <Link
            to="/$organizationSlug/knowledge"
            params={{ organizationSlug }}
            className="inline-flex items-center gap-1.5 text-sm font-medium no-underline"
          >
            {formatMessage(knowledgeMessages.allKnowledge)}
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      ) : null}
    </PageSection>
  )
}

export default AspectKnowledge
