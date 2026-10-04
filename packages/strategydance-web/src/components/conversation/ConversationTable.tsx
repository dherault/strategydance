import { useIntl } from 'react-intl'
import { Table, TableBody, TableHead, TableHeader, TableRow } from 'strategydance-design-system/components/ui/Table'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { ConversationSummary } from '~types'

import useNow from '~hooks/common/useNow'
import useDeleteConversation from '~hooks/conversation/useDeleteConversation'

import ConversationRow from '~components/conversation/ConversationRow'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversations: ConversationSummary[]
}

/*
  The reader's conversations, one row each, latest activity first. Deleting one takes it off at
  once and offers Undo for as long as the notification stays
*/
function ConversationTable({ conversations }: Props) {
  const { formatMessage } = useIntl()
  const now = useNow()
  const { deleteConversation, restoreConversation } = useDeleteConversation()

  async function handleDelete(conversation: ConversationSummary) {
    try {
      await deleteConversation(conversation)
    } catch (error) {
      console.error('Could not delete a conversation', error)
      toast.error(formatMessage(conversationMessages.deleteError))

      return
    }

    toast(formatMessage(conversationMessages.deleted, { title: conversation.title }), {
      action: {
        label: formatMessage(conversationMessages.undo),
        onClick: () => {
          restoreConversation(conversation).catch(error => {
            console.error('Could not restore a conversation', error)
            toast.error(formatMessage(conversationMessages.restoreError))
          })
        },
      },
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{formatMessage(conversationMessages.columnConversation)}</TableHead>
          <TableHead className="max-sm:hidden">{formatMessage(conversationMessages.columnAspects)}</TableHead>
          <TableHead align="right">{formatMessage(conversationMessages.columnUpdated)}</TableHead>
          <TableHead>
            <span className="sr-only">{formatMessage(conversationMessages.columnActions)}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {conversations.map(conversation => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            now={now}
            onDelete={handleDelete}
          />
        ))}
      </TableBody>
    </Table>
  )
}

export default ConversationTable
