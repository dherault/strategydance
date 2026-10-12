import { describe, expect, it } from 'bun:test'

import type { ConversationDockWindow } from '~types'

import pushOutDockWindows from '~utils/conversation/pushOutDockWindows'

function dockWindows(...ids: string[]): ConversationDockWindow[] {
  return ids.map(conversationId => ({
    conversationId,
    isMinimized: false,
    isDraft: conversationId.startsWith('draft'),
  }))
}

const ids = (windows: readonly ConversationDockWindow[]) => windows.map(({ conversationId }) => conversationId)

describe('pushOutDockWindows', () => {
  it('lets go of nothing while the windows fit', () => {
    expect(pushOutDockWindows(dockWindows('c', 'b', 'a'), 3, () => false)).toEqual([])
  })

  it('lets go of the windows opened longest ago', () => {
    expect(ids(pushOutDockWindows(dockWindows('e', 'd', 'c', 'b', 'a'), 3, () => false))).toEqual(['a', 'b'])
  })

  it('passes over a window that must stay, for the next oldest', () => {
    const windows = dockWindows('d', 'c', 'b', 'draft-a')

    expect(ids(pushOutDockWindows(windows, 3, ({ conversationId }) => conversationId === 'draft-a'))).toEqual(['b'])
  })

  it('keeps one more than it may rather than let go of the newest or a window that must stay', () => {
    const windows = dockWindows('new', 'draft-b', 'draft-a')

    expect(pushOutDockWindows(windows, 2, ({ isDraft }) => isDraft)).toEqual([])
  })
})
