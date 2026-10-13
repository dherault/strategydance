import { CONVERSATION_ATTACHMENT_CONTENT_TYPES } from 'strategydance-core'

// The types a file's extension says, for a browser that gives none, or one of its own
const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  text: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
}

/*
  The type a file goes to a conversation as, one of `CONVERSATION_ATTACHMENT_CONTENT_TYPES`, or
  null for a file a conversation does not take. The browser's own type when it is one of them, and
  otherwise its extension's: a browser gives a Markdown file no type, and Windows calls a CSV file a
  spreadsheet. The backend reads the type off the file's first bytes anyway
*/
function readConversationAttachmentType({ name, type }: { name: string; type: string }) {
  const browserType = type.split(';')[0]?.trim().toLowerCase() ?? ''

  if (CONVERSATION_ATTACHMENT_CONTENT_TYPES.includes(browserType)) return browserType

  const extension = /\.([^.]+)$/.exec(name.trim())?.[1]?.toLowerCase()

  return (extension && EXTENSION_TYPES[extension]) || null
}

export default readConversationAttachmentType
