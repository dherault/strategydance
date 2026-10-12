import type { Readable } from 'node:stream'

import Anthropic from '@anthropic-ai/sdk'
import type { ConversationAttachmentData } from 'strategydance-core'
import {
  ConversationAttachmentStatus,
  completeConversationAttachmentUpload,
  getConversationAttachmentUploadContext,
  releaseConversationAttachment,
  reserveConversationAttachment,
} from 'strategydance-database/backend'

import { CLAUDE_FILE_NAME_PREFIX } from '~constants'

import { dataConnect } from '~firebase'

import buildPendingAttachmentObjectName from '~utils/buildPendingAttachmentObjectName'
import createConcurrencyLimit from '~utils/createConcurrencyLimit'
import logger from '~utils/logger'

import buildConversationAttachmentBlock from '~domain/agent/buildConversationAttachmentBlock'
import conversationClaudeClient from '~domain/agent/conversationClaudeClient'
import conversationClaudeFiles from '~domain/agent/conversationClaudeFiles'
import { CONVERSATION_MODEL } from '~domain/agent/conversationRequestSettings'
import checkConversationAttachmentBytes from '~domain/conversations/checkConversationAttachmentBytes'
import conversationAttachmentStorage from '~domain/conversations/conversationAttachmentStorage'
import createAttachmentUploadCheck, { AttachmentUploadRefusal } from '~domain/conversations/createAttachmentUploadCheck'
import deletePrunedConversationAttachments from '~domain/conversations/deletePrunedConversationAttachments'
import pruneMemberConversationAttachments from '~domain/conversations/pruneMemberConversationAttachments'
import isOperationRefusal from '~domain/modules/isOperationRefusal'

// The files each instance reads back from Storage at once, to check, count and send to the Files
// API, so its memory stays bounded however many uploads arrive together
const readBackLimit = createConcurrencyLimit(2)

type UploadConversationAttachmentInput = {
  // Canonical, as `toCanonicalUuid` writes them, and the caller's uid as the backend verified it
  organizationId: string
  userId: string
  conversationId: string
  attachmentId: string
  // As the route checked them: the file's name, its type, and the size its `Content-Length` declared
  name: string
  contentType: string
  size: number
  body: Readable
}

type UploadConversationAttachmentResult =
  | { outcome: 'stored'; attachment: ConversationAttachmentData }
  // The caller is no member of the organization
  | { outcome: 'forbidden' }
  // The conversation is somebody else's, or deleted
  | { outcome: 'missing' }
  // The id is another file's, or this one's with another name, type or size, or a prune took it
  | { outcome: 'conflict' }
  // The caller has as many files waiting to be sent as they may
  | { outcome: 'tooMany' }
  | { outcome: 'unsupported'; reason: string }
  | { outcome: 'tooLarge'; reason: string }

type UploadContextAttachment = {
  userId: string
  organizationId: string
  conversationId: string
  messageId?: string | null
  status: ConversationAttachmentStatus
  name: string
  contentType: string
  size: number
  pageCount?: number | null
}

/*
  Uploads a file to a conversation, a draft's as often as a saved one's, under the id the browser
  made for it, so the same upload sent again stores it once:

  - its place among the caller's unsent files is reserved before any byte is read, after their
    expired files are pruned, so a member at the 30 is refused at once
  - its bytes stream into Storage under `pending/`, create-only, through a check of their signature
    and their size, so Storage holds no file that is not what it claims
  - it is read back, two at once in the instance, checked against what Claude takes, its tokens
    counted from its bytes, since the count endpoint takes no Files API source, and uploaded to the
    Files API
  - its row turns `READY` with its pages, tokens and Files API id

  An upload sent again finds its row: `READY`, it answers as the first did; `UPLOADING`, it carries
  on where the first stopped, a stored object of its size kept. One that differs in name, type or size
  is refused, since the row's never change. A file refused after its reservation gives its place back
  at once
*/
async function uploadConversationAttachment(
  input: UploadConversationAttachmentInput,
): Promise<UploadConversationAttachmentResult> {
  const { organizationId, userId, conversationId, attachmentId } = input
  const reference = { organizationId, userId, conversationId, attachmentId }
  const { data } = await getConversationAttachmentUploadContext(dataConnect, reference)
  const { conversation } = data

  if (!data.userOrganization) return { outcome: 'forbidden' }

  if (
    conversation
    && (conversation.userId !== userId || conversation.organizationId !== organizationId || conversation.deletedAt)
  ) {
    return { outcome: 'missing' }
  }

  let attachment: UploadContextAttachment | null | undefined = data.conversationAttachment

  if (!attachment) {
    await pruneMemberConversationAttachments({ organizationId, userId })

    try {
      await reserveConversationAttachment(dataConnect, {
        ...reference,
        name: input.name,
        contentType: input.contentType,
        size: input.size,
      })
    } catch (error) {
      if (isOperationRefusal(error, 'Somebody has at most 30 files')) return { outcome: 'tooMany' }
      if (isOperationRefusal(error, "The conversation is somebody else's")) return { outcome: 'missing' }
      if (isOperationRefusal(error, 'Only a member of an organization')) return { outcome: 'forbidden' }

      // The same upload got there first: carry on as its retry
      const { data: again } = await getConversationAttachmentUploadContext(dataConnect, reference)

      if (!again.conversationAttachment) throw error

      attachment = again.conversationAttachment
    }
  }

  if (attachment) {
    const existing = readExisting(attachment, input)

    if (existing) {
      input.body.resume()

      return existing
    }
  }

  const stored = await storeObject(input)

  if (stored) {
    await release(input)

    return stored
  }

  return readBackLimit(() => finish(input))
}

