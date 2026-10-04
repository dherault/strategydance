import { useQueryClient } from '@tanstack/react-query'
import {
  type GetConversationsAwaitingAnswerData,
  type GetConversationsData,
  deleteConversation as deleteConversationMutation,
  restoreConversation as restoreConversationMutation,
} from 'strategydance-database/web'

import type { ConversationSummary } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import writeOptimistically from '~utils/common/writeOptimistically'

import { dataConnect } from '~data/firebase'

// Latest activity first, then by id, as `GetConversations` orders them
function compareConversations(a: ConversationSummary, b: ConversationSummary) {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/*
  Deletes one of the reader's conversations, and takes the delete back, as the list's Undo does.
  Both show at once, in the list and in the sidebar's count of conversations waiting for an
  answer, before the server has them, and both lists are read again once it does
*/
function useDeleteConversation() {
  const queryClient = useQueryClient()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const listKey = ['GetConversations', organizationId, viewerId]
  const awaitingAnswerKey = ['GetConversationsAwaitingAnswer', organizationId, viewerId]

  function setConversations(update: (conversations: ConversationSummary[]) => ConversationSummary[]) {
    queryClient.setQueryData<GetConversationsData>(
      listKey,
      current => current && { ...current, conversations: update(current.conversations) },
    )
  }

  function setAwaitingAnswer(update: (ids: string[]) => string[]) {
    queryClient.setQueryData<GetConversationsAwaitingAnswerData>(
      awaitingAnswerKey,
      current =>
        current && { ...current, conversations: update(current.conversations.map(({ id }) => id)).map(id => ({ id })) },
    )
  }

  function change(conversationId: string, apply: () => void, write: () => Promise<unknown>) {
    return writeOptimistically({
      queryClient,
      queryKeys: [listKey, awaitingAnswerKey],
      rowKey: `conversation:${conversationId}`,
      apply,
      write,
    })
  }

  function deleteConversation({ id }: ConversationSummary) {
    return change(
      id,
      () => {
        setConversations(current => current.filter(conversation => conversation.id !== id))
        setAwaitingAnswer(current => current.filter(currentId => currentId !== id))
      },
      () => deleteConversationMutation(dataConnect, { organizationId: organizationId!, userId: viewerId!, id }),
    )
  }

  // Puts a deleted conversation back in its place, which its last activity decides
  function restoreConversation(conversation: ConversationSummary) {
    const { id } = conversation

    return change(
      id,
      () => {
        setConversations(current =>
          [...current.filter(other => other.id !== id), conversation].sort(compareConversations),
        )

        if (conversation.isAwaitingAnswer) setAwaitingAnswer(current => [...current.filter(other => other !== id), id])
      },
      () => restoreConversationMutation(dataConnect, { organizationId: organizationId!, userId: viewerId!, id }),
    )
  }

  return { deleteConversation, restoreConversation }
}

export default useDeleteConversation
