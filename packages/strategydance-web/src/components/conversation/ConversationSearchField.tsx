import type { KeyboardEvent } from 'react'
import { useIntl } from 'react-intl'
import { MAX_SEARCH_QUERY_LENGTH, MAX_SEARCH_TERMS, splitSearchTerms } from 'strategydance-core'
import { SearchInput } from 'strategydance-design-system/components/ui/SearchInput'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  value: string
  onChange: (value: string) => void
}

/*
  The field that searches the reader's conversations, bounded as the backend is: it takes at most
  100 characters, and past 8 words it says so, and nothing is searched until some go. Escape
  empties it
*/
function ConversationSearchField({ value, onChange }: Props) {
  const { formatMessage } = useIntl()

  const hasTooManyWords = splitSearchTerms(value).length > MAX_SEARCH_TERMS

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape' || !value) return

    event.preventDefault()
    onChange('')
  }

  return (
    <SearchInput
      value={value}
      maxLength={MAX_SEARCH_QUERY_LENGTH}
      placeholder={formatMessage(conversationMessages.searchLabel)}
      aria-label={formatMessage(conversationMessages.searchLabel)}
      error={
        hasTooManyWords ? formatMessage(conversationMessages.searchTooManyWords, { max: MAX_SEARCH_TERMS }) : undefined
      }
      className="w-full max-w-80 min-w-50"
      onChange={event => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
    />
  )
}

export default ConversationSearchField
