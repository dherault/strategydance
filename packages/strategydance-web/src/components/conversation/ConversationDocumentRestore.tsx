import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { KnowledgeDocumentSummary } from '~types'

import useNow from '~hooks/common/useNow'
import useConversationDeletedDocument from '~hooks/conversation/useConversationDeletedDocument'
import useRestoreConversationDocument from '~hooks/conversation/useRestoreConversationDocument'

import canRestoreConversationDocument from '~utils/conversation/canRestoreConversationDocument'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The `delete_document` call's message, whose output names the document
  messageId: string
  // The organization's documents by id, or null while they are not read
  documents: ReadonlyMap<string, KnowledgeDocumentSummary> | null
}

/*
  Restore, on the row of a document Strategy Dance deleted, while the organization no longer holds
  it and a day has not passed since the call, so a member who sees a document go that they wanted
  kept needs no second request. Once restored, the live list holds it again and the button goes
*/
function ConversationDocumentRestore({ messageId, documents }: Props) {
  const { formatMessage } = useIntl()
  const now = useNow()
  const deleted = useConversationDeletedDocument(messageId)
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
