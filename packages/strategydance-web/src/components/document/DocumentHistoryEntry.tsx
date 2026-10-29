import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { ERROR_CODE_NOT_FOUND } from 'strategydance-core'
import type { GetDocumentRevisionsData } from 'strategydance-database/web'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import type { RichTextMentionSource } from 'strategydance-design-system/lib/richText'

import useRestoreDocumentRevision from '~hooks/document/useRestoreDocumentRevision'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import readDocumentRevisionSource from '~utils/document/readDocumentRevisionSource'

import DocumentRevisionPreview from '~components/document/DocumentRevisionPreview'
import DocumentRevisionTime from '~components/document/DocumentRevisionTime'

import { ApiError } from '~data/api'
import knowledgeMessages from '~data/intl/messages/knowledge'

type DocumentRevision = GetDocumentRevisionsData['documentRevisions'][number]

type Props = {
  organizationId: string
  documentId: string
  revision: DocumentRevision
  // How many entries came after it, which a restore takes back too
  laterCount: number
  // The reader, whose own conversations an entry links to
  viewerId: string | null
  // While the reader's own typing has not reached the server, which a restore would not see
  isRestoreHeld: boolean
  now: number
  mentions: RichTextMentionSource
  // Once its text is written back, for the history to close on the document
  onRestored: () => void
}

/*
  One entry of a document's history: who made the change and from where, Strategy Dance in a
  member's conversation, an agent a member connected, or a member's restore, and when, with the
  text as it stood before it, opened on demand, and Restore this version, which says first what
  goes with it: every later entry, and whatever members typed since. A restore keeps an entry of
  its own, and its notification can undo it.

  The conversation an edit came from is the member's own and private, so only its author is
  offered the link to it
*/
function DocumentHistoryEntry({
  organizationId,
  documentId,
  revision,
  laterCount,
  viewerId,
  isRestoreHeld,
  now,
  mentions,
  onRestored,
}: Props) {
  const { formatMessage, formatDate } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()
  const restore = useRestoreDocumentRevision()
  const [isOpen, setIsOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const source = readDocumentRevisionSource(revision.scope)
  const name = revision.user
    ? revision.user.displayName || revision.user.email
    : formatMessage(knowledgeMessages.revisionFormerMember)
  const isOwnConversation = source.kind === 'conversation' && revision.user?.id === viewerId

  function formatMoment(date: string) {
    return formatDate(date, { dateStyle: 'medium', timeStyle: 'short' })
  }

  function getTitle() {
    if (source.kind === 'conversation') return formatMessage(knowledgeMessages.revisionByStrategyDance, { name })
    if (source.kind === 'connection') return formatMessage(knowledgeMessages.revisionByAgent, { name })

    return formatMessage(knowledgeMessages.revisionRestored, {
      name,
      date: revision.restoredVersionAt ? formatMoment(revision.restoredVersionAt) : '',
    })
  }

  async function undoRestore(restoredId: string) {
    try {
      await restore({ documentId, revisionId: restoredId, isUndo: true })
    } catch (error) {
      console.error('The restore of a version could not be undone', error)
      toast.error(formatMessage(knowledgeMessages.restoreUndoError))
    }
  }

  async function handleRestore() {
    setIsRestoring(true)

    try {
      const restoredId = await restore({ documentId, revisionId: revision.id, isUndo: false })

      toast(
        formatMessage(knowledgeMessages.versionRestored, { date: formatMoment(revision.createdAt) }),
        restoredId
          ? { action: { label: formatMessage(knowledgeMessages.undoRestore), onClick: () => undoRestore(restoredId) } }
          : undefined,
      )
      onRestored()
    } catch (error) {
      console.error('A version of a document could not be restored', error)

      if (error instanceof ApiError && error.code === ERROR_CODE_NOT_FOUND) {
        toast.error(formatMessage(knowledgeMessages.versionGone))
      } else if (error instanceof ApiError && error.status === 409) {
        toast.error(formatMessage(knowledgeMessages.versionUnrestorable))
      } else {
        toast.error(formatMessage(knowledgeMessages.versionRestoreError))
      }

      setIsRestoring(false)
    }
  }

  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <Avatar
        size="sm"
        name={name}
        src={revision.user?.imageThumbnailUrl ?? revision.user?.imageUrl ?? undefined}
        alt=""
        className="mt-0.5 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="m-0 text-sm font-medium text-foreground">{getTitle()}</p>
          <p className="m-0 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <DocumentRevisionTime
              createdAt={revision.createdAt}
              now={now}
            />
            {isOwnConversation ? (
              <Link
                to="/$organizationSlug/conversations/$conversationId"
                params={{ organizationSlug, conversationId: source.conversationId }}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {formatMessage(knowledgeMessages.revisionOpenConversation)}
              </Link>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-expanded={isOpen}
            onClick={() => setIsOpen(open => !open)}
          >
            {formatMessage(isOpen ? knowledgeMessages.revisionHide : knowledgeMessages.revisionView)}
          </Button>
          {isConfirming ? null : (
            <Button
              variant="transparent"
              size="sm"
              onClick={() => setIsConfirming(true)}
            >
              {formatMessage(knowledgeMessages.restoreVersion)}
            </Button>
          )}
        </div>
        {isConfirming ? (
          <div
            role="group"
            aria-label={formatMessage(knowledgeMessages.restoreVersion)}
            className="flex flex-col gap-3 rounded-md border border-neutral-200 px-4 py-3"
          >
            <p className="m-0 text-sm text-foreground">
              {formatMessage(knowledgeMessages.restoreVersionWarning, { count: laterCount })}
            </p>
            {isRestoreHeld ? (
              <p className="m-0 text-sm text-muted-foreground">
                {formatMessage(knowledgeMessages.restoreVersionWaiting)}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="transparent"
                size="sm"
                disabled={isRestoring}
                onClick={() => setIsConfirming(false)}
              >
                {formatMessage(knowledgeMessages.restoreVersionCancel)}
              </Button>
              <Button
                size="sm"
                disabled={isRestoring || isRestoreHeld}
                onClick={handleRestore}
              >
                {formatMessage(knowledgeMessages.restoreVersionConfirm)}
              </Button>
            </div>
          </div>
        ) : null}
        {isOpen ? (
          <DocumentRevisionPreview
            organizationId={organizationId}
            revisionId={revision.id}
            mentions={mentions}
          />
        ) : null}
      </div>
    </li>
  )
}

export default DocumentHistoryEntry
