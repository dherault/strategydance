import { useQuery } from '@tanstack/react-query'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getConversationAttachmentQueryKey from '~utils/conversation/getConversationAttachmentQueryKey'

import { ApiError, requestApiFile } from '~data/api'

/*
  The bytes of a file one of the reader's messages sent, as the thread draws an image, read from
  the backend with the reader's token, since nothing else may read it, and kept, since they never
  change. The composer leaves the bytes of an image it sent here, so its thread draws it without
  reading it back. A file the backend says is gone, or not the reader's, is kept as none, so neither
  a remount, a focus nor a reconnection asks for it again; any other failure, a slow server or a
  lost connection, is tried again later
*/
function useConversationAttachmentFile(conversationId: string, attachmentId: string) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)

  const key = getConversationAttachmentQueryKey(organizationId, conversationId, attachmentId, viewerId)

  const { data, isError } = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      try {
        return await requestApiFile({
          path: `/organizations/${organizationId}/conversations/${conversationId}/attachments/${attachmentId}`,
          signal,
        })
      } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null

        throw error
      }
    },
    enabled: isEnabled,
    staleTime: Infinity,
    retry: 2,
  })

  return {
    file: data ?? null,
    // What names the file, for what is kept of it, as its thumbnail
    key,
    hasFailed: isEnabled && ((isError && data === undefined) || data === null),
  }
}

export default useConversationAttachmentFile
