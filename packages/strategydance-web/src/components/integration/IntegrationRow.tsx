import type { MouseEvent } from 'react'
import { useIntl } from 'react-intl'
import { Switch } from 'strategydance-design-system/components/ui/Switch'
import { TableCell, TableRow } from 'strategydance-design-system/components/ui/Table'
import { cn } from 'strategydance-design-system/lib/utils'

import type { OrganizationIntegration } from '~types'

import getIntegrationAuthenticationMessage from '~utils/integration/getIntegrationAuthenticationMessage'
import getIntegrationHost from '~utils/integration/getIntegrationHost'
import getIntegrationStatus from '~utils/integration/getIntegrationStatus'

import IntegrationLastUsed from '~components/integration/IntegrationLastUsed'
import IntegrationMark from '~components/integration/IntegrationMark'
import IntegrationStatusBadge from '~components/integration/IntegrationStatusBadge'

import integrationMessages from '~data/intl/messages/integration'

type Props = {
  integration: OrganizationIntegration
  now: number
  isAdministrator: boolean
  onOpen: () => void
  onToggle: (isEnabled: boolean) => void
}

/*
  One server of the organization: its mark, its name, its host and how it lets Strategy Dance in,
  where it stands, under its name on a narrow table, the switch that turns it on or off, which only
  administrators flip, and when it was last used, a column a narrow table leaves out. A click anywhere but on the switch opens its
  dialog, as the design has it; the name is the button the keyboard reaches
*/
function IntegrationRow({ integration, now, isAdministrator, onOpen, onToggle }: Props) {
  const { formatMessage } = useIntl()

  const status = getIntegrationStatus(integration)

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    if (event.target instanceof Element && event.target.closest('button, a, input, label')) return

    onOpen()
  }

  return (
    <TableRow
      onClick={handleClick}
      className="cursor-pointer"
    >
      <TableCell className="w-full max-w-0">
        <div className="flex min-w-0 items-center gap-3">
          {/* A server turned off is drawn faded, its switch and status saying why */}
          <IntegrationMark
            name={integration.name}
            catalogueSlug={integration.catalogueSlug ?? null}
            className={cn(!integration.isEnabled && 'opacity-55')}
          />
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpen}
              className={cn(
                'block max-w-full cursor-pointer truncate rounded-xs border-0 bg-transparent p-0 text-left font-medium text-secondary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary',
                !integration.isEnabled && 'opacity-55',
              )}
            >
              {integration.name}
            </button>
            <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
              {getIntegrationHost(integration.url)} ·{' '}
              {formatMessage(getIntegrationAuthenticationMessage(integration.authentication))}
            </p>
            {/* A narrow table has no room for the status beside the name, so it goes under it */}
            <div className="mt-1.5 @min-[481px]:hidden">
              <IntegrationStatusBadge status={status} />
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="@max-[480px]:hidden">
        <IntegrationStatusBadge status={status} />
      </TableCell>
      <TableCell>
        <Switch
          size="sm"
          checked={integration.isEnabled}
          disabled={!isAdministrator}
          aria-label={formatMessage(integration.isEnabled ? integrationMessages.turnOff : integrationMessages.turnOn, {
            name: integration.name,
          })}
          onChange={event => onToggle(event.target.checked)}
        />
      </TableCell>
      <TableCell
        align="right"
        className="whitespace-nowrap text-muted-foreground @max-[760px]:hidden"
      >
        <IntegrationLastUsed
          lastUsedAt={integration.lastUsedAt ?? null}
          now={now}
        />
      </TableCell>
    </TableRow>
  )
}

export default IntegrationRow
