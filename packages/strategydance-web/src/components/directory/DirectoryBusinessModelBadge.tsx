import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import type { DirectoryBusinessModel } from 'strategydance-knowledge/src/directories/enums'

import directoryBusinessModelMessages from '~data/intl/directoryBusinessModelMessages'

type Props = {
  businessModel: DirectoryBusinessModel
}

// What a directory charges, free in green, paid in amber and every catch between in grey
function DirectoryBusinessModelBadge({ businessModel }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Badge
      size="sm"
      variant={businessModel === 'FREE' ? 'success' : businessModel === 'PAID' ? 'warning' : 'neutral'}
    >
      {formatMessage(directoryBusinessModelMessages[businessModel])}
    </Badge>
  )
}

export default DirectoryBusinessModelBadge
