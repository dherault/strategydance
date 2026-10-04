import { describe, expect, it } from 'bun:test'

import createId from '~utils/common/createId'
import isConversationId from '~utils/conversation/isConversationId'

describe('isConversationId', () => {
  it('takes an id as the app makes one', () => {
    expect(isConversationId(createId())).toBe(true)
  })

  it('refuses anything else', () => {
    expect(isConversationId('not-an-id')).toBe(false)
    expect(isConversationId(crypto.randomUUID())).toBe(false)
    expect(isConversationId(createId().toUpperCase())).toBe(false)
  })
})
