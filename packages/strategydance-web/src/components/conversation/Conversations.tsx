import { MessagesSquareIcon } from 'lucide-react'
import { useState } from 'react'
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

import type { ConversationAuthorFilter as AuthorFilter } from '~types'

import useConversations from '~hooks/conversation/useConversations'
import useUser from '~hooks/user/useUser'

import filterConversationsByAuthor from '~utils/conversation/filterConversationsByAuthor'
import listConversationAuthors from '~utils/conversation/listConversationAuthors'

import Spinner from '~components/common/Spinner'
import ConversationAuthorFilter from '~components/conversation/ConversationAuthorFilter'
import ConversationSearchField from '~components/conversation/ConversationSearchField'
import ConversationSearchResults from '~components/conversation/ConversationSearchResults'
import ConversationTable from '~components/conversation/ConversationTable'
import NewConversationButton from '~components/conversation/NewConversationButton'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'

import conversationMessages from '~data/intl/messages/conversation'
import navigationMessages from '~data/intl/messages/navigation'

/*
  The conversations of the current organization's members with Strategy Dance, latest activity
  first, each with the face of the member who started it. Every member reads them all, and writes
  in their own alone.

  Once there is one, a field above the list searches them, and the list shows what it found. Once
  somebody else started one too, a menu beside it narrows the list, and the search's, to the
  reader's or to one member's
*/
function Conversations() {
  const { formatMessage } = useIntl()
  const { data: conversations, loading, refetch, hasFailed } = useConversations()
  const { data: user } = useUser()
  const [query, setQuery] = useState('')
  const [authorFilter, setAuthorFilter] = useState<AuthorFilter>('all')

  const viewerId = user?.id ?? null
  const authors = listConversationAuthors(conversations, viewerId)
  // A member whose last conversation went is no longer offered, and the list shows everybody's
  const shownFilter =
    authorFilter === 'all' || authorFilter === 'me' || authors.some(({ id }) => authorFilter === `user:${id}`)
      ? authorFilter
      : 'all'
  const shownConversations = filterConversationsByAuthor(conversations, shownFilter, viewerId)
  // Offered once somebody else started a conversation, and kept while it narrows the list, so it
  // can be set back
  const isAuthorFilterShown = authors.length > 0 || shownFilter !== 'all'

  function renderBody() {
    if (hasFailed) {
      return (
        <div className="flex flex-col items-start gap-4">
          <Alert
            variant="danger"
            className="max-w-xl"
          >
            {formatMessage(conversationMessages.loadError)}
          </Alert>
          <Button
            variant="outline"
            disabled={loading}
            icon={loading ? <Spinner tone="current" /> : undefined}
            onClick={refetch}
          >
            {formatMessage(conversationMessages.retry)}
          </Button>
        </div>
      )
    }

    if (!conversations.length) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <MessagesSquareIcon />
            </EmptyMedia>
            <EmptyTitle>{formatMessage(conversationMessages.emptyTitle)}</EmptyTitle>
            <EmptyDescription>{formatMessage(conversationMessages.emptyText)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <NewConversationButton />
          </EmptyContent>
        </Empty>
      )
    }

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <ConversationSearchField
            value={query}
            onChange={setQuery}
          />
          {isAuthorFilterShown ? (
            <ConversationAuthorFilter
              value={shownFilter}
              viewer={user ?? null}
              authors={authors}
              onChange={setAuthorFilter}
            />
          ) : null}
        </div>
        {renderList()}
      </div>
    )
  }

  function renderList() {
    if (query.trim()) {
      return (
        <ConversationSearchResults
          query={query}
          conversations={shownConversations}
          onClear={() => setQuery('')}
        />
      )
    }

    if (shownConversations.length) return <ConversationTable conversations={shownConversations} />

    // Only the reader's own can be none, since every other member offered started one
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <MessagesSquareIcon />
          </EmptyMedia>
          <EmptyTitle>{formatMessage(conversationMessages.authorFilterMineEmpty)}</EmptyTitle>
          <EmptyDescription>{formatMessage(conversationMessages.emptyText)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <NewConversationButton />
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <ContainerLayout className="gap-8">
      <PageHeader
        title={formatMessage(navigationMessages.conversations)}
        lead={formatMessage(conversationMessages.lead)}
        actions={<NewConversationButton />}
      />
      {renderBody()}
    </ContainerLayout>
  )
}

export default Conversations
