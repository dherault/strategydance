import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import navigationMessages from '~data/intl/messages/navigation'

type Props = {
  // The page's name, as the sidebar shows it
  page: string
}

// What a page that is not built yet shows
function ComingSoon({ page }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div className="p-6">
      <Alert
        variant="info"
        title={formatMessage(navigationMessages.comingSoon)}
        className="max-w-xl"
      >
        {formatMessage(navigationMessages.comingSoonDescription, { page })}
      </Alert>
    </div>
  )
}

export default ComingSoon
