import { MAX_KNOWLEDGE_NOTE_LENGTH } from 'strategydance-core'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { isRichTextEmpty } from 'strategydance-design-system/lib/isRichTextEmpty'
import { markdownToRichText } from 'strategydance-design-system/lib/markdownToRichText'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import { getRichTextContentTypes, RICH_TEXT_NOTE_BLOCKS } from 'strategydance-design-system/lib/richText'

type MarkdownToKnowledgeNoteResult =
  | { outcome: 'written'; content: string; contentText: string }
  /** Past `MAX_KNOWLEDGE_NOTE_LENGTH` once stored */
  | { outcome: 'notesTooLong' }

/*
  Notes an agent wrote in Markdown, as a note stores them: a note's blocks, as the page's editor
  holds them, serialized, and an empty string when they say nothing, with their plain text beside
  them. Pictures load from nowhere, as they are dropped. Refused past `MAX_KNOWLEDGE_NOTE_LENGTH`
  once serialized
*/
function markdownToKnowledgeNote(markdown: string): MarkdownToKnowledgeNoteResult {
  const blocks = normalizeRichText(markdownToRichText(markdown), {
    ...getRichTextContentTypes(RICH_TEXT_NOTE_BLOCKS),
    media: false,
  })

  if (isRichTextEmpty(blocks)) return { outcome: 'written', content: '', contentText: '' }

  const content = JSON.stringify(blocks)

  if (content.length > MAX_KNOWLEDGE_NOTE_LENGTH) return { outcome: 'notesTooLong' }

  return { outcome: 'written', content, contentText: getRichTextText(blocks) }
}

export default markdownToKnowledgeNote