// What an upload sent again answers from the row it found, or null to carry on uploading it
function readExisting(
  attachment: UploadContextAttachment,
  input: UploadConversationAttachmentInput,
): UploadConversationAttachmentResult | null {
  if (
    attachment.userId !== input.userId
    || attachment.organizationId !== input.organizationId
    || attachment.conversationId !== input.conversationId
    || attachment.name !== input.name
    || attachment.contentType !== input.contentType
    || attachment.size !== input.size
  ) {
    return { outcome: 'conflict' }
  }

  if (attachment.status === ConversationAttachmentStatus.READY) {
    return { outcome: 'stored', attachment: toAttachmentData(input.attachmentId, attachment) }
  }

  if (attachment.status === ConversationAttachmentStatus.PRUNING) return { outcome: 'conflict' }

  return null
}

// Streams the bytes into the pending object, create-only: answers null once they are there, or why
// they were refused
async function storeObject(
  input: UploadConversationAttachmentInput,
): Promise<UploadConversationAttachmentResult | null> {
  const name = buildPendingAttachmentObjectName(input)

  try {
    const written = await conversationAttachmentStorage.write(name, input.contentType, () =>
      input.body.pipe(createAttachmentUploadCheck({ contentType: input.contentType, size: input.size })),
    )

    if (written.outcome === 'exists') {
      input.body.resume()

      if (written.size !== input.size) return { outcome: 'conflict' }
    }

    return null
  } catch (error) {
    if (!(error instanceof AttachmentUploadRefusal)) throw error

    if (error.reason === 'unsupported') return { outcome: 'unsupported', reason: error.message }

    return { outcome: error.reason === 'tooLarge' ? 'tooLarge' : 'conflict', reason: error.message }
  }
}

/*
  Reads the stored file back, checks it, counts its tokens, uploads it to the Files API and turns
  its row `READY`. A refusal gives its place back; a row a retry finished first answers as that one
  did, this upload's own file in the Files API deleted
*/
async function finish(input: UploadConversationAttachmentInput): Promise<UploadConversationAttachmentResult> {
  const { organizationId, userId, conversationId, attachmentId } = input
  const bytes = await conversationAttachmentStorage.read(buildPendingAttachmentObjectName(input))
  const check = await checkConversationAttachmentBytes(bytes, input.contentType)

  if (check.outcome !== 'checked') {
    await release(input)

    return check
  }

  let tokenCount: number

  try {
    tokenCount = await conversationClaudeClient.countTokens({
      model: CONVERSATION_MODEL,
      messages: [{ role: 'user', content: [buildConversationAttachmentBlock(input, { bytes }) as never] }],
    })
  } catch (error) {
    if (!(error instanceof Anthropic.BadRequestError)) throw error

    await release(input)

    return { outcome: 'unsupported', reason: 'Claude cannot read the file' }
  }

  const claudeFileId = await conversationClaudeFiles.upload({
    name: `${CLAUDE_FILE_NAME_PREFIX}${attachmentId}`,
    contentType: input.contentType.startsWith('text/') ? 'text/plain' : input.contentType,
    bytes,
  })

  try {
    await completeConversationAttachmentUpload(dataConnect, {
      organizationId,
      userId,
      conversationId,
      attachmentId,
      pageCount: check.pageCount,
      tokenCount,
      claudeFileId,
    })
  } catch (error) {
    await deleteOwnClaudeFile(claudeFileId)

    const { data } = await getConversationAttachmentUploadContext(dataConnect, {
      organizationId,
      userId,
      conversationId,
      attachmentId,
    })
    const attachment = data.conversationAttachment

    if (attachment?.status === ConversationAttachmentStatus.READY)
      return readExisting(attachment, input) ?? { outcome: 'conflict' }
    if (!attachment || attachment.status === ConversationAttachmentStatus.PRUNING) return { outcome: 'conflict' }

    throw error
  }

  return {
    outcome: 'stored',
    attachment: {
      id: attachmentId,
      name: input.name,
      contentType: input.contentType,
      size: input.size,
      pageCount: check.pageCount,
    },
  }
}

// Gives a refused file's place back at once, only while its row still uploads, so a retry that
// finished it first keeps it
async function release(input: UploadConversationAttachmentInput) {
  const { organizationId, userId, conversationId, attachmentId } = input
  const { data } = await releaseConversationAttachment(dataConnect, {
    organizationId,
    userId,
    conversationId,
    attachmentId,
  })

  if (data.conversationAttachment_updateMany) {
    await deletePrunedConversationAttachments([
      { id: attachmentId, organizationId, userId, conversationId, claudeFileId: null },
    ])
  }
}

// A file in the Files API no row will name, deleted at once, or by the daily sweep when that fails
async function deleteOwnClaudeFile(claudeFileId: string) {
  try {
    await conversationClaudeFiles.delete(claudeFileId)
  } catch (error) {
    logger.error(`Conversation attachment: file ${claudeFileId} is left to the sweep`, error)
  }
}

function toAttachmentData(id: string, attachment: UploadContextAttachment): ConversationAttachmentData {
  return {
    id,
    name: attachment.name,
    contentType: attachment.contentType,
    size: attachment.size,
    pageCount: attachment.pageCount ?? null,
  }
}

export default uploadConversationAttachment
