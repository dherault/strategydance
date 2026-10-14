import { RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { IntegrationAuthentication } from 'strategydance-database/web'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Switch } from 'strategydance-design-system/components/ui/Switch'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import type { OrganizationIntegration } from '~types'

import useIntegrationRequests from '~hooks/integration/useIntegrationRequests'
import useOrganizationIntegrationTools from '~hooks/integration/useOrganizationIntegrationTools'

import getIntegrationFailureMessage from '~utils/integration/getIntegrationFailureMessage'
import readIntegrationFailure from '~utils/integration/readIntegrationFailure'

import Spinner from '~components/common/Spinner'

import integrationMessages from '~data/intl/messages/integration'

type Props = {
  integration: OrganizationIntegration
  isAdministrator: boolean
  // Whether the reader's own account is connected to the server, for one taking OAuth
  isConnected: boolean
}

/*
  A server's tools as it last listed them, each with a switch letting it run without a member
  approving each call (M29), which only administrators flip, by the hash of the definition shown:
  a tool the server changes since loses its approval. A tool the server says only reads is marked
  so, as the server's own claim, which decides nothing: MCP calls annotations untrusted, and the
  switch starts off for every tool.

  Everything a tool says is the server's, drawn as plain text, never Markdown, and no icon a server
  names is loaded. An OAuth server's tools wait for a member to connect an account, whose first
  connection lists them: until then the reader is asked to connect theirs, or, once connected, told
  they could not be listed, an administrator getting Retry, which lists them with their own account
*/
function IntegrationTools({ integration, isAdministrator, isConnected }: Props) {
  const { formatMessage } = useIntl()
  const { configRevision, tools, autoApprovedTools, isLoading, hasFailed } = useOrganizationIntegrationTools(
    integration.id,
  )
  const { setIntegrationToolApproval, retryIntegration } = useIntegrationRequests()
  const [pendingHash, setPendingHash] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  const isWaiting =
    integration.authentication === IntegrationAuthentication.OAUTH && (integration.toolCount ?? null) === null

  async function setApproval(tool: string, definitionHash: string, isAutoApproved: boolean) {
    if (configRevision === null) return

    setPendingHash(definitionHash)

    try {
      await setIntegrationToolApproval(integration.id, { definitionHash, isAutoApproved, configRevision })
      toast.success(
        formatMessage(isAutoApproved ? integrationMessages.runsWithoutApproval : integrationMessages.asksForApproval, {
          tool,
        }),
      )
    } catch (error) {
      console.error('The approval of a tool could not be changed', error)
      toast.error(formatMessage(integrationMessages.approvalError, { tool }))
    } finally {
      setPendingHash(null)
    }
  }

  async function retry() {
    setIsRetrying(true)

    try {
      await retryIntegration(integration.id)
    } catch (error) {
      console.error("A server's tools could not be listed again", error)
      toast.error(formatMessage(getIntegrationFailureMessage(readIntegrationFailure(error))))
    } finally {
      setIsRetrying(false)
    }
  }

  function renderBody() {
    if (isWaiting && !isConnected)
      return <p className="m-0 text-sm text-muted-foreground">{formatMessage(integrationMessages.toolsWaiting)}</p>
    if (isWaiting) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm text-muted-foreground">
            {formatMessage(integrationMessages.toolsWaitingConnected)}
          </p>
          {isAdministrator ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isRetrying}
              icon={isRetrying ? <Spinner tone="current" /> : <RefreshCwIcon />}
              onClick={retry}
            >
              {formatMessage(integrationMessages.retry)}
            </Button>
          ) : null}
        </div>
      )
    }
    if (isLoading) return <Spinner />
    if (hasFailed) return <p className="m-0 text-sm text-danger">{formatMessage(integrationMessages.toolsLoadError)}</p>
    if (!tools.length)
      return <p className="m-0 text-sm text-muted-foreground">{formatMessage(integrationMessages.toolsEmpty)}</p>

    return (
      <>
        {isAdministrator ? (
          <Alert variant="warning">{formatMessage(integrationMessages.toolsApprovalWarning)}</Alert>
        ) : null}
        <ul className="m-0 flex list-none flex-col divide-y divide-border rounded-xs border border-border p-0">
          {tools.map(tool => (
            <li
              key={tool.name}
              className="flex items-start gap-3 px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <code className="min-w-0 rounded-xs bg-neutral-100 px-1.5 py-0.5 font-mono text-xs break-all text-foreground">
                    {tool.name}
                  </code>
                  {tool.annotations?.readOnlyHint === true ? (
                    <Tooltip content={formatMessage(integrationMessages.readOnlyClaimHint)}>
                      <span tabIndex={0}>
                        <Badge
                          size="sm"
                          variant="neutral"
                        >
                          {formatMessage(integrationMessages.readOnlyClaim)}
                        </Badge>
                      </span>
                    </Tooltip>
                  ) : null}
                </div>
                {tool.description ? (
                  <p className="m-0 line-clamp-3 text-xs text-pretty whitespace-pre-line text-muted-foreground">
                    {tool.description}
                  </p>
                ) : null}
              </div>
              <Switch
                size="sm"
                className="mt-0.5"
                checked={autoApprovedTools.includes(tool.definitionHash)}
                disabled={!isAdministrator || pendingHash === tool.definitionHash}
                aria-label={formatMessage(integrationMessages.runWithoutApproval, { tool: tool.name })}
                onChange={event => setApproval(tool.name, tool.definitionHash, event.target.checked)}
              />
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <section
      aria-labelledby="integration-tools"
      className="flex flex-col gap-3"
    >
      <h3
        id="integration-tools"
        className="m-0 font-sans text-sm font-medium text-foreground"
      >
        {formatMessage(integrationMessages.toolsTitle)}
      </h3>
      {renderBody()}
    </section>
  )
}

export default IntegrationTools
