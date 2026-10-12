import type { ConversationContentBlock } from '~types'

type ConversationAttachmentFile = {
  name: string
  contentType: string
}

/*
  Where a file's content comes from in its block: its id in the Files API, as the transcript keeps
  it, or its bytes, as the upload counts it once, since the count endpoint takes no Files API source
*/
type ConversationAttachmentSource = { fileId: string } | { bytes: Uint8Array }

/*
  The block Claude reads a file in: an image as an `image` block, a PDF and a text file as a
  `document` block titled with the file's name, every text file as plain text, which is how Claude
  reads Markdown and CSV. The transcript's blocks reference the file's id; the block the upload counts
  carries the same file inline, so what was counted is what is sent. Its keys always come in one
  order, since the transcript is replayed byte for byte
*/
function buildConversationAttachmentBlock(
  { name, contentType }: ConversationAttachmentFile,
  source: ConversationAttachmentSource,
): ConversationContentBlock {
  if (contentType.startsWith('image/')) {
    return {
      type: 'image',
      source:
        'fileId' in source
          ? { type: 'file', file_id: source.fileId }
          : { type: 'base64', media_type: contentType, data: Buffer.from(source.bytes).toString('base64') },
    }
  }

  if (contentType === 'application/pdf') {
    return {
      type: 'document',
      source:
        'fileId' in source
          ? { type: 'file', file_id: source.fileId }
          : { type: 'base64', media_type: 'application/pdf', data: Buffer.from(source.bytes).toString('base64') },
      title: name,
    }
  }

  return {
    type: 'document',
    source:
      'fileId' in source
        ? { type: 'file', file_id: source.fileId }
        : { type: 'text', media_type: 'text/plain', data: new TextDecoder().decode(source.bytes) },
    title: name,
  }
}

export default buildConversationAttachmentBlock
