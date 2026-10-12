import {
  type RichTextBlock,
  type RichTextInline,
  getRichTextMentionWords,
} from 'strategydance-design-system/lib/richText'

/*
  The words of some blocks, in reading order: each block's text, then its children's, one line
  each, so a document's length counts each break between two blocks as one character. A table is
  a line per row, its cells apart by a tab, a picture, a video or a link preview an empty line, and
  a mention the words it was made with
*/
function getRichTextText(blocks: readonly RichTextBlock[]): string {
  return blocks
    .flatMap(block => [readBlock(block), ...(block.children ? [getRichTextText(block.children)] : [])])
    .join('\n')
}

function readBlock(block: RichTextBlock) {
  if (block.type === 'image' || block.type === 'videoEmbed' || block.type === 'linkPreview') return ''
  if (block.type !== 'table') return getRichTextInlineText(block.content ?? [])

  return block.content.rows.map(row => row.cells.map(getRichTextInlineText).join('\t')).join('\n')
}

// The words of some inline content, a link's and a mention's included
function getRichTextInlineText(content: readonly RichTextInline[]) {
  return content.map(readInline).join('')
}

function readInline(item: RichTextInline) {
  if (item.type === 'text') return item.text
  if (item.type === 'link') return item.content.map(run => run.text).join('')

  return getRichTextMentionWords(item)
}

export { getRichTextInlineText, getRichTextText }
