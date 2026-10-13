import { useIntl } from 'react-intl'
import { Table, TableBody, TableHead, TableHeader, TableRow } from 'strategydance-design-system/components/ui/Table'

import type { IntegrationConnection, OrganizationIntegration } from '~types'

import useNow from '~hooks/common/useNow'

import IntegrationRow from '~components/integration/IntegrationRow'

import integrationMessages from '~data/intl/messages/integration'

type Props = {
  integrations: OrganizationIntegration[]
  // The reader's own accounts at the servers
  connections: IntegrationConnection[]
  isAdministrator: boolean
  onOpen: (integration: OrganizationIntegration) => void
  onToggle: (integration: OrganizationIntegration, isEnabled: boolean) => void
  onConnect: (integration: OrganizationIntegration) => void
}

/*
  The organization's servers, in the order they were added. The page around it is a container, so
  the "Last used" column goes once the table, not the window, grows narrow, as the design has it,
  and the status moves under each name once it is narrower still. The last column holds a row's
  Connect, its heading for screen readers alone
*/
function IntegrationsTable({ integrations, connections, isAdministrator, onOpen, onToggle, onConnect }: Props) {
  const { formatMessage } = useIntl()
  const now = useNow()

  return (
    <div className="@container">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{formatMessage(integrationMessages.columnServer)}</TableHead>
            <TableHead className="@max-[480px]:hidden">{formatMessage(integrationMessages.columnStatus)}</TableHead>
            <TableHead>{formatMessage(integrationMessages.columnOn)}</TableHead>
            <TableHead
              align="right"
              className="@max-[760px]:hidden"
            >
              {formatMessage(integrationMessages.columnLastUsed)}
            </TableHead>
            <TableHead className="w-px">
              <span className="sr-only">{formatMessage(integrationMessages.columnActions)}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {integrations.map(integration => (
            <IntegrationRow
              key={integration.id}
              integration={integration}
              connection={connections.find(connection => connection.integrationId === integration.id) ?? null}
              now={now}
              isAdministrator={isAdministrator}
              onOpen={() => onOpen(integration)}
              onToggle={isEnabled => onToggle(integration, isEnabled)}
              onConnect={() => onConnect(integration)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default IntegrationsTable
