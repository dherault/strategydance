import { MessagesSquareIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import useConversations from '~hooks/conversation/useConversations'

import Spinner from '~components/common/Spinner'
import ConversationTable from '~components/conversation/ConversationTable'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'

import conversationMessages from '~data/intl/messages/conversation'
import navigationMessages from '~data/intl/messages/navigation'

/*
  The reader's conversations with Strategy Dance in the current organization, latest activity
  first. Private: nobody else sees them, administrators included
*/
function Conversations() {
  const { formatMessage } = useIntl()
  const { data: conversations, loading, refetch, hasFailed } = useConversations()

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
        </Empty>
      )
    }

    return <ConversationTable conversations={conversations} />
  }

  return (
    <ContainerLayout className="gap-8">
      <PageHeader
        eyebrow={formatMessage(navigationMessages.reflection)}
        title={formatMessage(navigationMessages.conversations)}
        lead={formatMessage(conversationMessages.lead)}
      />
      {renderBody()}
    </ContainerLayout>
  )
}

export default Conversations
