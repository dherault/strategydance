import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import { getRichTextContentTypes, RICH_TEXT_NOTE_BLOCKS } from 'strategydance-design-system/lib/richText'

// The plain text of a stored note, as the page writes it beside the note and a read too long for
// Markdown gives it
function readKnowledgeNoteText(content: string) {
  return getRichTextText(parseRichText(content, getRichTextContentTypes(RICH_TEXT_NOTE_BLOCKS)))
}

export default readKnowledgeNoteText
