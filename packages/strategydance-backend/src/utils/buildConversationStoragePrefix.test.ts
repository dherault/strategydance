import { describe, expect, it } from 'bun:test'

import buildConversationStoragePrefix from './buildConversationStoragePrefix'
import buildPendingAttachmentObjectName from './buildPendingAttachmentObjectName'

const HYPHENATED = '0F9C2B8E-4B1A-4D2C-9E7F-6A5B4C3D2E1F'
const CANONICAL = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

describe('buildConversationStoragePrefix', () => {
  it("writes a conversation's folder inside its organization's, every id canonical", () => {
    expect(
      buildConversationStoragePrefix({ organizationId: HYPHENATED, userId: 'u1', conversationId: HYPHENATED }),
    ).toBe(`organizations/${CANONICAL}/users/u1/conversations/${CANONICAL}/`)
  })
})

describe('buildPendingAttachmentObjectName', () => {
  it('names a pending file the same however its ids are spelled', () => {
    const name = `pending/${CANONICAL}/u1/${CANONICAL}`

    expect(
      buildPendingAttachmentObjectName({ organizationId: HYPHENATED, userId: 'u1', attachmentId: HYPHENATED }),
    ).toBe(name)
    expect(buildPendingAttachmentObjectName({ organizationId: CANONICAL, userId: 'u1', attachmentId: CANONICAL })).toBe(
      name,
    )
  })
})
