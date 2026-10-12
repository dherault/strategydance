import type { ConversationAttachmentData } from 'strategydance-core'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { uploadApiFile } from '~data/api'

type ConversationAttachmentUpload = {
  // A draft's id as often as a saved conversation's: a file goes up before its message
  conversationId: string
  // Made by the browser, and kept for every try of the same upload, which the backend stores once
  attachmentId: string
  name: string
  contentType: string
  file: Blob
  // Told the share of the file sent so far, from 0 to 1
  onProgress: (share: number) => void
  signal: AbortSignal
}

/*
  Uploads a file the reader adds to a message, to one of their conversations in the current
  organization, or to a draft, before the message that sends it. The backend reserves its place
  among the reader's unsent files before it reads a byte, checks what Claude takes, and answers
  once it is stored. Its name travels URL-encoded in a header, so any character does
*/
function useUploadConversationAttachment() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function uploadConversationAttachment({
    conversationId,
    attachmentId,
    name,
    contentType,
    file,
    onProgress,
    signal,
  }: ConversationAttachmentUpload) {
    if (!organizationId) throw new Error('No organization is current')

    return uploadApiFile<ConversationAttachmentData>({
      method: 'PUT',
      path: `/organizations/${organizationId}/conversations/${conversationId}/attachments/${attachmentId}`,
      // Typed as the conversation takes it, whatever type the browser gave the file, without a copy
      file: file.slice(0, file.size, contentType),
      headers: { 'X-File-Name': encodeURIComponent(name) },
      onProgress,
      signal,
    })
  }
}

export default useUploadConversationAttachment
