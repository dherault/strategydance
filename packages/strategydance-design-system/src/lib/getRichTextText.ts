import type { RichTextBlock, RichTextInline } from 'strategydance-design-system/lib/richText'

/*
  The words of some blocks, in reading order: each block's text, then its children's, one line
  each, so a document's length counts each break between two blocks as one character. A table is
  a line per row, its cells apart by a tab, and a picture or a video an empty line
*/
function getRichTextText(blocks: readonly RichTextBlock[]): string {
  return blocks
    .flatMap(block => [readBlock(block), ...(block.children ? [getRichTextText(block.children)] : [])])
    .join('\n')
}

function readBlock(block: RichTextBlock) {
  if (block.type === 'image' || block.type === 'videoEmbed') return ''
  if (block.type !== 'table') return getRichTextInlineText(block.content ?? [])

  return block.content.rows.map(row => row.cells.map(getRichTextInlineText).join('\t')).join('\n')
}

// The words of some inline content, a link's included
function getRichTextInlineText(content: readonly RichTextInline[]) {
  return content.map(item => (item.type === 'link' ? item.content.map(run => run.text).join('') : item.text)).join('')
}

export { getRichTextInlineText, getRichTextText }
