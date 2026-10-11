import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'

import useConversationDock from '~hooks/conversation/useConversationDock'
import useDockConversations from '~hooks/conversation/useDockConversations'

import countShownDockWindows from '~utils/conversation/countShownDockWindows'

import ConversationDockMore from '~components/conversation/ConversationDockMore'
import ConversationDockWindow from '~components/conversation/ConversationDockWindow'

import conversationMessages from '~data/intl/messages/conversation'

/*
  The reader's docked conversations: windows pinned to the bottom right, beside the sidebar, the
  last opened rightmost, as many side by side as the screen holds, and the rest behind a "+N" button
  whose menu lists them. Below `ConversationDockBouncer`.

  A window draws once its conversation is read, or at once for a draft, which nothing stores yet.
  Each read of the windows' conversations that is theirs, rather than the one before a window was
  opened, settles them: a draft found stored is a draft no longer, and a window whose conversation
  is no longer found, deleted or out of reach, closes
*/
function ConversationDock() {
  const { formatMessage } = useIntl()
  const { windows, settleWindows } = useConversationDock()
  const { conversations, isSettled } = useDockConversations(windows.map(({ conversationId }) => conversationId))
  const dockRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  const drawn = windows.filter(({ conversationId, isDraft }) => isDraft || conversations.has(conversationId))
  const shownCount = countShownDockWindows(width, drawn.length)
  // What settling reads, the same between two reads whatever else renders
  const storedIds = [...conversations.keys()].sort().join()

  const settle = useEffectEvent(() => settleWindows(new Set(conversations.keys())))

  useEffect(() => {
    if (isSettled) settle()
  }, [isSettled, storedIds])

  // The width the windows have beside the sidebar, measured before the dock is first painted, so it
  // never draws one window for a moment
  useLayoutEffect(() => {
    const dock = dockRef.current

    if (!dock) return

    setWidth(dock.clientWidth)

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })

    observer.observe(dock)

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={dockRef}
      role="region"
      aria-label={formatMessage(conversationMessages.dockLabel)}
      // Clicks fall through the room between the windows to the page under it
      className="pointer-events-none fixed right-6 bottom-0 left-[calc(var(--sidebar-width)+1.5rem)] z-40 flex flex-row-reverse items-end gap-2"
    >
      {drawn.slice(0, shownCount).map(dockWindow => (
        <ConversationDockWindow
          key={dockWindow.conversationId}
          dockWindow={dockWindow}
          conversation={conversations.get(dockWindow.conversationId) ?? null}
        />
      ))}
      {drawn.length > shownCount ? (
        <ConversationDockMore
          dockWindows={drawn.slice(shownCount)}
          conversations={conversations}
        />
      ) : null}
    </div>
  )
}

export default ConversationDock
