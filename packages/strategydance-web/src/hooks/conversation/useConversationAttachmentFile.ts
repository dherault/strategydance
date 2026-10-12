import { useQuery } from '@tanstack/react-query'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getConversationAttachmentQueryKey from '~utils/conversation/getConversationAttachmentQueryKey'

import { ApiError, requestApiFile } from '~data/api'

/*
  The bytes of a file one of the reader's messages sent, as the thread draws an image, read from
  the backend with the reader's token, since nothing else may read it, and kept, since they never
  change. The composer leaves the bytes of an image it sent here, so its thread draws it without
  reading it back. A file the backend says is gone, or not the reader's, is not asked for again
*/
function useConversationAttachmentFile(conversationId: string, attachmentId: string) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)

  const { data, isError } = useQuery({
    queryKey: getConversationAttachmentQueryKey(organizationId, conversationId, attachmentId, viewerId),
    queryFn: ({ signal }) =>
      requestApiFile({
        path: `/organizations/${organizationId}/conversations/${conversationId}/attachments/${attachmentId}`,
        signal,
      }),
    enabled: isEnabled,
    staleTime: Infinity,
    retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
  })

  return {
    file: data ?? null,
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useConversationAttachmentFile
