import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'

// The plain text of a document's stored `content`, as a page writes it beside the content and the
// search reads it, for a document a page from before `contentText` left unindexed
function readKnowledgeDocumentContentText(content: string) {
  return getRichTextText(parseRichText(content))
}

export default readKnowledgeDocumentContentText
