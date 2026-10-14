import { Link } from '@tanstack/react-router'
import { UnplugIcon } from 'lucide-react'
import { type MessageDescriptor, useIntl } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'
import { cn } from 'strategydance-design-system/lib/utils'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import toHyphenatedUuid from '~utils/common/toHyphenatedUuid'
import type { ConversationIntegrationIssue as Issue } from '~utils/conversation/getConversationIntegrationIssue'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  issue: Issue
  integrationId: string | null
  integrationName: string
  isAdministrator: boolean
}

/*
  The strip under a call to a server that does not work for the reader now, as designed: what is
  wrong, and what fixes it, on the Integrations page. An administrator adds a server gone again or
  turns one on; every member connects their own account where the server takes one; anybody else is
  told to ask an administrator. Ids go into the address hyphenated, which the router reads as text
*/
function ConversationIntegrationIssue({ issue, integrationId, integrationName, isAdministrator }: Props) {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()
  const server = { server: integrationName }

  function renderFix() {
    if (issue === 'notConnected' && integrationId) {
      return renderLink(conversationMessages.integrationConnect, { connect: toHyphenatedUuid(integrationId) })
    }

    if (!isAdministrator) return null
    if (issue === 'off' && integrationId) {
      return renderLink(conversationMessages.integrationTurnOn, { enable: toHyphenatedUuid(integrationId) })
    }

    if (issue === 'missing') return renderLink(conversationMessages.integrationAdd, { add: integrationName })

    return null
  }

  function renderLink(label: MessageDescriptor, search: Record<string, string>) {
    return (
      <Link
        to="/$organizationSlug/integrations"
        params={{ organizationSlug }}
        search={search}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'relative flex-none bg-white')}
      >
        {formatMessage(label)}
      </Link>
    )
  }

  function getText() {
    switch (issue) {
      case 'notConnected':
        return formatMessage(conversationMessages.integrationNotConnected, server)
      case 'off':
        return formatMessage(
          isAdministrator ? conversationMessages.integrationOff : conversationMessages.integrationOffAskAdministrator,
          server,
        )
      case 'missing':
        return formatMessage(
          isAdministrator
            ? conversationMessages.integrationMissing
            : conversationMessages.integrationMissingAskAdministrator,
          server,
        )
    }
  }

  return (
    <div className="flex min-h-11 items-center gap-2 border-t border-border bg-warning-bg py-1.5 pr-1.5 pl-3 text-xs leading-[1.4] text-foreground">
      <UnplugIcon
        aria-hidden="true"
        className="size-3.5 flex-none text-warning"
      />
      <span className="min-w-0 flex-1">{getText()}</span>
      {renderFix()}
    </div>
  )
}

export default ConversationIntegrationIssue
