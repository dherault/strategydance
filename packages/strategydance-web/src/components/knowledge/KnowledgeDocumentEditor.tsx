import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type FocusEvent, useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import {
  MAX_DOCUMENTS,
  MAX_DOCUMENT_TITLE_LENGTH,
  MAX_RICH_TEXT_IMAGE_SIZE,
  RICH_TEXT_IMAGE_CONTENT_TYPES,
} from 'strategydance-core'
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

import type { KnowledgeDocument, KnowledgeDocumentFields } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useNow from '~hooks/common/useNow'
import useRichTextEditor from '~hooks/common/useRichTextEditor'
import useKnowledgeDocumentAwareness from '~hooks/knowledge/useKnowledgeDocumentAwareness'
import useKnowledgeDocumentPresence from '~hooks/knowledge/useKnowledgeDocumentPresence'
import useKnowledgeDocumentSaver from '~hooks/knowledge/useKnowledgeDocumentSaver'
import useKnowledgeDocumentSync from '~hooks/knowledge/useKnowledgeDocumentSync'
import useLiveKnowledgeDocument from '~hooks/knowledge/useLiveKnowledgeDocument'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'
import useUser from '~hooks/user/useUser'

import createId from '~utils/common/createId'
import writeOptimistically from '~utils/common/writeOptimistically'
import getPresenceColor from '~utils/knowledge/getPresenceColor'
import readLinkPreview from '~utils/knowledge/readLinkPreview'
import uploadRichTextImage from '~utils/knowledge/uploadRichTextImage'

import Spinner from '~components/common/Spinner'
import AspectsDialog from '~components/company/AspectsDialog'
import CompanyAspectIcons from '~components/company/CompanyAspectIcons'
import KnowledgeBackLink from '~components/knowledge/KnowledgeBackLink'
import KnowledgeDocumentAiMenu from '~components/knowledge/KnowledgeDocumentAiMenu'
import KnowledgeDocumentLayout from '~components/knowledge/KnowledgeDocumentLayout'
import KnowledgeDocumentMoreMenu from '~components/knowledge/KnowledgeDocumentMoreMenu'
import KnowledgeDocumentPresences from '~components/knowledge/KnowledgeDocumentPresences'
import KnowledgeEditedAt from '~components/knowledge/KnowledgeEditedAt'
import KnowledgeLeaveDialog from '~components/knowledge/KnowledgeLeaveDialog'

import { dataConnect } from '~data/firebase'
import aspectMessages from '~data/intl/aspectMessages'
import knowledgeMessages from '~data/intl/messages/knowledge'

// The aspects dialog's words, for a document. At module scope so the reference is stable
const KNOWLEDGE_ASPECTS_DIALOG_MESSAGES = {
  title: knowledgeMessages.aspectsTitle,
  description: knowledgeMessages.aspectsDescription,
  selected: knowledgeMessages.aspectsSelected,
  cancel: knowledgeMessages.cancel,
  save: knowledgeMessages.save,
  close: knowledgeMessages.close,
}

type Props = {
  organizationId: string
  documentId: string
  // The stored document, or null for a draft
  knowledgeDocument: KnowledgeDocument | null
  // The aspect a draft starts tagged with, from the page it was added on
  draftAspect: CompanyAspect | null
}

