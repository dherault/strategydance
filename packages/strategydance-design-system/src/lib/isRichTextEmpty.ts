import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import type { RichTextBlock } from 'strategydance-design-system/lib/richText'

/*
  Whether some blocks say nothing: no text but blanks, nested blocks included, and no picture nor
  video. A table of empty cells, an empty code block and the place a picture or a video is about to
  go say nothing
*/
function isRichTextEmpty(blocks: readonly RichTextBlock[]): boolean {
  return getRichTextText(blocks).trim() === '' && !blocks.some(hasMedia)
}

function hasMedia(block: RichTextBlock): boolean {
  return (
    ((block.type === 'image' || block.type === 'videoEmbed') && !!block.props?.url) || !!block.children?.some(hasMedia)
  )
}

export { isRichTextEmpty }
