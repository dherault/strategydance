import { Link } from '@tanstack/react-router'
import { FileTextIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'

import type { KnowledgeDocumentSummary } from '~types'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import readConversationLinkTarget from '~utils/conversation/readConversationLinkTarget'

import conversationMessages from '~data/intl/messages/conversation'

const ICON_CLASS_NAME = 'mr-[3px] inline-block size-[13px] align-[-2px]'

type Props = {
  href: string
  // The link's words, as the agent wrote them
  children: ReactNode
  // The organization's documents by id, or null while they are not read
  documents: ReadonlyMap<string, KnowledgeDocumentSummary> | null
}

/*
  A link to knowledge in Strategy Dance's reply, `doc:<id>`: the document's current title with a
  file icon, opening it, whatever the agent wrote. A document the organization no longer holds,
  deleted, pruned or never there, is the agent's words struck through and muted, which a screen
  reader hears said. A link naming no document's id is the agent's words, neither linked nor
  struck, and so is every link until the documents are read, or when they could not be
*/
function ConversationDocumentLink({ href, children, documents }: Props) {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()
  const target = readConversationLinkTarget(href, 'doc', documents)

  if (target.kind === 'words') {
    return (
      <span>
        <FileTextIcon className={ICON_CLASS_NAME} />
        {children}
      </span>
    )
  }

  if (target.kind === 'gone') {
    return (
      <span className="text-muted-foreground line-through">
        <FileTextIcon className={ICON_CLASS_NAME} />
        {children}
        <span className="sr-only"> {formatMessage(conversationMessages.documentGone)}</span>
      </span>
    )
  }

  return (
    <Link
      to="/$organizationSlug/knowledge/$documentId"
      params={{ organizationSlug, documentId: target.item.id }}
      className="font-medium text-primary no-underline hover:text-primary-800 hover:underline"
    >
      <FileTextIcon className={ICON_CLASS_NAME} />
      {target.item.title.trim() || children}
    </Link>
  )
}

export default ConversationDocumentLink
