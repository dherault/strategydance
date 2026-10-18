import { type PropsWithChildren, useState } from 'react'

import type { ConversationDockWindow, ConversationDockWindows } from '~types'

import { MAX_DOCK_WINDOWS } from '~constants'

import type { ConversationDockContextType } from '~contexts/ConversationDockContext'
import ConversationDockContext from '~contexts/ConversationDockContext'

import useAuthentication from '~hooks/authentication/useAuthentication'
import usePersistedState from '~hooks/common/usePersistedState'
import useDiscardConversationDraft from '~hooks/conversation/useDiscardConversationDraft'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import parseConversationDock from '~utils/conversation/parseConversationDock'
import pushOutDockWindows from '~utils/conversation/pushOutDockWindows'

import { getConversationComposerDraftKey, readConversationComposerDraft } from '~data/conversationComposerDrafts'

const NO_WINDOWS: ConversationDockWindow[] = []

/*
  Holds the dock's windows, kept in localStorage so a reload finds them as they were, and in step
  across the tabs, so one writing its windows never writes over what another wrote, another
  organization's or account's above all.

  Every member's windows in every organization sit under one key, each set under
  `${userId}:${organizationId}`: neither is known when the provider mounts, and the key a persisted
  state reads is read once. Only the current member's in the current organization are handed out
  and changed.

  Mounted in `InnerWrap`, inside `CurrentOrganizationProvider`, whose organization it reads, and like
  every provider there it renders its children unconditionally
*/
function ConversationDockProvider({ children }: PropsWithChildren) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const [dock, setDock] = usePersistedState<ConversationDockWindows>(
    'conversationDock',
    {},
    { parser: parseConversationDock, isSyncedAcrossTabs: true },
  )
  const [focusRequest, setFocusRequest] = useState<ConversationDockContextType['focusRequest']>(null)
  const discardConversationDraft = useDiscardConversationDraft()

  const key = viewer && organization ? `${viewer.uid}:${organization.id}` : null
  const windows = (key ? dock[key] : null) ?? NO_WINDOWS

  function requestFocus(conversationId: string) {
    setFocusRequest(current => ({ conversationId, count: (current?.count ?? 0) + 1 }))
  }

  // Changes the current set, and drops it once it is empty rather than keep a key for nothing
  function changeWindows(change: (current: ConversationDockWindow[]) => ConversationDockWindow[]) {
    if (!key) return

    setDock(current => {
      const previous = current[key] ?? NO_WINDOWS
      const next = change(previous)

      if (next === previous) return current

      const changed = { ...current }

      if (next.length) changed[key] = next
      else delete changed[key]

      return changed
    })
  }

  // A draft whose first message is on its way, whose window stays whatever the dock's limit, since
  // nothing else would let the reader see that send fail
  function isHeld({ conversationId, isDraft }: ConversationDockWindow) {
    if (!isDraft) return false

    const draftKey = getConversationComposerDraftKey(viewer?.uid, organization?.id, conversationId)

    return readConversationComposerDraft(draftKey).sendingMessageId !== null
  }

  // The windows with one opened rightmost
  function withWindowOpened(current: ConversationDockWindow[], conversationId: string, isDraft: boolean) {
    const open = current.find(dockWindow => dockWindow.conversationId === conversationId)

    return [
      { conversationId, isMinimized: false, isDraft: open ? open.isDraft : isDraft },
      ...current.filter(dockWindow => dockWindow.conversationId !== conversationId),
    ]
  }

  /*
    Opens a window rightmost, letting go of the ones opened longest ago past the dock's limit, but a
    draft whose first message is on its way: a draft it lets go of is discarded as closing its window
    would, so its files hold no place among the reader's unsent files with nothing left to remove
    them from
  */
  function openWindow(conversationId: string, { isDraft = false }: { isDraft?: boolean } = {}) {
    const pushedOut = pushOutDockWindows(withWindowOpened(windows, conversationId, isDraft), MAX_DOCK_WINDOWS, isHeld)

    changeWindows(current => {
      const next = withWindowOpened(current, conversationId, isDraft)
      const out = new Set(pushOutDockWindows(next, MAX_DOCK_WINDOWS, isHeld).map(({ conversationId: id }) => id))

      return next.filter(dockWindow => !out.has(dockWindow.conversationId))
    })
    requestFocus(conversationId)

    for (const dockWindow of pushedOut) {
      if (dockWindow.isDraft) discardConversationDraft(dockWindow.conversationId)
    }
  }

  function setWindowMinimized(conversationId: string, isMinimized: boolean) {
    changeWindows(current =>
      current.map(dockWindow =>
        dockWindow.conversationId === conversationId ? { ...dockWindow, isMinimized } : dockWindow,
      ),
    )

    if (!isMinimized) requestFocus(conversationId)
  }

  function closeWindow(conversationId: string) {
    changeWindows(current =>
      current.some(dockWindow => dockWindow.conversationId === conversationId)
        ? current.filter(dockWindow => dockWindow.conversationId !== conversationId)
        : current,
    )
  }

  function settleWindows(storedIds: ReadonlySet<string>) {
    changeWindows(current => {
      const next = current.flatMap(dockWindow => {
        if (!storedIds.has(dockWindow.conversationId)) return dockWindow.isDraft ? [dockWindow] : []

        return [dockWindow.isDraft ? { ...dockWindow, isDraft: false } : dockWindow]
      })

      return next.length === current.length && next.every((dockWindow, index) => dockWindow === current[index])
        ? current
        : next
    })
  }

  const contextValue: ConversationDockContextType = {
    windows,
    focusRequest,
    openWindow,
    setWindowMinimized,
    closeWindow,
    settleWindows,
  }

  return <ConversationDockContext.Provider value={contextValue}>{children}</ConversationDockContext.Provider>
}

export default ConversationDockProvider
