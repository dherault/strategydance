import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'

/*
  Whether a stored rich text value says anything: false for nothing, for blocks holding only
  blanks, and for a value the renderer cannot read, which then draws nothing either
*/
function hasRichText(value: string | null | undefined) {
  return getRichTextText(parseRichText(value)).trim() !== ''
}

export { hasRichText }
