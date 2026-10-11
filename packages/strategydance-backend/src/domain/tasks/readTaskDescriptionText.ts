import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'

// The plain text of a task's stored description, as the page writes it beside the description and a
// query matches it: what the index and the backfill fill a null one with
function readTaskDescriptionText(description: string) {
  return getRichTextText(parseRichText(description))
}

export default readTaskDescriptionText
