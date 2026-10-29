import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import documentMessages from '~data/intl/messages/document'

// Back to the list of every document, from the top of one's page
function DocumentsBackLink() {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()

  return (
    <Link
      to="/$organizationSlug/documents"
      params={{ organizationSlug }}
      className={buttonVariants({ variant: 'transparent', size: 'sm' })}
    >
      <ChevronLeftIcon />
      {formatMessage(documentMessages.allDocuments)}
    </Link>
  )
}

export default DocumentsBackLink
