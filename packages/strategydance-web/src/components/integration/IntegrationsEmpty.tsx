import { PlugIcon, PlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import integrationMessages from '~data/intl/messages/integration'

type Props = {
  // Null unless the reader administers the organization, which is who may add a server
  onAdd: (() => void) | null
}

// What the page shows in place of the table while the organization has added no server
function IntegrationsEmpty({ onAdd }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <PlugIcon />
        </EmptyMedia>
        <EmptyTitle>{formatMessage(integrationMessages.emptyTitle)}</EmptyTitle>
        <EmptyDescription>{formatMessage(integrationMessages.emptyText)}</EmptyDescription>
      </EmptyHeader>
      {onAdd ? (
        <EmptyContent>
          <Button
            icon={<PlusIcon />}
            onClick={onAdd}
          >
            {formatMessage(integrationMessages.addServer)}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

export default IntegrationsEmpty
