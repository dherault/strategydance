import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { ERROR_CODE_CONFLICT } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useRestoreDocumentRevision from '~hooks/document/useRestoreDocumentRevision'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import { ApiError } from '~data/api'
import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The document the row's call edited
  documentId: string
  // The revision the edit kept of the text it replaced
  revisionId: string
}

/*
  Undo, on the row of an edit Strategy Dance made to a document, which the thread offers while
  nobody has written in the document since: the text goes back to how it stood before the edit,
  as a new edit a notification can redo. Somebody writing meanwhile refuses it, and the reader is
  sent to the document's history, which can still bring that text back with what was written since.
  Once undone, the row's edit is no longer the text, and the thread takes the button away
*/
function ConversationDocumentUndo({ documentId, revisionId }: Props) {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const restore = useRestoreDocumentRevision()
  const [isUndoing, setIsUndoing] = useState(false)

  function openHistory() {
    navigate({
      to: '/$organizationSlug/knowledge/$documentId',
      params: { organizationSlug, documentId },
      search: { history: true },
    })
  }

  async function redo(restoredId: string) {
    try {
      await restore({ documentId, revisionId: restoredId, isUndo: true })
    } catch (error) {
      console.error('An undone edit of a document could not be made again', error)
      toast.error(formatMessage(conversationMessages.redoDocumentEditError))
    }
  }

  async function handleUndo() {
    setIsUndoing(true)

    try {
      const restoredId = await restore({ documentId, revisionId, isUndo: true })

      toast(
        formatMessage(conversationMessages.documentEditUndone),
        restoredId
          ? { action: { label: formatMessage(conversationMessages.redoDocumentEdit), onClick: () => redo(restoredId) } }
          : undefined,
      )
    } catch (error) {
      if (error instanceof ApiError && error.code === ERROR_CODE_CONFLICT) {
        toast.error(formatMessage(conversationMessages.documentEditChangedSince), {
          action: { label: formatMessage(conversationMessages.openDocumentHistory), onClick: openHistory },
        })
      } else {
        console.error('An edit of a document could not be undone', error)
        toast.error(formatMessage(conversationMessages.undoDocumentEditError))
      }
    } finally {
      setIsUndoing(false)
    }
  }

  return (
    <Button
      variant="transparent"
      size="sm"
      className="max-sm:px-2"
      disabled={isUndoing}
      onClick={handleUndo}
    >
      {formatMessage(conversationMessages.undoDocumentEdit)}
    </Button>
  )
}

export default ConversationDocumentUndo
