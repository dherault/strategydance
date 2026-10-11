import { useNavigate } from '@tanstack/react-router'
import { Maximize2Icon, MinusIcon, XIcon } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef } from 'react'
import { useIntl } from 'react-intl'
import { Logo } from 'strategydance-design-system/components/brand/Logo'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'
import { cn } from 'strategydance-design-system/lib/utils'

import type { ConversationDockWindow as DockWindow, DockConversation } from '~types'

import useConversationDock from '~hooks/conversation/useConversationDock'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import ConversationDockStatus from '~components/conversation/ConversationDockStatus'
import ConversationDockWait from '~components/conversation/ConversationDockWait'
import ConversationDockWindowBody from '~components/conversation/ConversationDockWindowBody'
import ConversationDockWindowBouncer from '~components/conversation/ConversationDockWindowBouncer'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  dockWindow: DockWindow
  // The conversation as the dock reads it, or null for a draft, which nothing stores yet
  conversation: DockConversation | null
}

/*
  One window of the dock. Its header names the conversation and opens or minimizes it, and,
  minimized, says whether Strategy Dance works on it, how many replies are unread or that a question
  waits. Open, it holds the conversation's thread and composer, whose field takes the focus whenever
  the reader opens, expands or shows it, as it appears or, already open, at once, and whose replies
  are marked read as the page marks them. Escape
  minimizes it, and its header then takes the focus.

  Minimized, it reads nothing but what the dock reads: its thread and composer go, though what was
  written and not sent stays for when it opens again, as it does for the page "Full page" opens,
  which takes the conversation out of the dock. Closing a draft's window discards the draft, whose
  id nothing opens again
*/
function ConversationDockWindow({ dockWindow, conversation }: Props) {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const { focusRequest, setWindowMinimized, closeWindow } = useConversationDock()
  const sectionRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  const { conversationId, isMinimized, isDraft } = dockWindow
  const title = conversation?.title ?? formatMessage(conversationMessages.newTitle)
  // Which ask for this window's composer is the latest, or null when the latest was another's
  const focusRequestCount = focusRequest?.conversationId === conversationId ? focusRequest.count : null

  // A composer already there takes the focus at once. One still to appear takes it as it does
  useEffect(() => {
    if (focusRequestCount === null) return

    sectionRef.current?.querySelector('textarea')?.focus()
  }, [focusRequestCount])

  function minimize() {
    setWindowMinimized(conversationId, true)
    toggleRef.current?.focus()
  }

  function openPage() {
    navigate({
      to: '/$organizationSlug/conversations/$conversationId',
      params: { organizationSlug, conversationId },
      search: conversation ? {} : { isNew: true },
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape' || isMinimized || event.defaultPrevented) return
    // A dialog or a menu the window opened sits in a portal, whose key presses React hands up here
    // all the same: their Escape closes them, not the window
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return

    event.preventDefault()
    minimize()
  }

  return (
    <section
      ref={sectionRef}
      aria-label={title}
      className={cn(
        'pointer-events-auto flex w-[352px] flex-none flex-col overflow-hidden rounded-t-sm border border-b-0 border-border bg-background shadow-md',
        !isMinimized && 'h-[min(520px,calc(100vh-48px))]',
      )}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          'flex h-12 flex-none items-center gap-1 pr-1.5 transition-colors hover:bg-neutral-50',
          !isMinimized && 'border-b border-border',
        )}
      >
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={!isMinimized}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 self-stretch rounded-xs pr-1 pl-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary"
          onClick={() => setWindowMinimized(conversationId, !isMinimized)}
        >
          <Logo className="h-[18px] w-auto shrink-0 text-secondary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</span>
          {isMinimized && conversation ? <ConversationDockStatus conversation={conversation} /> : null}
        </button>
        <div className="flex shrink-0 gap-0.5">
          {isMinimized ? null : (
            <>
              <Tooltip content={formatMessage(conversationMessages.dockFullPage)}>
                <Button
                  variant="transparent"
                  size="sm"
                  icon={<Maximize2Icon />}
                  aria-label={formatMessage(conversationMessages.dockFullPage)}
                  onClick={openPage}
                />
              </Tooltip>
              <Tooltip content={formatMessage(conversationMessages.dockMinimize)}>
                <Button
                  variant="transparent"
                  size="sm"
                  icon={<MinusIcon />}
                  aria-label={formatMessage(conversationMessages.dockMinimize)}
                  onClick={minimize}
                />
              </Tooltip>
            </>
          )}
          <Tooltip content={formatMessage(conversationMessages.dockClose)}>
            <Button
              variant="transparent"
              size="sm"
              icon={<XIcon />}
              aria-label={formatMessage(conversationMessages.dockClose)}
              onClick={() => closeWindow(conversationId)}
            />
          </Tooltip>
        </div>
      </div>
      {isMinimized ? null : (
        <ConversationDockWait conversationId={conversationId}>
          <ConversationDockWindowBouncer
            conversationId={conversationId}
            isDraft={isDraft}
          >
            <ConversationDockWindowBody
              conversationId={conversationId}
              isAutoFocused={focusRequestCount !== null}
            />
          </ConversationDockWindowBouncer>
        </ConversationDockWait>
      )}
    </section>
  )
}

export default ConversationDockWindow
