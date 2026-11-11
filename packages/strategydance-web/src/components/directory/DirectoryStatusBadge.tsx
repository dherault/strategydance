import { useIntl } from 'react-intl'
import type { DirectoryStatus } from 'strategydance-core'
import { Badge } from 'strategydance-design-system/components/ui/Badge'

import directoryStatusMessages from '~data/intl/directoryStatusMessages'

// Each status's look, as the design draws it: to do outlined, the others tinted
const LOOKS = {
  TO_DO: { variant: 'neutral', appearance: 'outline' },
  SUBMITTED: { variant: 'primary', appearance: 'subtle' },
  LISTED: { variant: 'success', appearance: 'subtle' },
  DISMISSED: { variant: 'neutral', appearance: 'subtle' },
} as const

type Props = {
  // Null for a directory to do
  status: DirectoryStatus | null
}

// Where the organization stands with a directory, as a row of the Directories page shows it
function DirectoryStatusBadge({ status }: Props) {
  const { formatMessage } = useIntl()
  const choice = status ?? 'TO_DO'

  return (
    <Badge
      size="sm"
      {...LOOKS[choice]}
    >
      {formatMessage(directoryStatusMessages[choice])}
    </Badge>
  )
}

export default DirectoryStatusBadge
