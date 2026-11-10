import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import { getRichTextContentTypes, RICH_TEXT_NOTE_BLOCKS } from 'strategydance-design-system/lib/richText'
import { richTextToMarkdown } from 'strategydance-design-system/lib/richTextToMarkdown'

// A note as the agent reads it: Markdown of a note's blocks, which is all a note holds, and an empty
// string for one cleared or never written
function knowledgeNoteToMarkdown(content: string) {
  return richTextToMarkdown(parseRichText(content, getRichTextContentTypes(RICH_TEXT_NOTE_BLOCKS)))
}

export default knowledgeNoteToMarkdown
