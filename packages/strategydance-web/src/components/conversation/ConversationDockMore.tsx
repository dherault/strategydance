import { MessagesSquareIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'strategydance-design-system/components/ui/DropdownMenu'
import { Pill } from 'strategydance-design-system/components/ui/Pill'

import type { ConversationDockWindow, DockConversation } from '~types'

import useConversationDock from '~hooks/conversation/useConversationDock'

import ConversationDockStatus from '~components/conversation/ConversationDockStatus'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The windows the screen has no room for, the most recently opened first
  dockWindows: ConversationDockWindow[]
  conversations: ReadonlyMap<string, DockConversation>
}

/*
  The windows of the dock the screen has no room for, behind a "+N" button whose menu lists them,
  each with what a minimized window says of it, and a dot on the button while any of them has
  replies unread or a question waiting. Picking one opens it rightmost, which sends another behind
  the button in its place
*/
function ConversationDockMore({ dockWindows, conversations }: Props) {
  const { formatMessage } = useIntl()
  const { openWindow } = useConversationDock()

  const count = dockWindows.length
  const needsAttention = dockWindows.some(({ conversationId }) => {
    const conversation = conversations.get(conversationId)

    return !!conversation && (conversation.unreadCount > 0 || conversation.isAwaitingAnswer)
  })

  return (
    <div className="pointer-events-auto relative mb-2 shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="shadow-md"
            aria-label={formatMessage(
              needsAttention ? conversationMessages.dockMoreAttentionLabel : conversationMessages.dockMoreLabel,
              { count },
            )}
          >
            {formatMessage(conversationMessages.dockMore, { count })}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          className="w-64"
        >
          {dockWindows.map(({ conversationId }) => {
            const conversation = conversations.get(conversationId)

            return (
              <DropdownMenuItem
                key={conversationId}
                onSelect={() => openWindow(conversationId)}
              >
                <MessagesSquareIcon />
                <span className="min-w-0 flex-1 truncate">
                  {conversation?.title ?? formatMessage(conversationMessages.newTitle)}
                </span>
                {conversation ? <ConversationDockStatus conversation={conversation} /> : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {needsAttention ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[3px] -right-[3px] flex rounded-full border-2 border-background"
        >
          <Pill size="sm" />
        </span>
      ) : null}
    </div>
  )
}

export default ConversationDockMore
