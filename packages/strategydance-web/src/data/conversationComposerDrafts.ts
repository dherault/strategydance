import type { ConversationMessageAttachment } from '~types'

import createTabStore from '~utils/common/createTabStore'
import type { ConversationAttachmentUploadRefusal } from '~utils/conversation/getConversationAttachmentUploadFailure'
import type { ConversationSendFailure } from '~utils/conversation/getConversationSendFailure'
import type { StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'

/*
  A file the reader added to the message, from the moment it is picked: in the tray, going up,
  then stored and ready to send with the message
*/
export type ConversationComposerAttachment = {
  // Made by the browser, and its id on the backend
  id: string
  // As it goes up, a name the backend takes
  name: string
  // One of `CONVERSATION_ATTACHMENT_CONTENT_TYPES`
  contentType: string
  // Its bytes, an image's once shrunk, kept to draw it in the tray and to upload it again
  file: Blob
  // Waiting its turn or going up, stored, or stopped by a failure that trying again may get past
  status: 'uploading' | 'ready' | 'failed'
  // How much of it has gone up, in whole percents
  progress: number
}

// Why a file the reader added was not attached, named in the composer until they add or remove one
export type ConversationAttachmentRefusal = {
  // Refused by the backend, or before it went up: an image past what Claude takes, an empty file, or
  // one more than a message holds
  kind: ConversationAttachmentUploadRefusal | 'imageTooLarge' | 'empty' | 'perMessage'
  name: string
}

/*
  A message the reader sent, drawn in the thread from the moment they send it, before the backend
  has stored it and the live read brought it in, and in place of its body until the thread has read
  it. Its id is the message's, which the backend keeps, so the message stored takes its place
*/
export type ConversationPendingMessage = {
  id: string
  // As it was sent, its mentions links to their documents
  text: string
  // The files it sent, as the message stored reads them
  attachments: readonly ConversationMessageAttachment[]
}

/*
  The message the reader is writing to a conversation, and where its sending stands: what a
  composer holds that outlives the composer
*/
export type ConversationComposerDraft = {
  text: string
  // The documents its mentions name, by their titles
  mentions: ReadonlyMap<string, string>
  // The files it sends, in the order they were added
  attachments: readonly ConversationComposerAttachment[]
  // The last file the reader added that was not attached, and why
  attachmentRefusal: ConversationAttachmentRefusal | null
  // The id of the message a send is taking, while it goes, which no other send may race
  sendingMessageId: string | null
  // The message last sent, from its send until the thread holds it and its send has gone through, or
  // its send fails
  pendingMessage: ConversationPendingMessage | null
  // The send that failed, kept so that sending the same message again is the same send: its id,
  // the message as it was sent, its mentions links to their documents, and the files it sent
  failedSend: { messageId: string; text: string; attachmentIds: readonly string[] } | null
  // Why the last send failed, until the reader writes again
  failure: ConversationSendFailure | null
  // The run the reader last started, by a send, a resume, a retry or an answer, which counts as
  // going before the live read of the latest run shows it, wherever the conversation is drawn
  startedRun: StartedConversationRun | null
}

export const EMPTY_CONVERSATION_COMPOSER_DRAFT: ConversationComposerDraft = {
  text: '',
  mentions: new Map(),
  attachments: [],
  attachmentRefusal: null,
  sendingMessageId: null,
  pendingMessage: null,
  failedSend: null,
  failure: null,
  startedRun: null,
}

/*
  Each conversation's message being written, kept for the life of the tab and shared by every
  composer that draws the conversation: its page and its dock's window, a window minimized and
  opened again, or one the "+N" menu held, all show the same words and the same send. A send that
  lands after its composer has gone, the conversation drawn elsewhere meanwhile, settles there, and
  a send going in one is going in all. Never stored: a reload starts afresh, as the page always has.

  Kept by `${userId}:${organizationId}:${conversationId}`, which `useConversationComposerDraft`
  makes, since the tab outlives a sign-out and a draft not stored yet belongs to no organization:
  one account never finds another's message, nor one organization another's
*/
const drafts = createTabStore(
  EMPTY_CONVERSATION_COMPOSER_DRAFT,
  draft =>
    !draft.text
    && !draft.mentions.size
    && !draft.attachments.length
    && !draft.attachmentRefusal
    && !draft.sendingMessageId
    && !draft.pendingMessage
    && !draft.failedSend
    && !draft.failure
    && !draft.startedRun,
)

// The key a draft is kept under: the account's, the organization's and the conversation's, as
// `useConversationComposerDraft` reads it
export function getConversationComposerDraftKey(
  userId: string | null | undefined,
  organizationId: string | null | undefined,
  conversationId: string,
) {
  return `${userId ?? ''}:${organizationId ?? ''}:${conversationId}`
}

export const readConversationComposerDraft = drafts.read

// Changes what a conversation's composers hold, and forgets it once there is nothing left
export const updateConversationComposerDraft = drafts.update

export const subscribeToConversationComposerDrafts = drafts.subscribe
