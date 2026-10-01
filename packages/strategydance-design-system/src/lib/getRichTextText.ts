import type { RichTextBlock, RichTextInline } from 'strategydance-design-system/lib/richText'

/*
  The words of some blocks, in reading order: each block's text, then its children's, one line
  each, so a document's length counts each break between two blocks as one character
*/
function getRichTextText(blocks: readonly RichTextBlock[]): string {
  return blocks
    .flatMap(block => [readInline(block.content ?? []), ...(block.children ? [getRichTextText(block.children)] : [])])
    .join('\n')
}

function readInline(content: readonly RichTextInline[]) {
  return content.map(item => (item.type === 'link' ? item.content.map(run => run.text).join('') : item.text)).join('')
}

export { getRichTextText }
