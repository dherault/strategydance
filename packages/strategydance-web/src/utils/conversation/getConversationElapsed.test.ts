import { describe, expect, it } from 'bun:test'

import getConversationElapsed from '~utils/conversation/getConversationElapsed'

describe('getConversationElapsed', () => {
  it('counts seconds, then minutes and seconds', () => {
    expect(getConversationElapsed(12_400)).toEqual({ minutes: 0, seconds: 12 })
    expect(getConversationElapsed(65_000)).toEqual({ minutes: 1, seconds: 5 })
    expect(getConversationElapsed(59 * 60_000 + 59_999)).toEqual({ minutes: 59, seconds: 59 })
  })

  it('shows nothing from an hour on', () => {
    expect(getConversationElapsed(60 * 60_000)).toBeNull()
  })

  it('counts from zero when the clock is behind the server', () => {
    expect(getConversationElapsed(-3000)).toEqual({ minutes: 0, seconds: 0 })
  })
})