/*
  One document of the organization's knowledge, written in place, by any number of its members at
  once: its title, the aspects it is about, whether agents may change it, and its text. Nothing has
  a Save button. The text is a Yjs document its sync pushes as it is typed and merges others'
  edits into as they arrive, so two people writing at once each see the other's words. The other
  fields go through the saver once the reader pauses, and another member's change to one shows here
  unless the reader has a change of their own to it waiting. Whatever is left goes when they leave
  the page, the tab or the page's fields.

  The page reads the document whole once, into state, and `GetLiveDocument` tells it of every
  change after. A draft is the same page at the id the document will have: the saver stores it,
  text and all, once it has a title or some text, and the address then loses its `isNew`, which
  keeps this page mounted, and only then does the page follow the live query.

  A document emptied of its title and text is deleted as the page goes, as the design has it, and
  one deleted from the menu can be taken back from the notification for a few seconds. One
  somebody else deleted says so, and nothing on it can be changed until an Undo brings it back
*/
function KnowledgeDocumentEditor({ organizationId, documentId, knowledgeDocument, draftAspect }: Props) {
  const { formatMessage, formatList, locale } = useIntl()
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const queryClient = useQueryClient()
  const now = useNow()
  const { data: viewer } = useAuthentication()
  const { data: user } = useUser()
  const { RichTextEditor, hasFailed: hasEditorFailed } = useRichTextEditor()
  const {
    sync,
    isReady: isTextReady,
    hasFailed: hasTextFailed,
  } = useKnowledgeDocumentSync({
    organizationId,
    documentId,
    knowledgeDocument,
  })
  const awareness = useKnowledgeDocumentAwareness(sync.doc)
  // This tab, as its presence row names it, and as a discard leaves its own row out
  const [sessionId] = useState(createId)

  const [initial] = useState(() => ({
    fields: {
      title: knowledgeDocument?.title ?? '',
      content: knowledgeDocument?.content ?? '',
      aspects: knowledgeDocument?.aspects ?? (draftAspect ? [draftAspect] : []),
      isAiReadable: knowledgeDocument?.isAiReadable ?? true,
      isAiWritable: knowledgeDocument?.isAiWritable ?? true,
    } satisfies KnowledgeDocumentFields,
    updatedAt: knowledgeDocument?.updatedAt ?? null,
  }))
  const [title, setTitle] = useState(initial.fields.title)
  const [aspects, setAspects] = useState(initial.fields.aspects)
  const [isAiReadable, setIsAiReadable] = useState(initial.fields.isAiReadable)
  const [isAiWritable, setIsAiWritable] = useState(initial.fields.isAiWritable)
  const [isStored, setIsStored] = useState(knowledgeDocument !== null)
  const [isPickingAspects, setIsPickingAspects] = useState(false)
  // Whether the live query found the document gone, and when it last says it changed
  const [isDeletedElsewhere, setIsDeletedElsewhere] = useState(false)
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<string | null>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<RichTextEditorHandle>(null)

  const { saver, status, syncStatus, savedAt, leave } = useKnowledgeDocumentSaver({
    organizationId,
    documentId,
    sessionId,
    fields: initial.fields,
    isStored,
    sync,
    onRemoteChange: fields => {
      if (fields.title !== undefined) setTitle(fields.title)
      if (fields.aspects !== undefined) setAspects(fields.aspects)
      if (fields.isAiReadable !== undefined) setIsAiReadable(fields.isAiReadable)
      if (fields.isAiWritable !== undefined) setIsAiWritable(fields.isAiWritable)
    },
    onCreated: () => {
      setIsStored(true)
      navigate({
        to: '/$organizationSlug/knowledge/$documentId',
        params: { organizationSlug, documentId },
        search: {},
        replace: true,
        resetScroll: false,
      })
    },
  })

  useLiveKnowledgeDocument({
    organizationId,
    documentId,
    isEnabled: isStored,
    onNext: live => {
      sync.receive(live && { revision: live.revision, updates: live.documentUpdates_on_document })
      setIsDeletedElsewhere(!live)

      if (!live) return

      saver.receive({
        title: live.title,
        aspects: live.aspects,
        isAiReadable: live.isAiReadable,
        isAiWritable: live.isAiWritable,
      })
      setLiveUpdatedAt(live.updatedAt)
    },
  })

  // The latest of when this page last saved and when the live query says the document changed
  const updatedAt =
    [savedAt, liveUpdatedAt, initial.updatedAt]
      .filter(value => value !== null)
      .sort((a, b) => Date.parse(a) - Date.parse(b))
      .at(-1) ?? null
  const isGone = isDeletedElsewhere || syncStatus === 'gone'
  const people = useKnowledgeDocumentPresence({
    organizationId,
    documentId,
    sessionId,
    awareness,
    isEnabled: isStored && isTextReady && !isGone,
    viewerId: viewer?.uid ?? null,
    flushText: sync.flushStored,
  })
  const isShared = people.length > 0

  // Typing goes out sooner while somebody else is there to see it
  useEffect(() => {
    sync.setShared(isShared)
  }, [sync, isShared])

  // A new document starts in its title, as one opened to read starts nowhere
  useEffect(() => {
    if (!initial.fields.title && !initial.fields.content) titleRef.current?.focus()
  }, [initial])

  const hasSaveFailed = status === 'error' || syncStatus === 'error'

  useEffect(() => {
    if (hasSaveFailed) toast.error(formatMessage(knowledgeMessages.saveError))
  }, [hasSaveFailed, formatMessage])

  function changeTitle(value: string) {
    // One line: a paste of several joins them
    const next = value.replace(/[\r\n]+/g, ' ')

    setTitle(next)
    saver.change({ title: next })
  }

  // Empty has one spelling, the one the server checks a discarded document for. The saver reads it
  // for a draft and for emptiness, and the sync for whether it is too long to send, which the page
  // says
  function changeContent({ value, isEmpty }: RichTextEditorChange) {
    const content = isEmpty ? '' : value

    saver.change({ content })
    sync.setContent(content)
  }

  /*
    Stores a picture put in the text, saying why it will not when the file is not one or too large,
    or when the upload fails. Throwing tells the editor, which takes away the picture's place
  */
  async function uploadImage(file: File) {
    if (!RICH_TEXT_IMAGE_CONTENT_TYPES.includes(file.type)) {
      toast.error(formatMessage(knowledgeMessages.editorImageTypeError))

      throw new Error(`Not a picture: ${file.type || file.name}`)
    }

    if (file.size > MAX_RICH_TEXT_IMAGE_SIZE) {
      toast.error(
        formatMessage(knowledgeMessages.editorImageSizeError, { megabytes: MAX_RICH_TEXT_IMAGE_SIZE / 1024 / 1024 }),
      )

      throw new Error(`A picture too large: ${file.size} bytes`)
    }

    try {
      return await uploadRichTextImage(organizationId, file)
    } catch (error) {
      toast.error(formatMessage(knowledgeMessages.editorImageUploadError))

      throw error
    }
  }

  function saveAspects(next: CompanyAspect[]) {
    setAspects(next)
    setIsPickingAspects(false)
    saver.change({ aspects: next })
  }

  function changeAiPermissions(fields: Partial<Pick<KnowledgeDocumentFields, 'isAiReadable' | 'isAiWritable'>>) {
    if (fields.isAiReadable !== undefined) setIsAiReadable(fields.isAiReadable)
    if (fields.isAiWritable !== undefined) setIsAiWritable(fields.isAiWritable)

    saver.change(fields)
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
    const [isSaverSettled, isSyncSettled] = await Promise.all([saver.settle(), sync.settle()])

    if (!isSaverSettled || !isSyncSettled) {
      saver.resume()
      sync.resume()

      return
    }

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
      sync.resume()
      toast.error(formatMessage(knowledgeMessages.deleteError))

      return
    }

    navigate({ to: '/$organizationSlug/knowledge', params: { organizationSlug } })
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
    if (isGone) return formatMessage(knowledgeMessages.notSaved)
    if (status === 'pending' || status === 'saving' || syncStatus === 'pending' || syncStatus === 'saving') {
      return formatMessage(knowledgeMessages.saving)
    }
    if (status === 'error' || status === 'tooLong' || status === 'full' || hasSaveFailed || syncStatus === 'tooLong') {
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
        <KnowledgeDocumentPresences people={people} />
        {isStored && !isGone ? <KnowledgeDocumentMoreMenu onDelete={handleDelete} /> : null}
      </div>
      {isGone ? (
        <Alert
          variant="warning"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/$organizationSlug/knowledge', params: { organizationSlug } })}
            >
              {formatMessage(knowledgeMessages.goToAll)}
            </Button>
          }
        >
          {formatMessage(knowledgeMessages.deletedElsewhere)}
        </Alert>
      ) : null}
      {/* Laid out as if it were not there, so its fields keep the page's gaps */}
      <div
        inert={isGone}
        className="contents"
      >
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
          // Its full size on a touch screen too, where a field's text is otherwise 16px
          className="h-auto overflow-hidden rounded-none border-0 bg-transparent p-0 font-heading text-5xl pointer-coarse:text-5xl leading-[1.1] font-normal tracking-tight text-secondary placeholder:text-neutral-400 focus:bg-transparent"
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
              <CompanyAspectIcons
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
          <KnowledgeDocumentAiMenu
            isAiReadable={isAiReadable}
            isAiWritable={isAiWritable}
            onChange={changeAiPermissions}
          />
        </div>
        {status === 'full' ? (
          <p
            role="alert"
            className="m-0 text-sm text-danger"
          >
            {formatMessage(knowledgeMessages.draftFull, { max: MAX_DOCUMENTS })}
          </p>
        ) : null}
        {status === 'tooLong' || syncStatus === 'tooLong' ? (
          <p
            role="alert"
            className="m-0 text-sm text-danger"
          >
            {formatMessage(knowledgeMessages.tooLong)}
          </p>
        ) : null}
        {RichTextEditor && isTextReady && awareness ? (
          <RichTextEditor
            ref={editorRef}
            appearance="document"
            collaboration={{
              doc: sync.doc,
              awareness,
              user: {
                name: user?.displayName || viewer?.displayName || user?.email || viewer?.email || '',
                color: getPresenceColor(viewer?.uid ?? ''),
              },
            }}
            placeholder={formatMessage(knowledgeMessages.bodyPlaceholder)}
            aria-label={formatMessage(knowledgeMessages.bodyLabel)}
            locale={locale}
            labels={{
              turnInto: formatMessage(knowledgeMessages.editorTurnInto),
              videoEmbedSubtext: formatMessage(knowledgeMessages.editorVideoSubtext),
              videoEmbedUnsupported: formatMessage(knowledgeMessages.editorVideoUnsupported),
              linkPreviewTitle: formatMessage(knowledgeMessages.editorLinkPreviewTitle),
              linkPreviewSubtext: formatMessage(knowledgeMessages.editorLinkPreviewSubtext),
              linkPreviewAdd: formatMessage(knowledgeMessages.editorLinkPreviewAdd),
              linkPreviewButton: formatMessage(knowledgeMessages.editorLinkPreviewButton),
              linkPreviewInvalid: formatMessage(knowledgeMessages.editorLinkPreviewInvalid),
            }}
            uploadImage={uploadImage}
            previewLink={readLinkPreview}
            onChange={changeContent}
            className="border-t border-neutral-200"
          />
        ) : (
          // Holds the editor's height and its gutter while it loads, so the page does not jump when it arrives
          <div className="min-h-[360px] border-t border-neutral-200 pt-4 text-sm text-muted-foreground max-md:pl-[52px]">
            {hasEditorFailed || hasTextFailed ? (
              formatMessage(knowledgeMessages.editorError)
            ) : (
              <div className="flex items-center gap-2">
                <Spinner
                  size="sm"
                  tone="muted"
                />
                {formatMessage(knowledgeMessages.loadingEditor)}
              </div>
            )}
          </div>
        )}
      </div>
      {leave.status === 'blocked' ? (
        <KnowledgeLeaveDialog
          onStay={leave.reset}
          onLeave={leave.proceed}
        />
      ) : null}
      {isPickingAspects ? (
        <AspectsDialog
          aspects={aspects}
          messages={KNOWLEDGE_ASPECTS_DIALOG_MESSAGES}
          onSave={saveAspects}
          onClose={() => setIsPickingAspects(false)}
        />
      ) : null}
    </KnowledgeDocumentLayout>
  )
}

export default KnowledgeDocumentEditor
