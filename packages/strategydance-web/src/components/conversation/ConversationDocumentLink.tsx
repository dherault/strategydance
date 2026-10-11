import { Link } from '@tanstack/react-router'
import { FileTextIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import type { KnowledgeDocumentSummary } from '~types'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import readConversationDocumentId from '~utils/conversation/readConversationDocumentId'

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
  deleted, pruned or never there, is the agent's words struck through and muted. Until the
  documents are read, or when they could not be, the agent's words, neither linked nor struck
*/
function ConversationDocumentLink({ href, children, documents }: Props) {
  const organizationSlug = useCurrentOrganizationSlug()
  const documentId = readConversationDocumentId(href)

  if (!documents) {
    return (
      <span>
        <FileTextIcon className={ICON_CLASS_NAME} />
        {children}
      </span>
    )
  }

  const document = documentId ? documents.get(documentId) : undefined

  if (!document) {
    return (
      <span className="text-muted-foreground line-through">
        <FileTextIcon className={ICON_CLASS_NAME} />
        {children}
      </span>
    )
  }

  return (
    <Link
      to="/$organizationSlug/knowledge/$documentId"
      params={{ organizationSlug, documentId: document.id }}
      className="font-medium text-primary no-underline hover:text-primary-800 hover:underline"
    >
      <FileTextIcon className={ICON_CLASS_NAME} />
      {document.title.trim() || children}
    </Link>
  )
}

export default ConversationDocumentLink
