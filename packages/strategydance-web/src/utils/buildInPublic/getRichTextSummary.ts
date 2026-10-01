import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'

const fold = (text: string) => text.replace(/\s+/g, ' ').trim()

/*
  What a card quotes of a log entry, from the blocks it is stored as: the words of its first
  paragraph or heading that has any, without what is nested under it, else all of its words, and
  the words of its first quote, if it has one. Whitespace is folded, a line break included, since
  a card writes them on one line or a few. A value it cannot read says nothing
*/
function getRichTextSummary(value: string) {
  const blocks = parseRichText(value)
  const firstText = blocks
    .filter(block => block.type === 'paragraph' || block.type === 'heading')
    .map(block => fold(getRichTextText([{ type: block.type, content: block.content }])))
    .find(Boolean)
  const quoteBlock = blocks.find(block => block.type === 'quote')
  const quote = quoteBlock ? fold(getRichTextText([quoteBlock])) : ''

  return { text: firstText ?? fold(getRichTextText(blocks)), quote: quote || null }
}

export default getRichTextSummary
