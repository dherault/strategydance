import { describe, expect, mock, test } from 'bun:test'

import {
  ERROR_CODE_ATTACHMENT_TOO_LARGE,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_TOO_MANY_PENDING_ATTACHMENTS,
  ERROR_CODE_TOO_MANY_REQUESTS,
  ERROR_CODE_UNSUPPORTED_MEDIA_TYPE,
} from 'strategydance-core'

// The client the API module reads, which a test has no use for and must not start
mock.module('~data/firebase', () => ({ EMULATORS_REQUESTED: true, appCheck: null, authentication: {} }))

const { ApiError } = await import('~data/api')
const { default: getConversationAttachmentUploadFailure } =
  await import('~utils/conversation/getConversationAttachmentUploadFailure')

describe('getConversationAttachmentUploadFailure', () => {
  test('reads each refusal no new try gets past', () => {
    expect(getConversationAttachmentUploadFailure(new ApiError(415, ERROR_CODE_UNSUPPORTED_MEDIA_TYPE, 'No'))).toBe(
      'unsupported',
    )
    expect(getConversationAttachmentUploadFailure(new ApiError(413, ERROR_CODE_ATTACHMENT_TOO_LARGE, 'No'))).toBe(
      'tooLarge',
    )
    expect(
      getConversationAttachmentUploadFailure(new ApiError(409, ERROR_CODE_TOO_MANY_PENDING_ATTACHMENTS, 'No')),
    ).toBe('pending')
  })

  test('reads anything else as a failure the same file may get past', () => {
    expect(getConversationAttachmentUploadFailure(new ApiError(409, ERROR_CODE_CONFLICT, 'Taken'))).toBe('error')
    expect(getConversationAttachmentUploadFailure(new ApiError(429, ERROR_CODE_TOO_MANY_REQUESTS, 'Slow'))).toBe(
      'error',
    )
    expect(getConversationAttachmentUploadFailure(new TypeError('Failed to fetch'))).toBe('error')
  })
})
