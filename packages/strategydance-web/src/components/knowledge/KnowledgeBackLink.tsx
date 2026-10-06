import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import knowledgeMessages from '~data/intl/messages/knowledge'

// Back to the list of every document, from the top of one's page
function KnowledgeBackLink() {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()

  return (
    <Link
      to="/$organizationSlug/knowledge"
      params={{ organizationSlug }}
      className={buttonVariants({ variant: 'transparent', size: 'sm' })}
    >
      <ChevronLeftIcon />
      {formatMessage(knowledgeMessages.allKnowledge)}
    </Link>
  )
}

export default KnowledgeBackLink
