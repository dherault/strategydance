import {
  RICH_TEXT_MENTION_KINDS,
  type RichTextBlock,
  type RichTextInline,
  type RichTextMentionKind,
  getRichTextMentionKind,
} from 'strategydance-design-system/lib/richText'

/*
  What some blocks mention, documents, tasks, conversations or several, in that order, nested blocks and a table's
  cells included: the lists a page reads to draw their mentions, and none when they mention nothing
*/
function getRichTextMentionKinds(blocks: readonly RichTextBlock[]): RichTextMentionKind[] {
  const kinds = new Set<RichTextMentionKind>()

  const visit = (block: RichTextBlock) => {
    for (const item of readContent(block)) {
      const kind = getRichTextMentionKind(item.type)

      if (kind) kinds.add(kind)
    }

    block.children?.forEach(visit)
  }

  blocks.forEach(visit)

  return RICH_TEXT_MENTION_KINDS.filter(kind => kinds.has(kind))
}

function readContent(block: RichTextBlock): readonly RichTextInline[] {
  if (block.type === 'table') return block.content.rows.flatMap(row => row.cells.flat())

  return 'content' in block ? (block.content ?? []) : []
}

export { getRichTextMentionKinds }
