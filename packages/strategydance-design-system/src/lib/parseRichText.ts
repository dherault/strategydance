import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import type { RichTextBlock, RichTextBlockType } from 'strategydance-design-system/lib/richText'

type Options = {
  /** The blocks to keep, every one unless it says fewer. Any other block holding text becomes a paragraph */
  blockTypes?: readonly RichTextBlockType[]
}

/*
  A stored rich text value, read as the blocks `normalizeRichText` keeps. Nothing, a value that is
  not JSON, and a value that is no list of blocks, as Lexical's editor state is not, all read as
  no blocks. Only the value that is not JSON is logged: an old Lexical one is expected
*/
function parseRichText(value: string | null | undefined, options?: Options): RichTextBlock[] {
  if (!value) return []

  try {
    return normalizeRichText(JSON.parse(value), options)
  } catch (error) {
    console.error('Could not read a rich text value', error)

    return []
  }
}

export { parseRichText }
