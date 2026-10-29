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
  The type a file goes up as, one of those its destination takes, as a conversation's files or a
  bill's receipt, or null for a file it does not take. The browser's own type when it is one of
  them, and otherwise its extension's: a browser gives a Markdown file no type, and Windows calls a
  CSV file a spreadsheet. The backend reads the type off the file's first bytes anyway
*/
function readFileType({ name, type }: { name: string; type: string }, types: readonly string[]) {
  const browserType = type.split(';')[0]?.trim().toLowerCase() ?? ''

  if (types.includes(browserType)) return browserType

  const extension = /\.([^.]+)$/.exec(name.trim())?.[1]?.toLowerCase()
  const extensionType = extension ? EXTENSION_TYPES[extension] : undefined

  return extensionType && types.includes(extensionType) ? extensionType : null
}

export default readFileType
