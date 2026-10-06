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

import useKnowledgeDocument from '~hooks/knowledge/useKnowledgeDocument'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import KnowledgeBackLink from '~components/knowledge/KnowledgeBackLink'
import KnowledgeDocumentLayout from '~components/knowledge/KnowledgeDocumentLayout'
import KnowledgeLoadFailed from '~components/knowledge/KnowledgeLoadFailed'

import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = PropsWithChildren<{
  organizationId: string
  documentId: string
  // False for a draft, which is let through: there is nothing stored to judge
  isEnabled: boolean
}>

/*
  Sits under `KnowledgeDocumentWait`, so the read has landed: a document that could not be read
  gets a way to try again, one that does not exist says so, in this page's frame rather than the
  app's not found screen, since the address was a document's, and anything else is the page
*/
function KnowledgeDocumentBouncer({ organizationId, documentId, isEnabled, children }: Props) {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()
  const {
    data: knowledgeDocument,
    loading,
    refetch,
    hasFailed,
  } = useKnowledgeDocument({ organizationId, documentId, isEnabled })

  if (!isEnabled) return children

  if (hasFailed) {
    return (
      <KnowledgeDocumentLayout>
        <div>
          <KnowledgeBackLink />
        </div>
        <KnowledgeLoadFailed
          message={formatMessage(knowledgeMessages.documentLoadError)}
          isRetrying={loading}
          onRetry={refetch}
        />
      </KnowledgeDocumentLayout>
    )
  }

  if (!knowledgeDocument) {
    return (
      <KnowledgeDocumentLayout>
        <div>
          <KnowledgeBackLink />
        </div>
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>{formatMessage(knowledgeMessages.notFoundTitle)}</EmptyTitle>
            <EmptyDescription>{formatMessage(knowledgeMessages.notFoundText)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              to="/$organizationSlug/knowledge"
              params={{ organizationSlug }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {formatMessage(knowledgeMessages.goToAll)}
            </Link>
          </EmptyContent>
        </Empty>
      </KnowledgeDocumentLayout>
    )
  }

  return children
}

export default KnowledgeDocumentBouncer
