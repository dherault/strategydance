import { createContext } from 'react'

import type { ConversationDockWindow } from '~types'

/*
  The dock's windows: conversations open beside whatever page the reader is on, on a wide screen,
  each a window pinned to the bottom right, open or minimized to its header.

  A context because the windows outlive every page: the list and a conversation's page open them,
  the layout draws them, and a reload finds them as they were. They are the current member's in the
  current organization, so switching either shows another set
*/
export type ConversationDockContextType = {
  // The rightmost first, which is the last opened
  windows: ConversationDockWindow[]
  // The window whose composer the reader last asked for, by opening, expanding or showing it, or
  // null. Each ask counts one more, so showing a window already open asks again. Never kept across a
  // reload, so a reload steals no focus
  focusRequest: { conversationId: string; count: number } | null
  // Opens a conversation's window, or expands it, and moves it rightmost. A window opened past the
  // most the dock keeps lets go of the one opened longest ago. `isDraft` only says what a new window
  // holds: one already open keeps what it says
  openWindow: (conversationId: string, options?: { isDraft?: boolean }) => void
  setWindowMinimized: (conversationId: string, isMinimized: boolean) => void
  // Closing a draft's window discards the draft, which nothing else keeps
  closeWindow: (conversationId: string) => void
  // Brings the windows in line with the conversations stored: a draft found stored no longer is one,
  // and a conversation no longer found, deleted or out of reach, loses its window
  settleWindows: (storedIds: ReadonlySet<string>) => void
}

export default createContext<ConversationDockContextType>({
  windows: [],
  focusRequest: null,
  openWindow: () => {},
  setWindowMinimized: () => {},
  closeWindow: () => {},
  settleWindows: () => {},
})
