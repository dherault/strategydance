import { useIntl } from 'react-intl'
import { DOCUMENT_REVISION_LIFETIME_DAYS } from 'strategydance-core'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import type { RichTextMentionSource } from 'strategydance-design-system/lib/richText'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useNow from '~hooks/common/useNow'
import useDocumentRevisions from '~hooks/document/useDocumentRevisions'

import Spinner from '~components/common/Spinner'
import DocumentHistoryEntry from '~components/document/DocumentHistoryEntry'

import documentMessages from '~data/intl/messages/document'

type Props = {
  organizationId: string
  documentId: string
  // While the reader's own typing has not reached the server, which a restore would not see
  isRestoreHeld: boolean
  mentions: RichTextMentionSource
  onClose: () => void
}

/*
  A document's history: the text as it stood before each change an agent made to it, Strategy
  Dance's and an external agent's alike, and before each restore of one, the newest first, kept a
  month, live while it is open. Every member reads it, whatever the team lets agents do with the
  document, and restores any entry, which writes its text back as a new change, merged with
  whatever is typed meanwhile, and closes the history on the document
*/
function DocumentHistory({ organizationId, documentId, isRestoreHeld, mentions, onClose }: Props) {
  const { formatMessage } = useIntl()
  const { data: viewer } = useAuthentication()
  const now = useNow()
  const { revisions, isLoading, hasFailed } = useDocumentRevisions({ organizationId, documentId, isEnabled: true })

  function renderBody() {
    if (isLoading) return <Spinner className="mx-auto my-6" />

    if (hasFailed) {
      return <p className="m-0 text-sm text-muted-foreground">{formatMessage(documentMessages.historyError)}</p>
    }

    if (!revisions.length) {
      return (
        <p className="m-0 text-sm text-muted-foreground">
          {formatMessage(documentMessages.historyEmpty, { days: DOCUMENT_REVISION_LIFETIME_DAYS })}
        </p>
      )
    }

    return (
      <ol className="m-0 list-none divide-y divide-neutral-200 p-0">
        {revisions.map((revision, index) => (
          <DocumentHistoryEntry
            key={revision.id}
            organizationId={organizationId}
            documentId={documentId}
            revision={revision}
            laterCount={index}
            viewerId={viewer?.uid ?? null}
            isRestoreHeld={isRestoreHeld}
            now={now}
            mentions={mentions}
            onRestored={onClose}
          />
        ))}
      </ol>
    )
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(documentMessages.historyClose)}
        className="max-h-[calc(100dvh-3rem)] min-w-0 overflow-y-auto sm:max-w-[560px]"
      >
        <DialogHeader>
          <DialogTitle>{formatMessage(documentMessages.historyTitle)}</DialogTitle>
          <DialogDescription>
            {formatMessage(documentMessages.historyDescription, { days: DOCUMENT_REVISION_LIFETIME_DAYS })}
          </DialogDescription>
        </DialogHeader>
        {renderBody()}
      </DialogContent>
    </Dialog>
  )
}

export default DocumentHistory
