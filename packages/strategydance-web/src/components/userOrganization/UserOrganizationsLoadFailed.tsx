import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import LogOutButton from '~components/authentication/LogOutButton'
import Spinner from '~components/common/Spinner'

import globalMessages from '~data/intl/messages/global'

type Props = {
  isRetrying: boolean
  onRetry: () => void
}

/*
  What the app and the onboarding show when the reader's memberships could not be read: a way to
  try again, rather than a verdict on an empty list. Whole screen, since the sidebar needs the
  list too, so it carries its own way to log out
*/
function UserOrganizationsLoadFailed({ isRetrying, onRetry }: Props) {
  const { formatMessage } = useIntl()

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-4 px-4">
      <LogOutButton className="absolute top-4 right-4" />
      <Alert
        variant="danger"
        className="max-w-xl"
      >
        {formatMessage(globalMessages.organizationsLoadError)}
      </Alert>
      <Button
        variant="outline"
        disabled={isRetrying}
        icon={isRetrying ? <Spinner tone="current" /> : undefined}
        onClick={onRetry}
      >
        {formatMessage(globalMessages.retry)}
      </Button>
    </main>
  )
}

export default UserOrganizationsLoadFailed
