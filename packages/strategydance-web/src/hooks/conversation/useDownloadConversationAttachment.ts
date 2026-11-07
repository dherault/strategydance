import { useQueryClient } from '@tanstack/react-query'

import type { ConversationMessageAttachment } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import saveFile from '~utils/common/saveFile'
import getConversationAttachmentQueryOptions from '~utils/conversation/getConversationAttachmentQueryOptions'

/*
  Downloads a file a message sent under its name, its bytes read as the thread reads an image's,
  and kept the same way, so a second download reads nothing. Answers false when the backend says
  the file is gone or not the reader's, and throws when it could not be read
*/
function useDownloadConversationAttachment() {
  const queryClient = useQueryClient()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null

  async function download(conversationId: string, attachment: Pick<ConversationMessageAttachment, 'id' | 'name'>) {
    if (!organizationId || !viewerId) throw new Error('No reader to download a conversation file as')

    const file = await queryClient.fetchQuery(
      getConversationAttachmentQueryOptions(organizationId, conversationId, attachment.id, viewerId),
    )

    if (!file) return false

    saveFile(file, attachment.name)

    return true
  }

  return download
}

export default useDownloadConversationAttachment
