import { FileTextIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import {
  SuggestionList,
  SuggestionListEmpty,
  SuggestionListItem,
  SuggestionListLabel,
  SuggestionListOptions,
} from 'strategydance-design-system/components/ui/SuggestionList'

import type { DocumentSummary } from '~types'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The listbox's id, which the field names as what it controls
  listId: string
  getOptionId: (index: number) => string
  documents: DocumentSummary[]
  highlightedIndex: number
  // What is typed after the `@`
  query: string
  onHighlight: (index: number) => void
  onPick: (document: DocumentSummary) => void
}

/*
  The documents a mention being typed suggests, over the composer's whole width just above its
  field, each document's title with a file icon, or what nothing matching says. No taller than
  a phone's screen leaves room for beside its keyboard
*/
function ConversationMentionList({
  listId,
  getOptionId,
  documents,
  highlightedIndex,
  query,
  onHighlight,
  onPick,
}: Props) {
  const { formatMessage } = useIntl()
  const labelId = `${listId}-label`

  return (
    <SuggestionList className="absolute inset-x-0 bottom-[calc(100%-4px)] max-h-[min(280px,45svh)]">
      {documents.length ? (
        <>
          <SuggestionListLabel id={labelId}>{formatMessage(conversationMessages.mentionListLabel)}</SuggestionListLabel>
          <SuggestionListOptions
            id={listId}
            aria-labelledby={labelId}
          >
            {documents.map((document, index) => (
              <SuggestionListItem
                key={document.id}
                id={getOptionId(index)}
                isHighlighted={index === highlightedIndex}
                onPointerMove={() => onHighlight(index)}
                onClick={() => onPick(document)}
              >
                <FileTextIcon />
                <span className="min-w-0 flex-1 truncate">{document.title.trim()}</span>
              </SuggestionListItem>
            ))}
          </SuggestionListOptions>
        </>
      ) : (
        <SuggestionListEmpty>{formatMessage(conversationMessages.mentionEmpty, { query })}</SuggestionListEmpty>
      )}
    </SuggestionList>
  )
}

export default ConversationMentionList
