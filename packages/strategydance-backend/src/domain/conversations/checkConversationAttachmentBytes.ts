import {
  MAX_CONVERSATION_IMAGE_DIMENSION,
  MAX_CONVERSATION_IMAGE_SIZE,
  MAX_CONVERSATION_PDF_PAGES,
  MAX_CONVERSATION_TEXT_ATTACHMENT_LENGTH,
} from 'strategydance-core'

import countPdfPages from '~utils/countPdfPages'
import readImageDimensions from '~utils/readImageDimensions'

type ConversationAttachmentBytesCheck =
  | { outcome: 'checked'; pageCount: number | null }
  | { outcome: 'unsupported'; reason: string }
  | { outcome: 'tooLarge'; reason: string }

/*
  Whether Claude takes a file, checked here rather than in the browser, since a stored file Claude
  refuses would fail every later request of its conversation: an image within 5 megabytes and 8000
  pixels a side, read from its header; a PDF its parser reads, unencrypted, of at most 100 pages,
  which it answers to be kept; and text that is UTF-8, holds no NUL, and at most 200000 characters
*/
async function checkConversationAttachmentBytes(
  bytes: Uint8Array,
  contentType: string,
): Promise<ConversationAttachmentBytesCheck> {
  if (contentType.startsWith('image/')) {
    if (bytes.length > MAX_CONVERSATION_IMAGE_SIZE) {
      return { outcome: 'tooLarge', reason: `An image holds at most ${MAX_CONVERSATION_IMAGE_SIZE} bytes` }
    }

    const dimensions = readImageDimensions(bytes)

    if (!dimensions) return { outcome: 'unsupported', reason: 'The image has no size its header gives' }

    if (dimensions.width > MAX_CONVERSATION_IMAGE_DIMENSION || dimensions.height > MAX_CONVERSATION_IMAGE_DIMENSION) {
      return {
        outcome: 'tooLarge',
        reason: `An image is at most ${MAX_CONVERSATION_IMAGE_DIMENSION} pixels a side`,
      }
    }

    return { outcome: 'checked', pageCount: null }
  }

  if (contentType === 'application/pdf') {
    const pages = await countPdfPages(bytes)

    if (pages.outcome === 'encrypted') return { outcome: 'unsupported', reason: 'The PDF is protected by a password' }
    if (pages.outcome === 'unreadable') return { outcome: 'unsupported', reason: 'The PDF cannot be read' }

    if (pages.pageCount > MAX_CONVERSATION_PDF_PAGES) {
      return { outcome: 'tooLarge', reason: `A PDF has at most ${MAX_CONVERSATION_PDF_PAGES} pages` }
    }

    return { outcome: 'checked', pageCount: pages.pageCount }
  }

  let text: string

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { outcome: 'unsupported', reason: 'The text is not UTF-8' }
  }

  if (text.includes('\u0000')) return { outcome: 'unsupported', reason: 'The file is not text' }

  if (text.length > MAX_CONVERSATION_TEXT_ATTACHMENT_LENGTH) {
    return {
      outcome: 'tooLarge',
      reason: `A text file holds at most ${MAX_CONVERSATION_TEXT_ATTACHMENT_LENGTH} characters`,
    }
  }

  return { outcome: 'checked', pageCount: null }
}

export default checkConversationAttachmentBytes
