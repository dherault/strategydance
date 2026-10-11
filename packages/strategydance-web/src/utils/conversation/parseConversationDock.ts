import type { ConversationDockWindow, ConversationDockWindows } from '~types'

import { MAX_DOCK_WINDOWS } from '~constants'

import isConversationId from '~utils/conversation/isConversationId'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/*
  The dock's windows as localStorage kept them, keeping only what a window can be: a conversation's
  id, once each, whether it is minimized and whether it holds a draft, and no more windows than the
  dock keeps. Anything else, an older shape or a hand edit, is left out rather than drawn
*/
function parseConversationDock(value: unknown) {
  const dock: ConversationDockWindows = {}

  if (!isRecord(value)) return dock

  for (const [key, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) continue

    const windows: ConversationDockWindow[] = []

    for (const entry of entries) {
      if (windows.length >= MAX_DOCK_WINDOWS) break
      if (!isRecord(entry)) continue

      const { conversationId, isMinimized, isDraft } = entry

      if (typeof conversationId !== 'string' || !isConversationId(conversationId)) continue
      if (windows.some(dockWindow => dockWindow.conversationId === conversationId)) continue

      windows.push({ conversationId, isMinimized: isMinimized === true, isDraft: isDraft === true })
    }

    if (windows.length) dock[key] = windows
  }

  return dock
}

export default parseConversationDock
