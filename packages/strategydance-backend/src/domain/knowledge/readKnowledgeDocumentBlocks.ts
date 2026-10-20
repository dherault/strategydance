import { readRichTextYDocBlocks } from 'strategydance-design-system/lib/readRichTextYDocBlocks'
import type { RichTextBlock } from 'strategydance-design-system/lib/richText'
import { richTextToMarkdown } from 'strategydance-design-system/lib/richTextToMarkdown'
import type * as Y from 'yjs'

import type { KnowledgeDocumentBlock } from '~types'

/*
  The top-level blocks of a document's shared text, as an agent reads them, each with the id the
  shared text keeps it under and its Markdown. A numbered item reads with the number it shows, its
  place in its list, so an item an edit rewrites keeps it. Null when the text holds what this
  editor cannot read, a newer editor's block say, which a read would delete
*/
function readKnowledgeDocumentBlocks(doc: Y.Doc): KnowledgeDocumentBlock[] | null {
  const blocks = readRichTextYDocBlocks(doc)

  if (!blocks) return null

  let number = 0

  return blocks.map(({ id, value }) => {
    const [block] = value

    if (block?.type !== 'numberedListItem') {
      number = 0

      return { id, markdown: richTextToMarkdown(value) }
    }

    number = block.props?.start ?? number + 1

    const numbered: RichTextBlock = { ...block, props: { ...block.props, start: number } }

    return { id, markdown: richTextToMarkdown([numbered]) }
  })
}

export default readKnowledgeDocumentBlocks
