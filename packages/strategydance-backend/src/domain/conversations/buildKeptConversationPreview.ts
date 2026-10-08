import { type ConversationPreviewSource, buildConversationPreview } from 'strategydance-core'

// A message as the control context reads it, with what its preview is built from
type PreviewedMessage = ConversationPreviewSource & { id: string }

/*
  The preview a conversation shows once a resume or a retry deletes what it last showed: that of the
  newest message it keeps that is not an aspects note, which the read leaves out, or none when it
  keeps nothing
*/
function buildKeptConversationPreview(message: PreviewedMessage | null | undefined) {
  if (!message) return { preview: null, previewMessageId: null }

  return { preview: buildConversationPreview(message), previewMessageId: message.id }
}

export default buildKeptConversationPreview
