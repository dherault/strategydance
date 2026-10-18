import { useRef } from 'react'
import { useIntl } from 'react-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'

import type { ConversationSubagent } from '~types'

import getConversationSubagentStatus from '~utils/conversation/getConversationSubagentStatus'
import getConversationSubagentStatusText from '~utils/conversation/getConversationSubagentStatusText'

import ConversationSubagentStop from '~components/conversation/ConversationSubagentStop'
import ConversationSubagentWork from '~components/conversation/ConversationSubagentWork'
import ConversationSubagentWorkBouncer from '~components/conversation/ConversationSubagentWorkBouncer'
import ConversationSubagentWorkWait from '~components/conversation/ConversationSubagentWorkWait'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The conversation that launched it, through which it is stopped
  conversationId: string
  subagent: ConversationSubagent
  onClose: () => void
}

/*
  A subagent's work, opened from its row's View work, on the conversation's page or in a dock's
  window alike: its title, where it stands, and Stop while it is busy, over its own thread, live and
  read only, in a box of its own that scrolls, with no composer, since nothing is said to a subagent.
  Its calls' outputs and its files' images open over it
*/
function ConversationSubagentDialog({ conversationId, subagent, onClose }: Props) {
  const intl = useIntl()
  const { formatMessage } = intl
  const scrollerRef = useRef<HTMLDivElement>(null)
  const status = getConversationSubagentStatus(subagent)
  const canStop = subagent.activeRunId !== null && status !== 'stopping'

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(conversationMessages.close)}
        className="flex h-[min(800px,calc(100dvh-3rem))] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[768px]"
      >
        <div className="flex min-w-0 items-start gap-3 border-b border-border py-4 pr-14 pl-4 sm:pl-6">
          <DialogHeader className="min-w-0 flex-1 gap-1">
            <DialogTitle className="wrap-anywhere">{subagent.title}</DialogTitle>
            <DialogDescription>
              {formatMessage(conversationMessages.subagentWorkDescription, {
                status: getConversationSubagentStatusText(intl, status),
              })}
            </DialogDescription>
          </DialogHeader>
          {canStop ? (
            <ConversationSubagentStop
              conversationId={conversationId}
              subagentId={subagent.id}
              title={subagent.title}
            />
          ) : null}
        </div>
        <div
          ref={scrollerRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-2 [overflow-anchor:none] sm:px-6"
        >
          <ConversationSubagentWorkWait subagentId={subagent.id}>
            <ConversationSubagentWorkBouncer subagentId={subagent.id}>
              <ConversationSubagentWork
                subagentId={subagent.id}
                scrollerRef={scrollerRef}
              />
            </ConversationSubagentWorkBouncer>
          </ConversationSubagentWorkWait>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ConversationSubagentDialog
