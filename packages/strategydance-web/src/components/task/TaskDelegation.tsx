import { BotIcon, CheckIcon } from 'lucide-react'
import { type MouseEvent, useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Dialog, DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Task } from '~types'

import useAgentConnections from '~hooks/agentConnection/useAgentConnections'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import toHyphenatedUuid from '~utils/common/toHyphenatedUuid'

import ModuleAgentsDialog from '~components/module/ModuleAgentsDialog'

import taskMessages from '~data/intl/messages/task'

// How long the button says it copied, in green, before it offers to copy again
const COPIED_DURATION_MS = 3000

type Props = {
  task: Pick<Task, 'id' | 'name'>
}

/*
  A task's dialog's Delegate section: a button that copies a prompt asking an agent of the member's
  own to take the task up, by its id and its name, through the Tasks module. While the member has
  connected no agent to the module in this organization, used yet or not, it opens the dialog telling
  how to connect one instead, as the board's agents button does, since the prompt would reach an
  agent that cannot read the board. A list that could not be read says nothing either way, so the
  prompt is copied then.

  The button waits while the list is first read. A write the browser
  refuses leaves the button as it was, as the design system's `CopyButton` does.

  The button is the agents dialog's trigger, which a copy cancels, so the dialog gives the focus back
  to it once it closes
*/
function TaskDelegation({ task }: Props) {
  const { formatMessage } = useIntl()
  const { organization } = useCurrentOrganization()
  const { data: connections, initialLoading, hasFailed } = useAgentConnections()
  const [isCopied, setIsCopied] = useState(false)
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(resetTimeoutRef.current), [])

  const hasConnection =
    hasFailed
    || connections.some(
      connection => connection.module === 'tasks' && connection.membership.organization.id === organization?.id,
    )

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!hasConnection) return

    event.preventDefault()
    copyPrompt()
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(
        formatMessage(taskMessages.delegatePrompt, { id: toHyphenatedUuid(task.id), name: task.name }),
      )
    } catch {
      return
    }

    clearTimeout(resetTimeoutRef.current)
    setIsCopied(true)
    resetTimeoutRef.current = setTimeout(() => setIsCopied(false), COPIED_DURATION_MS)
  }

  const copiedLabel = formatMessage(taskMessages.delegatePromptCopied)

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="m-0 font-sans text-sm leading-normal font-medium text-foreground">
        {formatMessage(taskMessages.delegate)}
      </h3>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            icon={isCopied ? <CheckIcon /> : <BotIcon />}
            disabled={initialLoading}
            // A button that copies opens nothing
            aria-haspopup={hasConnection ? undefined : 'dialog'}
            className={cn(
              'self-start',
              // Green-700 rather than the success token's 600, which white text falls short of 4.5:1 on
              isCopied
                && 'border-green-700 bg-green-700 text-white not-disabled:hover:border-green-700 not-disabled:hover:bg-green-700 not-disabled:active:bg-green-700',
            )}
            onClick={handleClick}
          >
            {isCopied ? copiedLabel : formatMessage(taskMessages.delegateToAgents)}
          </Button>
        </DialogTrigger>
        <ModuleAgentsDialog module="tasks" />
      </Dialog>
      <span
        role="status"
        className="sr-only"
      >
        {isCopied ? copiedLabel : null}
      </span>
    </section>
  )
}

export default TaskDelegation
