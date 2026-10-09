import { createRichTextYUpdate } from 'strategydance-design-system/lib/createRichTextYUpdate'
import { markdownToRichText } from 'strategydance-design-system/lib/markdownToRichText'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import * as Y from 'yjs'

import measureKnowledgeDocumentText from '~domain/knowledge/measureKnowledgeDocumentText'

/*
  The text of a document an agent creates, from its Markdown: its first snapshot, its content and
  its plain text, as a fold measures them. What it writes loads nothing from elsewhere, as every
  agent's edit does: no picture, no video and no link preview's picture
*/
function createKnowledgeDocumentText(markdown: string) {
  const blocks = normalizeRichText(markdownToRichText(markdown), { media: false })
  const doc = new Y.Doc()

  Y.applyUpdate(doc, createRichTextYUpdate(JSON.stringify(blocks)))

  return measureKnowledgeDocumentText(doc)
}

export default createKnowledgeDocumentText
