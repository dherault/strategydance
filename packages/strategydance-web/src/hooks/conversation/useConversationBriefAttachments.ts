import { useQuery } from '@tanstack/react-query'
import { QueryFetchPolicy } from 'firebase/data-connect'
import { getConversationBriefAttachments } from 'strategydance-database/web'

import type { ConversationMessageAttachment, DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const NO_ATTACHMENTS: ConversationMessageAttachment[] = []

/*
  The files a subagent's brief hands over, its parent's, by the ids the brief keeps, in that order,
  the order the subagent reads them, or none while they are not read. Read once, since a sent file
  never changes, and only among the parent's sent files, so an id from anywhere else reads nothing
*/
function useConversationBriefAttachments(
  parentId: string | null,
  attachmentIds: readonly string[],
): DataSource<ConversationMessageAttachment[]> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId && parentId && attachmentIds.length)

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetConversationBriefAttachments', organizationId, parentId, attachmentIds.join(), viewerId],
    queryFn: async () => {
      const { data: result } = await getConversationBriefAttachments(
        dataConnect,
        { organizationId: organizationId!, conversationId: parentId!, ids: [...attachmentIds] },
        { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
      )
      const byId = new Map(result.conversationAttachments.map(attachment => [attachment.id, attachment]))

      return attachmentIds.flatMap(id => byId.get(id) ?? [])
    },
    enabled: isEnabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retryOnMount: false,
  })

  return {
    data: data ?? NO_ATTACHMENTS,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useConversationBriefAttachments
