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

import useOrganizationDocuments from '~hooks/document/useOrganizationDocuments'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import toAspectSlug from '~utils/company/toAspectSlug'

import AddDocumentButton from '~components/document/AddDocumentButton'
import DocumentGrid from '~components/document/DocumentGrid'
import DocumentLoadFailed from '~components/document/DocumentLoadFailed'
import PageSection from '~components/layout/PageSection'

import aspectMessages from '~data/intl/aspectMessages'
import documentMessages from '~data/intl/messages/document'
import navigationMessages from '~data/intl/messages/navigation'

// How many documents an aspect's page shows, the latest changed, before "All documents"
const MAX_SHOWN = 6

type Props = {
  aspect: CompanyAspect
}

/*
  The documents section of an aspect's page: the latest documents tagged with it, and a way to add
  one already tagged. Read from the organization's whole list, which the Documents page keeps live
  too, rather than from a query of its own
*/
function AspectDocuments({ aspect }: Props) {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: organizationDocuments, loading, refetch, hasFailed } = useOrganizationDocuments()

  const aspectName = formatMessage(aspectMessages[aspect])
  // The list comes the latest changed first
  const tagged = organizationDocuments.filter(organizationDocument => organizationDocument.aspects.includes(aspect))

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

    if (!tagged.length) {
      return (
        <Empty size="sm">
          <EmptyHeader>
            <EmptyMedia>
              <CompanyAspectIcon aspect={toAspectSlug(aspect)} />
            </EmptyMedia>
            <EmptyTitle>{formatMessage(documentMessages.aspectEmptyTitle, { aspect: aspectName })}</EmptyTitle>
            <EmptyDescription>
              {formatMessage(documentMessages.aspectEmptyText, { aspect: aspectName })}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }

    return <DocumentGrid organizationDocuments={tagged.slice(0, MAX_SHOWN)} />
  }

  return (
    <PageSection
      title={formatMessage(navigationMessages.documents)}
      actions={<AddDocumentButton aspect={aspect} />}
    >
      {renderBody()}
      {organizationDocuments.length ? (
        <div className="-mt-1 flex justify-end">
          <Link
            to="/$organizationSlug/documents"
            params={{ organizationSlug }}
            className="inline-flex items-center gap-1.5 text-sm font-medium no-underline"
          >
            {formatMessage(documentMessages.allDocuments)}
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      ) : null}
    </PageSection>
  )
}

export default AspectDocuments
