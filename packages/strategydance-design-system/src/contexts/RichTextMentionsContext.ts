import { createContext } from 'react'
import { RICH_TEXT_ENGLISH_LABELS, type RichTextLabels } from 'strategydance-design-system/lib/getRichTextDictionary'
import type { RichTextMentionSource } from 'strategydance-design-system/lib/richText'

/*
  What `RichText` draws its mentions from: the page's source, or null where the page gives none,
  and the words a mention says without a list
*/
export type RichTextMentionsContextType = {
  source: RichTextMentionSource | null
  labels: Pick<RichTextLabels, 'mentionUntitled' | 'mentionDocumentGone' | 'mentionTaskGone'>
}

export default createContext<RichTextMentionsContextType>({
  source: null,
  labels: RICH_TEXT_ENGLISH_LABELS,
})
