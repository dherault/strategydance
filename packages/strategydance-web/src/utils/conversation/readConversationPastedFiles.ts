// What a paste carries, as the clipboard's `DataTransfer` says it
type Pasted = Pick<DataTransfer, 'files' | 'types'>

/*
  The files a paste into the composer attaches: those it carries when it carries no text, as a
  screenshot or an image copied from a page do. A paste that carries text pastes the text, though a
  spreadsheet's cells come with a picture of themselves beside it
*/
function readConversationPastedFiles({ files, types }: Pasted) {
  if (!files.length || types.includes('text/plain')) return []

  return [...files]
}

export default readConversationPastedFiles
