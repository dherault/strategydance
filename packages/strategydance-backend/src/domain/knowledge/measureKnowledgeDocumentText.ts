import { MAX_DOCUMENT_CONTENT_LENGTH, MAX_DOCUMENT_STATE_LENGTH } from 'strategydance-core'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { readRichTextYDoc } from 'strategydance-design-system/lib/readRichTextYDoc'
import * as Y from 'yjs'

type MeasureKnowledgeDocumentTextResult =
  | { outcome: 'measured'; state: string; content: string; contentText: string }
  /** Its text, as stored, is longer than a document's content may be */
  | { outcome: 'contentTooLong' }
  /** Its snapshot is longer than a document's may be, as what was deleted from it still counts */
  | { outcome: 'stateTooLong' }

/*
  What a document's row stores of a shared text: its snapshot in base64, its text as `content`, as
  the page's compaction writes it, an empty string when it says nothing, and the plain text of
  that, `contentText`, which search reads. Held to the bounds `CompactDocument` holds a fold to,
  and never to an update's, since a fold is not a push: a long edit is stored whole.

  The text is read before the snapshot is encoded, since a read can join two texts the document
  wrote side by side, and the snapshot then holds what the content says
*/
function measureKnowledgeDocumentText(doc: Y.Doc): MeasureKnowledgeDocumentTextResult {
  const { value, isEmpty } = readRichTextYDoc(doc)
  const content = isEmpty ? '' : value

  if (content.length > MAX_DOCUMENT_CONTENT_LENGTH) return { outcome: 'contentTooLong' }

  const state = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')

  if (state.length > MAX_DOCUMENT_STATE_LENGTH) return { outcome: 'stateTooLong' }

  return { outcome: 'measured', state, content, contentText: isEmpty ? '' : getRichTextText(JSON.parse(value)) }
}

export default measureKnowledgeDocumentText
