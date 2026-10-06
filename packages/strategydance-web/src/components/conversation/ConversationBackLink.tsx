import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import conversationMessages from '~data/intl/messages/conversation'

// Back to the list of the reader's conversations, from the top of one's page
function ConversationBackLink() {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()

  return (
    <Link
      to="/$organizationSlug/conversations"
      params={{ organizationSlug }}
      className={buttonVariants({ variant: 'transparent', size: 'sm' })}
    >
      <ChevronLeftIcon />
      {formatMessage(conversationMessages.allConversations)}
    </Link>
  )
}

export default ConversationBackLink
