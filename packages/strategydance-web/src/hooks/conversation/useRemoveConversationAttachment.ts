import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

/*
  Removes a file the reader uploaded to a message and has not sent, so its place among their unsent
  files frees at once rather than when it expires. Removing one twice, or one still going up, is
  the same, and a sent file is refused, since only its conversation's deletion removes it
*/
function useRemoveConversationAttachment() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function removeConversationAttachment({
    conversationId,
    attachmentId,
  }: {
    conversationId: string
    attachmentId: string
  }) {
    if (!organizationId) throw new Error('No organization is current')

    await requestApi({
      method: 'DELETE',
      path: `/organizations/${organizationId}/conversations/${conversationId}/attachments/${attachmentId}`,
    })
  }
}

export default useRemoveConversationAttachment
