import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LockIcon, LockOpenIcon } from 'lucide-react'
import { type FocusEvent, useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_DOCUMENT_TITLE_LENGTH } from 'strategydance-core'
import {
  type CompanyAspect,
  type GetOrganizationDocumentsData,
  deleteDocument,
  restoreDocument,
} from 'strategydance-database/web'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import type {
  RichTextEditorChange,
  RichTextEditorHandle,
} from 'strategydance-design-system/components/ui/RichTextEditor'
import { Textarea } from 'strategydance-design-system/components/ui/Textarea'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import type { KnowledgeDocument, KnowledgeDocumentFields } from '~types'

import useNow from '~hooks/common/useNow'
import useRichTextEditor from '~hooks/common/useRichTextEditor'
import useKnowledgeDocumentSaver from '~hooks/knowledge/useKnowledgeDocumentSaver'

import writeOptimistically from '~utils/common/writeOptimistically'

import Spinner from '~components/common/Spinner'
import KnowledgeBackLink from '~components/knowledge/KnowledgeBackLink'
import KnowledgeDocumentAspectIcons from '~components/knowledge/KnowledgeDocumentAspectIcons'
import KnowledgeDocumentAspectsDialog from '~components/knowledge/KnowledgeDocumentAspectsDialog'
import KnowledgeDocumentLayout from '~components/knowledge/KnowledgeDocumentLayout'
import KnowledgeDocumentMoreMenu from '~components/knowledge/KnowledgeDocumentMoreMenu'
import KnowledgeEditedAt from '~components/knowledge/KnowledgeEditedAt'
import KnowledgeLeaveDialog from '~components/knowledge/KnowledgeLeaveDialog'

import { dataConnect } from '~data/firebase'
import aspectMessages from '~data/intl/aspectMessages'
import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = {
  organizationId: string
  documentId: string
  // The stored document, or null for a draft
  knowledgeDocument: KnowledgeDocument | null
  // The aspect a draft starts tagged with, from the page it was added on
  draftAspect: CompanyAspect | null
}

