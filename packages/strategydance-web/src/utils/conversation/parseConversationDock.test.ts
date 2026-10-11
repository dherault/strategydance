import { describe, expect, it } from 'bun:test'

import { MAX_DOCK_WINDOWS } from '~constants'

import parseConversationDock from '~utils/conversation/parseConversationDock'

function createId(index: number) {
  return index.toString(16).padStart(32, '0')
}

const KEY = 'user:organization'

describe('parseConversationDock', () => {
  it('keeps the windows as they were', () => {
    const dock = {
      [KEY]: [
        { conversationId: createId(1), isMinimized: false, isDraft: true },
        { conversationId: createId(2), isMinimized: true, isDraft: false },
      ],
      'other:organization': [{ conversationId: createId(3), isMinimized: false, isDraft: false }],
    }

    expect(parseConversationDock(dock)).toEqual(dock)
  })

  it('reads anything but a record of windows as no windows', () => {
    expect(parseConversationDock(null)).toEqual({})
    expect(parseConversationDock('windows')).toEqual({})
    expect(parseConversationDock([{ conversationId: createId(1) }])).toEqual({})
    expect(parseConversationDock({ [KEY]: 'windows' })).toEqual({})
  })

  it('leaves out a window that is not one, and a member left with none', () => {
    expect(
      parseConversationDock({
        [KEY]: [null, 'window', { conversationId: 'not-an-id' }, { conversationId: 'A'.repeat(32) }],
      }),
    ).toEqual({})
  })

  it('reads a flag that is not true as false', () => {
    expect(parseConversationDock({ [KEY]: [{ conversationId: createId(1), isMinimized: 'yes' }] })).toEqual({
      [KEY]: [{ conversationId: createId(1), isMinimized: false, isDraft: false }],
    })
  })

  it('keeps a conversation once, where it first is', () => {
    expect(
      parseConversationDock({
        [KEY]: [
          { conversationId: createId(1), isMinimized: true },
          { conversationId: createId(2) },
          { conversationId: createId(1), isMinimized: false },
        ],
      }),
    ).toEqual({
      [KEY]: [
        { conversationId: createId(1), isMinimized: true, isDraft: false },
        { conversationId: createId(2), isMinimized: false, isDraft: false },
      ],
    })
  })

  it(`keeps the first ${MAX_DOCK_WINDOWS} windows`, () => {
    const windows = Array.from({ length: MAX_DOCK_WINDOWS + 5 }, (_, index) => ({ conversationId: createId(index) }))

    const parsed = parseConversationDock({ [KEY]: windows })[KEY]!

    expect(parsed).toHaveLength(MAX_DOCK_WINDOWS)
    expect(parsed.at(-1)?.conversationId).toBe(createId(MAX_DOCK_WINDOWS - 1))
  })
})
