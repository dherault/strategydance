import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { KnowledgeDocumentSummary } from '~types'

import useRestoreConversationDocument from '~hooks/conversation/useRestoreConversationDocument'

import canRestoreConversationDocument from '~utils/conversation/canRestoreConversationDocument'
import type { ConversationDeletedDocument } from '~utils/conversation/readConversationDeletedDocument'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The document the row's call deleted, as its output said, or null until the thread read it
  deleted: ConversationDeletedDocument | null
  // The organization's documents by id, or null while they are not read
  documents: ReadonlyMap<string, KnowledgeDocumentSummary> | null
  // The time now, which the thread reads once for all its rows
  now: number
}

/*
  Restore, on the row of a document Strategy Dance deleted, while the organization no longer holds
  it and a day has not passed since the call, so a member who sees a document go that they wanted
  kept needs no second request. Once restored, the live list holds it again and the button goes
*/
function ConversationDocumentRestore({ deleted, documents, now }: Props) {
  const { formatMessage } = useIntl()
  const restore = useRestoreConversationDocument()
  const [isRestoring, setIsRestoring] = useState(false)

  if (!deleted || !canRestoreConversationDocument(deleted, documents, now)) return null

  const { documentId } = deleted

  async function handleRestore() {
    setIsRestoring(true)

    try {
      await restore(documentId)
    } catch {
      toast.error(formatMessage(conversationMessages.restoreDocumentError))
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <Button
      variant="transparent"
      size="sm"
      className="max-sm:px-2"
      disabled={isRestoring}
      onClick={handleRestore}
    >
      {formatMessage(conversationMessages.restoreDocument)}
    </Button>
  )
}

export default ConversationDocumentRestore
