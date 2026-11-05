import { queryOptions } from '@tanstack/react-query'

import getConversationAttachmentQueryKey from '~utils/conversation/getConversationAttachmentQueryKey'

import { ApiError, requestApiFile } from '~data/api'

/*
  How the bytes of a file a message sent are read and kept, as the thread draws an image and as a
  chip downloads any other file: from the backend with the reader's token, since nothing else may
  read it, and kept, since they never change. A file the backend says is gone, or not the reader's,
  is kept as none, so it is never asked for again; any other failure, a slow server or a lost
  connection, is tried again
*/
function getConversationAttachmentQueryOptions(
  organizationId: string | null,
  conversationId: string,
  attachmentId: string,
  viewerId: string | null,
) {
  return queryOptions({
    queryKey: getConversationAttachmentQueryKey(organizationId, conversationId, attachmentId, viewerId),
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
    staleTime: Infinity,
    retry: 2,
  })
}

export default getConversationAttachmentQueryOptions
