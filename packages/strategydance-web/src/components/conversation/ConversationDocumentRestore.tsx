import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useRestoreConversationDocument from '~hooks/conversation/useRestoreConversationDocument'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The document the row's call deleted
  documentId: string
}

/*
  Restore, on the row of a document Strategy Dance deleted, which the thread offers while the
  organization no longer holds it and a day has not passed since the call, so a member who sees a
  document go that they wanted kept needs no second request. Once restored, the live list holds it
  again and the thread takes the button away
*/
function ConversationDocumentRestore({ documentId }: Props) {
  const { formatMessage } = useIntl()
  const restore = useRestoreConversationDocument()
  const [isRestoring, setIsRestoring] = useState(false)

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
