import {
  CONVERSATION_ATTACHMENT_CONTENT_TYPES,
  MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH,
  MAX_CONVERSATION_ATTACHMENT_SIZE,
} from 'strategydance-core'

// What a file's upload says of it in its headers
type ConversationAttachmentHeaders = {
  contentType?: string
  contentLength?: string
  fileName?: string
}

type ParsedConversationAttachmentHeaders =
  | { outcome: 'valid'; name: string; contentType: string; size: number }
  | { outcome: 'invalid'; reason: string }
  | { outcome: 'unsupported'; reason: string }
  | { outcome: 'tooLarge'; reason: string }

/*
  What an upload of a file to a conversation declares, checked before anything is reserved: its type,
  one a conversation takes, parameters aside; its size, given in `Content-Length`, which browsers
  always send and which the stored bytes have to match, at most 10 MiB; and its name, URL-encoded in
  `X-File-Name` so any character travels in a header, on one line of at most 200 characters, with no
  control character, trimmed
*/
function parseConversationAttachmentHeaders({
  contentType,
  contentLength,
  fileName,
}: ConversationAttachmentHeaders): ParsedConversationAttachmentHeaders {
  const type = contentType?.split(';')[0]?.trim().toLowerCase() ?? ''

  if (!CONVERSATION_ATTACHMENT_CONTENT_TYPES.includes(type)) {
    return { outcome: 'unsupported', reason: 'A conversation takes images, PDFs and text files' }
  }

  if (!contentLength || !/^\d+$/.test(contentLength)) {
    return { outcome: 'invalid', reason: 'A file is uploaded with its Content-Length' }
  }

  const size = Number(contentLength)

  if (size < 1) return { outcome: 'invalid', reason: 'A file holds something' }
  if (size > MAX_CONVERSATION_ATTACHMENT_SIZE) {
    return { outcome: 'tooLarge', reason: `A file holds at most ${MAX_CONVERSATION_ATTACHMENT_SIZE} bytes` }
  }

  let name: string

  try {
    name = decodeURIComponent(fileName ?? '').trim()
  } catch {
    return { outcome: 'invalid', reason: 'A file name is URL-encoded in X-File-Name' }
  }

  if (!name || [...name].length > MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH || /\p{Cc}/u.test(name)) {
    return {
      outcome: 'invalid',
      reason: `A file name is one line of at most ${MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH} characters`,
    }
  }

  return { outcome: 'valid', name, contentType: type, size }
}

export default parseConversationAttachmentHeaders
