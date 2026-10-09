import { readRichTextYDocBlocks } from 'strategydance-design-system/lib/readRichTextYDocBlocks'
import type { RichTextBlock } from 'strategydance-design-system/lib/richText'
import { richTextToMarkdown } from 'strategydance-design-system/lib/richTextToMarkdown'

import type { KnowledgeDocumentBlock, SeededKnowledgeDocumentText } from '~types'

import openKnowledgeDocumentText from '~domain/knowledge/openKnowledgeDocumentText'

type ReadKnowledgeDocumentTextResult =
  | { outcome: 'read'; blocks: KnowledgeDocumentBlock[] }
  /** The snapshot cannot be merged */
  | { outcome: 'unreadableState' }
  /** The text holds what this editor cannot read, a newer editor's block say, which a read would delete */
  | { outcome: 'unknownContent' }

/*
  A seeded document's shared text, as an agent reads it: its snapshot with every pending update
  merged, never `content`, which lags until the next compaction, as top-level blocks, each with
  the id the shared text keeps it under and its Markdown. A numbered item reads with the number it
  shows, its place in its list, so an item an edit rewrites keeps it
*/
function readKnowledgeDocumentText(text: SeededKnowledgeDocumentText): ReadKnowledgeDocumentTextResult {
  const opened = openKnowledgeDocumentText(text)

  if (!opened) return { outcome: 'unreadableState' }

  const blocks = readRichTextYDocBlocks(opened.doc)

  if (!blocks) return { outcome: 'unknownContent' }

  let number = 0

  return {
    outcome: 'read',
    blocks: blocks.map(({ id, value }) => {
      const [block] = value

      if (block?.type !== 'numberedListItem') {
        number = 0

        return { id, markdown: richTextToMarkdown(value) }
      }

      number = block.props?.start ?? number + 1

      const numbered: RichTextBlock = { ...block, props: { ...block.props, start: number } }

      return { id, markdown: richTextToMarkdown([numbered]) }
    }),
  }
}

export default readKnowledgeDocumentText
