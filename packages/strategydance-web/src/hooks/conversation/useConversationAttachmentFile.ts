import { useQuery } from '@tanstack/react-query'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getConversationAttachmentQueryOptions from '~utils/conversation/getConversationAttachmentQueryOptions'

/*
  The bytes of a file one of the reader's messages sent, as the thread draws an image, read and
  kept as `getConversationAttachmentQueryOptions` says. The composer leaves the bytes of an image it
  sent here, so its thread draws it without reading it back. A file the backend says is gone, or not
  the reader's, is kept as none, so neither a remount, a focus nor a reconnection asks for it again
*/
function useConversationAttachmentFile(conversationId: string, attachmentId: string) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)

  const options = getConversationAttachmentQueryOptions(organizationId, conversationId, attachmentId, viewerId)

  const { data, isError } = useQuery({ ...options, enabled: isEnabled })

  return {
    file: data ?? null,
    // What names the file, for what is kept of it, as its thumbnail
    key: options.queryKey,
    hasFailed: isEnabled && ((isError && data === undefined) || data === null),
  }
}

export default useConversationAttachmentFile
