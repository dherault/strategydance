import {
  ERROR_CODE_ATTACHMENT_TOO_LARGE,
  ERROR_CODE_TOO_MANY_PENDING_ATTACHMENTS,
  ERROR_CODE_UNSUPPORTED_MEDIA_TYPE,
} from 'strategydance-core'

import { ApiError } from '~data/api'

// Why the backend would never take a file, however often it is sent
export type ConversationAttachmentUploadRefusal = 'unsupported' | 'tooLarge' | 'pending'

/*
  What a failed upload of a file to a conversation tells the reader: a file the backend does not
  take, or cannot read, one past what Claude or the backend takes, or a reader with as many files
  waiting to be sent as they may. Any other failure, a lost connection included, is one the same
  file may get past when it is sent again
*/
function getConversationAttachmentUploadFailure(error: unknown): ConversationAttachmentUploadRefusal | 'error' {
  if (!(error instanceof ApiError)) return 'error'
  if (error.code === ERROR_CODE_UNSUPPORTED_MEDIA_TYPE) return 'unsupported'
  if (error.code === ERROR_CODE_ATTACHMENT_TOO_LARGE) return 'tooLarge'
  if (error.code === ERROR_CODE_TOO_MANY_PENDING_ATTACHMENTS) return 'pending'

  return 'error'
}

export default getConversationAttachmentUploadFailure
