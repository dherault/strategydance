import { MAX_CONVERSATION_ATTACHMENT_SIZE, MAX_CONVERSATION_IMAGE_SIZE } from 'strategydance-core'

import { isShrunkConversationImage } from '~utils/conversation/shrinkConversationImage'

/*
  Why a file the reader adds cannot go up, before anything is sent, or null when it can: a type a
  conversation does not take, an empty file, a GIF past what Claude takes of an image, and any
  other file past what a conversation takes. A JPEG, a PNG or a WebP goes whatever its size, since
  the browser shrinks it first, and the backend checks what it then is
*/
function getConversationAttachmentRefusal({ size }: { size: number }, contentType: string | null) {
  if (!contentType) return 'unsupported'
  if (!size) return 'empty'
  if (isShrunkConversationImage(contentType)) return null
  if (contentType.startsWith('image/')) return size > MAX_CONVERSATION_IMAGE_SIZE ? 'imageTooLarge' : null

  return size > MAX_CONVERSATION_ATTACHMENT_SIZE ? 'tooLarge' : null
}

export default getConversationAttachmentRefusal
