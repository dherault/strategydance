import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import { getRichTextBlockTypes, RICH_TEXT_POST_BLOCKS } from 'strategydance-design-system/lib/richText'
import { richTextToMarkdown } from 'strategydance-design-system/lib/richTextToMarkdown'

// A task's stored description as the agent reads it: Markdown of a post's blocks, which is all a
// description holds, and an empty string when it has none
function taskDescriptionToMarkdown(description: string) {
  return richTextToMarkdown(parseRichText(description, { blockTypes: getRichTextBlockTypes(RICH_TEXT_POST_BLOCKS) }))
}

export default taskDescriptionToMarkdown
