import { isRichTextEmpty } from 'strategydance-design-system/lib/isRichTextEmpty'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'

/*
  Whether a stored rich text value says anything: false for nothing, for blocks holding only
  blanks, and for a value the renderer cannot read, which then draws nothing either. A picture
  says something
*/
function hasRichText(value: string | null | undefined) {
  return !isRichTextEmpty(parseRichText(value))
}

export { hasRichText }
