import { MessagesSquareIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import type { ConversationSummary } from '~types'

import useConversationSearch from '~hooks/conversation/useConversationSearch'

import Spinner from '~components/common/Spinner'
import ConversationTable from '~components/conversation/ConversationTable'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  query: string
  // The reader's conversations as the list holds them, kept live, which the search's ids pick from
  conversations: ConversationSummary[]
  onClear: () => void
}

/*
  The conversations a search found, in the list's own order, latest activity first, and kept live
  as the list is. Mounted only while the field holds something, so clearing it forgets the last
  search, and a new one starts from a spinner rather than from an old answer.

  Says when the search kept only the best matches, or read only the recent conversations' messages,
  and offers to clear the field when nothing matched
*/
function ConversationSearchResults({ query, conversations, onClear }: Props) {
  const { formatMessage } = useIntl()
  const { result, isSearching, failure, retry } = useConversationSearch(query)

  if (failure) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert
          variant="danger"
          className="max-w-xl"
        >
          {formatMessage(failure === 'tooMany' ? conversationMessages.searchTooMany : conversationMessages.searchError)}
        </Alert>
        <Button
          variant="outline"
          onClick={retry}
        >
          {formatMessage(conversationMessages.searchRetry)}
        </Button>
      </div>
    )
  }

  // Nothing yet, and nothing coming while the query holds more words than a search takes
  if (!result) {
    if (!isSearching) return null

    return (
      <div className="flex min-h-40 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const matchingIds = new Set(result.conversationIds)
  const matches = conversations.filter(conversation => matchingIds.has(conversation.id))

  function renderCoverage() {
    if (result?.coverage === 'BEST_MATCHES') return formatMessage(conversationMessages.searchBestMatches)
    if (result?.coverage === 'RECENT') return formatMessage(conversationMessages.searchRecent)

    return null
  }

  const coverage = renderCoverage()

  return (
    <>
      {coverage ? <p className="text-sm text-muted-foreground">{coverage}</p> : null}
      {matches.length ? (
        <ConversationTable conversations={matches} />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <MessagesSquareIcon />
            </EmptyMedia>
            <EmptyTitle>{formatMessage(conversationMessages.searchNoMatchTitle, { query: result.query })}</EmptyTitle>
            <EmptyDescription>{formatMessage(conversationMessages.searchNoMatchText)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
            >
              {formatMessage(conversationMessages.searchClear)}
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  )
}

export default ConversationSearchResults
