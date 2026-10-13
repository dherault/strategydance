import { useIntl } from 'react-intl'
import { CONVERSATION_ATTACHMENT_CONTENT_TYPES, MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE } from 'strategydance-core'

import useConversationComposerDraft from '~hooks/conversation/useConversationComposerDraft'
import useRemoveConversationAttachment from '~hooks/conversation/useRemoveConversationAttachment'
import useUploadConversationAttachment from '~hooks/conversation/useUploadConversationAttachment'

import createId from '~utils/common/createId'
import runImageDrawing from '~utils/common/runImageDrawing'
import getConversationAttachmentRefusal from '~utils/conversation/getConversationAttachmentRefusal'
import getConversationAttachmentUploadFailure from '~utils/conversation/getConversationAttachmentUploadFailure'
import readConversationAttachmentType from '~utils/conversation/readConversationAttachmentType'
import shrinkConversationImage from '~utils/conversation/shrinkConversationImage'
import toConversationAttachmentName from '~utils/conversation/toConversationAttachmentName'

import { abortConversationAttachmentUpload, runConversationAttachmentUpload } from '~data/conversationAttachmentUploads'
import type { ConversationAttachmentRefusal, ConversationComposerAttachment } from '~data/conversationComposerDrafts'
import conversationMessages from '~data/intl/messages/conversation'

/*
  The files of the message the reader is writing to a conversation, as every composer drawing it
  shares them, and what adds, removes and uploads them again.

  A file added goes into the tray at once and up as soon as its turn comes, an image shrunk first,
  one drawing at a time and a few uploads at a time across the tab, writing how far it has gone
  into the draft: the upload is the tab's, not the composer's, so it goes on wherever the
  conversation is drawn meanwhile, and lands in the draft it was added to. A file the conversation
  does not take, or one too large, never goes into the tray, and one the backend refuses for good
  leaves it: either is named above the field. One that failed otherwise, its connection lost say,
  stays, to be uploaded again or removed.

  Removing a file stops its upload and tells the backend, so its place among the reader's unsent
  files frees at once. Uploading one again does it under a new id once the old one is removed, so a
  reservation the failed try left behind never holds a place, nor takes the new one's at the cap;
  should the removal fail, the file stays failed under its old id, to be tried again
*/
function useConversationComposerAttachments(conversationId: string) {
  const { formatMessage } = useIntl()
  const [draft, changeDraft, readDraft] = useConversationComposerDraft(conversationId)
  const uploadConversationAttachment = useUploadConversationAttachment()
  const removeConversationAttachment = useRemoveConversationAttachment()

  // Changes one of the draft's files, should it still be there
  function changeAttachment(id: string, change: Partial<ConversationComposerAttachment>) {
    changeDraft(current =>
      current.attachments.some(attachment => attachment.id === id)
        ? {
            attachments: current.attachments.map(attachment =>
              attachment.id === id ? { ...attachment, ...change } : attachment,
            ),
          }
        : {},
    )
  }

  // Tells the backend the files are not to be sent, which a failure there only delays until they expire
  function discard(ids: readonly string[]) {
    for (const attachmentId of ids) {
      removeConversationAttachment({ conversationId, attachmentId }).catch((error: unknown) => {
        console.error('A file could not be removed, and is kept until it expires', error)
      })
    }
  }

  function upload({ id, name, contentType, file }: ConversationComposerAttachment) {
    runConversationAttachmentUpload(id, async signal => {
      try {
        // One drawing at a time across the tab, while three files go up: a file removed while it
        // waits its turn is never drawn
        const shrunk = await runImageDrawing(async () => {
          signal.throwIfAborted()

          return shrinkConversationImage(file, contentType)
        })

        signal.throwIfAborted()

        // The type it was drawn in, when shrinking changed it, as a browser that writes no WebP does
        const shrunkType =
          shrunk !== file && CONVERSATION_ATTACHMENT_CONTENT_TYPES.includes(shrunk.type) ? shrunk.type : contentType
        let progress = 0

        if (shrunk !== file) changeAttachment(id, { file: shrunk, contentType: shrunkType })

        await uploadConversationAttachment({
          conversationId,
          attachmentId: id,
          name,
          contentType: shrunkType,
          file: shrunk,
          signal,
          onProgress: share => {
            const next = Math.floor(share * 100)

            if (next === progress) return

            progress = next
            changeAttachment(id, { progress })
          },
        })

        changeAttachment(id, { status: 'ready', progress: 100 })
      } catch (error) {
        if (signal.aborted) return

        const failure = getConversationAttachmentUploadFailure(error)

        if (failure === 'error') {
          console.error('A file could not be uploaded', error)
          changeAttachment(id, { status: 'failed' })

          return
        }

        changeDraft(current => ({
          attachments: current.attachments.filter(attachment => attachment.id !== id),
          // An image past what Claude takes says what that is, rather than what any other file may hold
          attachmentRefusal: {
            kind: failure === 'tooLarge' && contentType.startsWith('image/') ? 'imageTooLarge' : failure,
            name,
          },
        }))
      }
    })
  }

  // Adds files the reader picked or pasted, as many as a message holds, and uploads them
  function add(files: readonly File[]) {
    const added: ConversationComposerAttachment[] = []

    changeDraft(current => {
      let refusal: ConversationAttachmentRefusal | null = null

      for (const file of files) {
        const contentType = readConversationAttachmentType(file)
        const name = toConversationAttachmentName(
          file.name,
          formatMessage(
            contentType?.startsWith('image/')
              ? conversationMessages.composerPastedImage
              : conversationMessages.composerPastedFile,
          ),
        )

        const kind = getConversationAttachmentRefusal(file, contentType)

        if (kind || !contentType) refusal = { kind: kind ?? 'unsupported', name }
        else if (current.attachments.length + added.length >= MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE) {
          refusal = { kind: 'perMessage', name }
        } else added.push({ id: createId(), name, contentType, file, status: 'uploading', progress: 0 })
      }

      return { attachments: [...current.attachments, ...added], attachmentRefusal: refusal }
    })

    for (const attachment of added) upload(attachment)
  }

  // Takes a file out of the message, stopping its upload
  function remove(id: string) {
    abortConversationAttachmentUpload(id)
    changeDraft(current => ({
      attachments: current.attachments.filter(attachment => attachment.id !== id),
      attachmentRefusal: null,
    }))
    discard([id])
  }

  // Uploads some files again, each under a new id, in their places in the tray, once the backend
  // has let go of the old one
  function retry(ids: readonly string[]) {
    const again = new Map<string, ConversationComposerAttachment>()

    changeDraft(current => ({
      attachments: current.attachments.map(attachment => {
        if (!ids.includes(attachment.id)) return attachment

        const next: ConversationComposerAttachment = { ...attachment, id: createId(), status: 'uploading', progress: 0 }

        again.set(attachment.id, next)

        return next
      }),
    }))

    for (const [id, attachment] of again) {
      abortConversationAttachmentUpload(id)
      removeConversationAttachment({ conversationId, attachmentId: id }).then(
        () => {
          // Unless the reader took it out meanwhile
          if (readDraft().attachments.some(({ id: attachedId }) => attachedId === attachment.id)) upload(attachment)
        },
        (error: unknown) => {
          console.error('A file could not be removed before it went up again', error)
          // Under its old id again, so trying again or removing it reaches the reservation still held
          changeAttachment(attachment.id, { id, status: 'failed' })
        },
      )
    }
  }

  return {
    attachments: draft.attachments,
    refusal: draft.attachmentRefusal,
    add,
    remove,
    retry,
  }
}

export default useConversationComposerAttachments
