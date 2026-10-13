import { getRichTextMentionKinds } from 'strategydance-design-system/lib/getRichTextMentionKinds'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import type { RichTextBlock } from 'strategydance-design-system/lib/richText'

/*
  Whether some blocks say nothing: no text but blanks, nested blocks included, and no picture,
  video, link preview nor mention, which says something however few words it was made with. A
  table of empty cells, an empty code block and the place one of those is about to go say nothing
*/
function isRichTextEmpty(blocks: readonly RichTextBlock[]): boolean {
  return getRichTextText(blocks).trim() === '' && !blocks.some(hasMedia) && !getRichTextMentionKinds(blocks).length
}

function hasMedia(block: RichTextBlock): boolean {
  return (
    ((block.type === 'image' || block.type === 'videoEmbed' || block.type === 'linkPreview') && !!block.props?.url)
    || !!block.children?.some(hasMedia)
  )
}

export { isRichTextEmpty }