/*
  One document of the organization's knowledge, written in place: its title, the aspects it is
  about, whether agents may change it, and its text. Nothing has a Save button. Each change goes
  through the saver once the reader pauses, and whatever is left goes when they leave the page,
  the tab or the page's fields.

  The editor is uncontrolled and seeded once, from the document read as the page opened, so the
  page reads it once too, into state, and nothing that arrives later reaches it. A draft is the
  same page at the id the document will have: the saver stores it once it has a title or some
  text, and the address then loses its `isNew`, which keeps this page mounted.

  A document emptied of its title and text is deleted as the page goes, as the design has it, and
  one deleted from the menu can be taken back from the notification for a few seconds
*/
function KnowledgeDocumentEditor({ organizationId, documentId, knowledgeDocument, draftAspect }: Props) {
  const { formatMessage, formatList, locale } = useIntl()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const now = useNow()
  const { RichTextEditor, hasFailed: hasEditorFailed } = useRichTextEditor()

  const [initial] = useState(() => ({
    fields: {
      title: knowledgeDocument?.title ?? '',
      content: knowledgeDocument?.content ?? '',
      aspects: knowledgeDocument?.aspects ?? (draftAspect ? [draftAspect] : []),
      isAiLocked: knowledgeDocument?.isAiLocked ?? false,
    } satisfies KnowledgeDocumentFields,
    revision: knowledgeDocument?.revision ?? null,
    updatedAt: knowledgeDocument?.updatedAt ?? null,
  }))
  const [title, setTitle] = useState(initial.fields.title)
  const [aspects, setAspects] = useState(initial.fields.aspects)
  const [isAiLocked, setIsAiLocked] = useState(initial.fields.isAiLocked)
  const [isStored, setIsStored] = useState(knowledgeDocument !== null)
  const [isPickingAspects, setIsPickingAspects] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<RichTextEditorHandle>(null)

  const { saver, status, savedAt, leave } = useKnowledgeDocumentSaver({
    organizationId,
    documentId,
    fields: initial.fields,
    revision: initial.revision,
    onCreated: () => {
      setIsStored(true)
      navigate({
        to: '/knowledge/$documentId',
        params: { documentId },
        search: {},
        replace: true,
        resetScroll: false,
      })
    },
  })

  const updatedAt = savedAt ?? initial.updatedAt

  // A new document starts in its title, as one opened to read starts nowhere
  useEffect(() => {
    if (!initial.fields.title && !initial.fields.content) titleRef.current?.focus()
  }, [initial])

  useEffect(() => {
    if (status === 'error') toast.error(formatMessage(knowledgeMessages.saveError))
  }, [status, formatMessage])

  function changeTitle(value: string) {
    // One line: a paste of several joins them
    const next = value.replace(/[\r\n]+/g, ' ')

    setTitle(next)
    saver.change({ title: next })
  }

  // Empty has one spelling, the one the server checks a discarded document for. Content too long
  // to save is the saver's to hold back, and the page says so
  function changeContent({ value, isEmpty }: RichTextEditorChange) {
    saver.change({ content: isEmpty ? '' : value })
  }

  // What else is left goes first, and a send that fails keeps the page. The words the server
  // refused are given up on purpose, so leaving does not ask
  async function reload() {
    if (await saver.settle()) window.location.reload()
  }

  function saveAspects(next: CompanyAspect[]) {
    setAspects(next)
    setIsPickingAspects(false)
    saver.change({ aspects: next })
  }

  function toggleAiLock() {
    const next = !isAiLocked

    setIsAiLocked(next)
    saver.change({ isAiLocked: next })

    if (isStored) toast(formatMessage(next ? knowledgeMessages.locked : knowledgeMessages.unlocked))
  }

  // Leaving the page's fields sends what is left, as leaving the page would
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) saver.flush()
  }

  async function handleDelete() {
    const listKey = ['GetOrganizationDocuments', organizationId]
    const rowKey = `knowledgeDocument:${documentId}`
    const deletedTitle = title.trim() || formatMessage(knowledgeMessages.untitled)

    // What was typed goes first, so an Undo brings it back, and a send that fails keeps the
    // document, which the failed send has already said
    if (!(await saver.settle())) return

    try {
      await writeOptimistically({
        queryClient,
        queryKeys: [listKey],
        rowKey,
        apply: () =>
          queryClient.setQueryData<GetOrganizationDocumentsData>(listKey, current =>
            current ? { documents: current.documents.filter(({ id }) => id !== documentId) } : current,
          ),
        write: () => deleteDocument(dataConnect, { organizationId, id: documentId }),
      })
    } catch (error) {
      console.error('The document could not be deleted', error)
      saver.resume()
      toast.error(formatMessage(knowledgeMessages.deleteError))

      return
    }

    navigate({ to: '/knowledge' })
    toast(formatMessage(knowledgeMessages.deleted, { title: deletedTitle }), {
      action: {
        label: formatMessage(knowledgeMessages.undo),
        onClick: () => {
          writeOptimistically({
            queryClient,
            queryKeys: [listKey],
            rowKey,
            // The list is read again once the document is back, where its last change puts it
            apply: () => undefined,
            write: () => restoreDocument(dataConnect, { organizationId, id: documentId }),
          }).catch(error => {
            console.error('The document could not be restored', error)
            toast.error(formatMessage(knowledgeMessages.restoreError))
          })
        },
      },
    })
  }

  function renderMeta() {
    if (status === 'pending' || status === 'saving') return formatMessage(knowledgeMessages.saving)
    if (status === 'error' || status === 'tooLong' || status === 'conflict') {
      return formatMessage(knowledgeMessages.notSaved)
    }
    if (!isStored || !updatedAt) return formatMessage(knowledgeMessages.draft)

    return (
      <KnowledgeEditedAt
        updatedAt={updatedAt}
        now={now}
      />
    )
  }

  const aspectNames = aspects.map(aspect => formatMessage(aspectMessages[aspect]))

  return (
    <KnowledgeDocumentLayout onBlur={handleBlur}>
      <div className="flex items-center gap-3">
        <KnowledgeBackLink />
        <span
          aria-live="polite"
          className="ml-auto min-w-0 text-right text-sm text-muted-foreground"
        >
          {renderMeta()}
        </span>
        {isStored ? <KnowledgeDocumentMoreMenu onDelete={handleDelete} /> : null}
      </div>
      {status === 'conflict' ? (
        <Alert
          variant="warning"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
            >
              {formatMessage(knowledgeMessages.reload)}
            </Button>
          }
        >
          {formatMessage(knowledgeMessages.conflict)}
        </Alert>
      ) : null}
      <Textarea
        ref={titleRef}
        autosize
        rows={1}
        value={title}
        maxLength={MAX_DOCUMENT_TITLE_LENGTH}
        placeholder={formatMessage(knowledgeMessages.untitled)}
        aria-label={formatMessage(knowledgeMessages.titleLabel)}
        onChange={event => changeTitle(event.target.value)}
        onKeyDown={event => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return

          event.preventDefault()
          editorRef.current?.focus()
        }}
        className="h-auto overflow-hidden rounded-none border-0 bg-transparent p-0 font-heading text-5xl leading-[1.1] font-normal tracking-tight text-secondary placeholder:text-neutral-400 focus:bg-transparent"
      />
      <div className="-mt-3 mb-0.5 flex min-h-8 items-center gap-2 text-sm text-muted-foreground">
        <button
          type="button"
          aria-label={
            aspects.length
              ? formatMessage(knowledgeMessages.editAspects, {
                  aspects: formatList(aspectNames, { type: 'conjunction' }),
                })
              : undefined
          }
          onClick={() => setIsPickingAspects(true)}
          className="flex h-8 cursor-pointer items-center rounded-xs border-0 bg-transparent px-1 font-sans text-sm text-neutral-600 transition-colors duration-150 ease-in-out hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          {aspects.length ? (
            <KnowledgeDocumentAspectIcons
              aspects={aspects}
              size={18}
              className="gap-2 px-1"
            />
          ) : (
            <span className="px-2">{formatMessage(knowledgeMessages.addAspects)}</span>
          )}
        </button>
        <span
          aria-hidden="true"
          className="h-5 w-px bg-border"
        />
        <Tooltip
          content={formatMessage(isAiLocked ? knowledgeMessages.lockedTooltip : knowledgeMessages.lock)}
          side="bottom"
        >
          <Button
            variant="transparent"
            size="sm"
            icon={isAiLocked ? <LockIcon /> : <LockOpenIcon />}
            aria-label={formatMessage(isAiLocked ? knowledgeMessages.unlock : knowledgeMessages.lock)}
            aria-pressed={isAiLocked}
            onClick={toggleAiLock}
          />
        </Tooltip>
      </div>
      {status === 'tooLong' ? (
        <p
          role="alert"
          className="m-0 text-sm text-danger"
        >
          {formatMessage(knowledgeMessages.tooLong)}
        </p>
      ) : null}
      {RichTextEditor ? (
        <RichTextEditor
          ref={editorRef}
          appearance="document"
          initialValue={initial.fields.content || null}
          placeholder={formatMessage(knowledgeMessages.bodyPlaceholder)}
          aria-label={formatMessage(knowledgeMessages.bodyLabel)}
          locale={locale}
          labels={{ turnInto: formatMessage(knowledgeMessages.editorTurnInto) }}
          onChange={changeContent}
          className="border-t border-neutral-200"
        />
      ) : (
        // Holds the editor's height while it loads, so the page does not jump when it arrives
        <div className="flex min-h-[360px] items-start gap-2 border-t border-neutral-200 pt-4 text-sm text-muted-foreground">
          {hasEditorFailed ? (
            formatMessage(knowledgeMessages.editorError)
          ) : (
            <>
              <Spinner
                size="sm"
                tone="muted"
              />
              {formatMessage(knowledgeMessages.loadingEditor)}
            </>
          )}
        </div>
      )}
      {leave.status === 'blocked' ? (
        <KnowledgeLeaveDialog
          onStay={leave.reset}
          onLeave={leave.proceed}
        />
      ) : null}
      {isPickingAspects ? (
        <KnowledgeDocumentAspectsDialog
          aspects={aspects}
          onSave={saveAspects}
          onClose={() => setIsPickingAspects(false)}
        />
      ) : null}
    </KnowledgeDocumentLayout>
  )
}

export default KnowledgeDocumentEditor
