import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import type { RichTextBlock } from 'strategydance-design-system/lib/richText'

/*
  Whether some blocks say nothing: no text but blanks, nested blocks included, and no picture,
  video nor link preview. A table of empty cells, an empty code block and the place one of those
  is about to go say nothing
*/
function isRichTextEmpty(blocks: readonly RichTextBlock[]): boolean {
  return getRichTextText(blocks).trim() === '' && !blocks.some(hasMedia)
}

function hasMedia(block: RichTextBlock): boolean {
  return (
    ((block.type === 'image' || block.type === 'videoEmbed' || block.type === 'linkPreview') && !!block.props?.url)
    || !!block.children?.some(hasMedia)
  )
}

export { isRichTextEmpty }
