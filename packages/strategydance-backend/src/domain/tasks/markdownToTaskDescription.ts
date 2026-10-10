import { MAX_TASK_DESCRIPTION_LENGTH } from 'strategydance-core'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { isRichTextEmpty } from 'strategydance-design-system/lib/isRichTextEmpty'
import { markdownToRichText } from 'strategydance-design-system/lib/markdownToRichText'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import {
  getRichTextBlockTypes,
  RICH_TEXT_POST_BLOCKS,
  type RichTextBlock,
  type RichTextInline,
} from 'strategydance-design-system/lib/richText'

type MarkdownToTaskDescriptionResult =
  | { outcome: 'written'; description: string; descriptionText: string }
  /** Past `MAX_TASK_DESCRIPTION_LENGTH` once stored */
  | { outcome: 'descriptionTooLong' }

// What separates a row's cells once a table is written as paragraphs
const CELL_SEPARATOR = ' | '

/*
  A description an agent wrote in Markdown, as a task stores it: a post's blocks, as the task's editor
  holds them, serialized, and an empty string when it says nothing, with its plain text beside it.
  Whatever a post cannot hold becomes paragraphs: a code block a paragraph of its text, and a table a
  paragraph per row, its cells' text joined by ` | `, turned so before the blocks are normalized,
  which would drop a table with its text, since it keeps no block without text of its own. Pictures
  load from nowhere, as they are dropped. Refused past `MAX_TASK_DESCRIPTION_LENGTH` once serialized
*/
function markdownToTaskDescription(markdown: string): MarkdownToTaskDescriptionResult {
  const blocks = normalizeRichText(writeTablesAsParagraphs(markdownToRichText(markdown)), {
    blockTypes: getRichTextBlockTypes(RICH_TEXT_POST_BLOCKS),
    media: false,
  })

  if (isRichTextEmpty(blocks)) return { outcome: 'written', description: '', descriptionText: '' }

  const description = JSON.stringify(blocks)

  if (description.length > MAX_TASK_DESCRIPTION_LENGTH) return { outcome: 'descriptionTooLong' }

  return { outcome: 'written', description, descriptionText: getRichTextText(blocks) }
}

// Each table a paragraph per row holding text, at any depth
function writeTablesAsParagraphs(blocks: readonly RichTextBlock[]): RichTextBlock[] {
  return blocks.flatMap((block): RichTextBlock[] => {
    if (block.type === 'table') {
      return block.content.rows
        .filter(row => row.cells.some(cell => cell.length > 0))
        .map(row => ({ type: 'paragraph', content: joinCells(row.cells) }))
    }

    return 'children' in block && block.children
      ? [{ ...block, children: writeTablesAsParagraphs(block.children) } as RichTextBlock]
      : [block]
  })
}

function joinCells(cells: readonly RichTextInline[][]) {
  return cells.flatMap((cell, index): RichTextInline[] =>
    index === 0 ? cell : [{ type: 'text', text: CELL_SEPARATOR }, ...cell],
  )
}

export default markdownToTaskDescription
