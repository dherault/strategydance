import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import { getRichTextContentTypes, RICH_TEXT_TASK_BLOCKS } from 'strategydance-design-system/lib/richText'
import { richTextToMarkdown } from 'strategydance-design-system/lib/richTextToMarkdown'

// A task's stored description as the agent reads it: Markdown of a post's blocks and mentions, which
// is all a description holds, a mention the agent's link to what it names, and an empty string when
// it has none
function taskDescriptionToMarkdown(description: string) {
  return richTextToMarkdown(parseRichText(description, getRichTextContentTypes(RICH_TEXT_TASK_BLOCKS)))
}

export default taskDescriptionToMarkdown
