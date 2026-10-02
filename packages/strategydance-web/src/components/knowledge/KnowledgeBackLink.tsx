import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'

import knowledgeMessages from '~data/intl/messages/knowledge'

// Back to the list of every document, from the top of one's page
function KnowledgeBackLink() {
  const { formatMessage } = useIntl()

  return (
    <Link
      to="/knowledge"
      className={buttonVariants({ variant: 'transparent', size: 'sm' })}
    >
      <ChevronLeftIcon />
      {formatMessage(knowledgeMessages.allKnowledge)}
    </Link>
  )
}

export default KnowledgeBackLink
