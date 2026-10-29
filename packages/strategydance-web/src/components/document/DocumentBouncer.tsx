import { Link } from '@tanstack/react-router'
import { FileTextIcon } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { useIntl } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import useOrganizationDocument from '~hooks/document/useOrganizationDocument'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import DocumentLayout from '~components/document/DocumentLayout'
import DocumentLoadFailed from '~components/document/DocumentLoadFailed'
import DocumentsBackLink from '~components/document/DocumentsBackLink'

import documentMessages from '~data/intl/messages/document'

type Props = PropsWithChildren<{
  organizationId: string
  documentId: string
  // False for a draft, which is let through: there is nothing stored to judge
  isEnabled: boolean
}>

/*
  Sits under `DocumentWait`, so the read has landed: a document that could not be read
  gets a way to try again, one that does not exist says so, in this page's frame rather than the
  app's not found screen, since the address was a document's, and anything else is the page
*/
function DocumentBouncer({ organizationId, documentId, isEnabled, children }: Props) {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()
  const {
    data: organizationDocument,
    loading,
    refetch,
    hasFailed,
  } = useOrganizationDocument({ organizationId, documentId, isEnabled })

  if (!isEnabled) return children

  if (hasFailed) {
    return (
      <DocumentLayout>
        <div>
          <DocumentsBackLink />
        </div>
        <DocumentLoadFailed
          message={formatMessage(documentMessages.documentLoadError)}
          isRetrying={loading}
          onRetry={refetch}
        />
      </DocumentLayout>
    )
  }

  if (!organizationDocument) {
    return (
      <DocumentLayout>
        <div>
          <DocumentsBackLink />
        </div>
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>{formatMessage(documentMessages.notFoundTitle)}</EmptyTitle>
            <EmptyDescription>{formatMessage(documentMessages.notFoundText)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              to="/$organizationSlug/knowledge"
              params={{ organizationSlug }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {formatMessage(documentMessages.goToAll)}
            </Link>
          </EmptyContent>
        </Empty>
      </DocumentLayout>
    )
  }

  return children
}

export default DocumentBouncer
