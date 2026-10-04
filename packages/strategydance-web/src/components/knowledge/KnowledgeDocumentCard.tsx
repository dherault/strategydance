import { Link } from '@tanstack/react-router'
import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import type { KnowledgeDocumentSummary } from '~types'

import CompanyAspectIcons from '~components/company/CompanyAspectIcons'
import KnowledgeEditedAt from '~components/knowledge/KnowledgeEditedAt'

import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = {
  knowledgeDocument: KnowledgeDocumentSummary
  now: number
}

// One document in a grid of them: its title, the aspects it is about, and when it last changed
function KnowledgeDocumentCard({ knowledgeDocument, now }: Props) {
  const { formatMessage } = useIntl()
  const title = knowledgeDocument.title.trim()

  return (
    <Link
      to="/knowledge/$documentId"
      params={{ documentId: knowledgeDocument.id }}
      className="box-border flex min-h-28 min-w-0 flex-col gap-2 rounded-xs border border-neutral-200 bg-white p-4 text-foreground no-underline transition-colors duration-150 ease-in-out hover:border-neutral-300 hover:bg-neutral-50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    >
      <h3
        className={cn(
          'm-0 line-clamp-2 font-sans text-lg leading-[1.35] font-semibold tracking-normal wrap-anywhere',
          !title && 'font-medium text-muted-foreground',
        )}
      >
        {title || formatMessage(knowledgeMessages.untitled)}
      </h3>
      <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-muted-foreground">
        <CompanyAspectIcons
          aspects={knowledgeDocument.aspects}
          size={14}
          className="gap-1.5 text-neutral-500"
        />
        <KnowledgeEditedAt
          updatedAt={knowledgeDocument.updatedAt}
          now={now}
          className="ml-auto whitespace-nowrap"
        />
      </div>
    </Link>
  )
}

export default KnowledgeDocumentCard
