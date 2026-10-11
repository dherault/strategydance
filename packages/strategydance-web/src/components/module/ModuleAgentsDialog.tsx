import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import type { ModuleName } from 'strategydance-core'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'
import { CopyButton } from 'strategydance-design-system/components/ui/CopyButton'
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { cn } from 'strategydance-design-system/lib/utils'

import getModuleAddress from '~utils/module/getModuleAddress'
import getModuleMessages from '~utils/module/getModuleMessages'

import moduleMessages from '~data/intl/messages/module'

type Props = {
  module: ModuleName
}

type SnippetProps = {
  value: string
  copyLabel: string
  copiedLabel: string
}

type StepsProps = {
  title: string
  children: ReactNode
}

// A piece of code the member pastes into their agent, wrapped rather than scrolled, so no line hides
// past the edge of a phone, with a button that copies it as it is
function ModuleAgentsSnippet({ value, copyLabel, copiedLabel }: SnippetProps) {
  return (
    <div className="flex min-w-0 items-start gap-1 rounded-xs border border-border bg-neutral-50 py-1 pr-1 pl-3">
      <pre className="m-0 min-w-0 flex-1 py-1.5 font-mono text-xs leading-[1.6] whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
        {value}
      </pre>
      <CopyButton
        value={value}
        label={copyLabel}
        copiedLabel={copiedLabel}
      />
    </div>
  )
}

// How to connect the module in one agent
function ModuleAgentsSteps({ title, children }: StepsProps) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="m-0 font-sans text-sm font-medium text-foreground">{title}</h3>
      {children}
    </section>
  )
}

/*
  How a member connects an agent of their own to a module: its address, and where it goes in the
  agents members use most, Claude, ChatGPT, Claude Code and Cursor. Each asks the member to sign in
  and allow it on the consent page, so nothing here grants anything. The address is the backend's
  this page talks to, the local one against the emulators. The content of the `Dialog` its button
  opens, which mounts it only while open
*/
function ModuleAgentsDialog({ module }: Props) {
  const { formatMessage } = useIntl()
  const name = formatMessage(getModuleMessages(module).name)
  const address = getModuleAddress(module)
  const serverName = `strategydance-${module}`
  const copy = {
    copyLabel: formatMessage(moduleMessages.agentsCopySetup),
    copiedLabel: formatMessage(moduleMessages.agentsCopied),
  }

  return (
    <DialogContent
      closeLabel={formatMessage(moduleMessages.agentsClose)}
      className="max-h-[calc(100dvh-3rem)] min-w-0 overflow-y-auto sm:max-w-[560px]"
    >
      <DialogHeader>
        <DialogTitle>{formatMessage(moduleMessages.agentsTitle, { module: name })}</DialogTitle>
        <DialogDescription>{formatMessage(moduleMessages.agentsDescription)}</DialogDescription>
      </DialogHeader>
      <div className="flex min-w-0 flex-col gap-5">
        <ModuleAgentsSteps title={formatMessage(moduleMessages.agentsAddress)}>
          <ModuleAgentsSnippet
            value={address}
            copyLabel={formatMessage(moduleMessages.agentsCopyAddress)}
            copiedLabel={copy.copiedLabel}
          />
        </ModuleAgentsSteps>
        <ModuleAgentsSteps title={formatMessage(moduleMessages.agentsClaude)}>
          <p className="m-0 text-sm text-muted-foreground">{formatMessage(moduleMessages.agentsClaudeSteps)}</p>
        </ModuleAgentsSteps>
        <ModuleAgentsSteps title={formatMessage(moduleMessages.agentsChatGpt)}>
          <p className="m-0 text-sm text-muted-foreground">{formatMessage(moduleMessages.agentsChatGptSteps)}</p>
        </ModuleAgentsSteps>
        <ModuleAgentsSteps title={formatMessage(moduleMessages.agentsClaudeCode)}>
          <p className="m-0 text-sm text-muted-foreground">{formatMessage(moduleMessages.agentsClaudeCodeSteps)}</p>
          <ModuleAgentsSnippet
            value={`claude mcp add --transport http ${serverName} ${address}`}
            {...copy}
          />
        </ModuleAgentsSteps>
        <ModuleAgentsSteps title={formatMessage(moduleMessages.agentsCursor)}>
          <p className="m-0 text-sm text-muted-foreground">{formatMessage(moduleMessages.agentsCursorSteps)}</p>
          <ModuleAgentsSnippet
            value={JSON.stringify({ mcpServers: { [serverName]: { url: address } } }, null, 2)}
            {...copy}
          />
        </ModuleAgentsSteps>
      </div>
      <DialogFooter className="-mx-6 -mb-6 flex-col items-stretch gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-sm text-muted-foreground">{formatMessage(moduleMessages.agentsManage)}</p>
        <Link
          to="/account/connected-agents"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {formatMessage(moduleMessages.agentsOpenConnectedAgents)}
        </Link>
      </DialogFooter>
    </DialogContent>
  )
}

export default ModuleAgentsDialog
