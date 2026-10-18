import { describe, expect, mock, test } from 'bun:test'

import {
  ERROR_CODE_ATTACHMENT_TOO_LARGE,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_CONVERSATIONS_SUSPENDED,
  ERROR_CODE_EMAIL_NOT_VERIFIED,
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

  // The same file goes up once the reader confirms their address, or the suspension is lifted
  test('reads an address not confirmed and conversations suspended apart from the refusals of a file', () => {
    expect(getConversationAttachmentUploadFailure(new ApiError(403, ERROR_CODE_EMAIL_NOT_VERIFIED, 'No'))).toBe(
      'unverified',
    )
    expect(getConversationAttachmentUploadFailure(new ApiError(403, ERROR_CODE_CONVERSATIONS_SUSPENDED, 'No'))).toBe(
      'suspended',
    )
  })

  test('reads anything else as a failure the same file may get past', () => {
    expect(getConversationAttachmentUploadFailure(new ApiError(409, ERROR_CODE_CONFLICT, 'Taken'))).toBe('error')
    expect(getConversationAttachmentUploadFailure(new ApiError(429, ERROR_CODE_TOO_MANY_REQUESTS, 'Slow'))).toBe(
      'error',
    )
    expect(getConversationAttachmentUploadFailure(new TypeError('Failed to fetch'))).toBe('error')
  })
})
