import { PlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'

import PageHeader from '~components/layout/PageHeader'

import integrationMessages from '~data/intl/messages/integration'
import navigationMessages from '~data/intl/messages/navigation'

type Props = {
  // How many servers are on and working, and how many there are, or null when they could not be read
  counts: { available: number; total: number } | null
  isAdministrator: boolean
  onAdd: () => void
}

/*
  The page's title, what the servers are for, how many work right now, and, for a member who does
  not administer the organization, that only administrators change them, as designed. Administrators
  get the button that adds a server by its address
*/
function IntegrationsHeader({ counts, isAdministrator, onAdd }: Props) {
  const { formatMessage } = useIntl()

  const lead = [
    formatMessage(integrationMessages.lead),
    counts?.total ? formatMessage(integrationMessages.leadAvailable, counts) : null,
    isAdministrator ? null : formatMessage(integrationMessages.leadMembers),
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <PageHeader
      title={formatMessage(navigationMessages.integrations)}
      lead={lead}
      actions={
        isAdministrator ? (
          <Button
            icon={<PlusIcon />}
            onClick={onAdd}
          >
            {formatMessage(integrationMessages.addServer)}
          </Button>
        ) : null
      }
    />
  )
}

export default IntegrationsHeader
