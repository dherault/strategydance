import { use } from 'react'
import RichTextMentionsContext from 'strategydance-design-system/contexts/RichTextMentionsContext'

function useRichTextMentions() {
  return use(RichTextMentionsContext)
}

export default useRichTextMentions
