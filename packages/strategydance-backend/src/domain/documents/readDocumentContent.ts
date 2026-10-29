import { MAX_DOCUMENT_CONTENT_LENGTH } from 'strategydance-core'
import { readRichTextYDoc } from 'strategydance-design-system/lib/readRichTextYDoc'
import type * as Y from 'yjs'

/*
  A document's text as a revision keeps it for a member to look at: BlockNote's blocks, serialized,
  as `Document.content` holds a document's. An empty string when the text is empty, and when it is
  longer than a document's content may be, which only the revision's snapshot then keeps: the
  member still restores it, and only the look at it is lost
*/
function readDocumentContent(doc: Y.Doc) {
  const { value, isEmpty } = readRichTextYDoc(doc)

  return isEmpty || value.length > MAX_DOCUMENT_CONTENT_LENGTH ? '' : value
}

export default readDocumentContent
