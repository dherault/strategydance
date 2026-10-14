import { getRichTextInlineText } from 'strategydance-design-system/lib/getRichTextText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import type { RichTextTextBlock } from 'strategydance-design-system/lib/richText'

/*
  What a card quotes of a task's description: the words of its first paragraph that has any,
  whitespace folded, a line break included, since the card writes it on a line or two. Never a
  heading, a list or a quote, which say what the task is made of rather than what it is: a
  description of nothing else says nothing, as does one it cannot read
*/
function getTaskExcerpt(description: string) {
  return (
    parseRichText(description)
      .filter((block): block is RichTextTextBlock => block.type === 'paragraph')
      .map(block =>
        getRichTextInlineText(block.content ?? [])
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .find(Boolean) ?? null
  )
}

export default getTaskExcerpt
