import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import useDirectories from '~hooks/directory/useDirectories'
import useDirectoryStates from '~hooks/directory/useDirectoryStates'

import Spinner from '~components/common/Spinner'

import directoryMessages from '~data/intl/messages/directory'

/*
  What the Directories page and the Marketing section show in place of the directories when either
  read failed, the release's list or what the organization keeps of it: a way to try both again,
  rather than a list where every directory reads as to do
*/
function DirectoriesLoadFailed() {
  const { formatMessage } = useIntl()
  const directories = useDirectories()
  const states = useDirectoryStates()

  const isRetrying = directories.loading || states.loading

  function retry() {
    if (directories.hasFailed) directories.refetch()
    if (states.hasFailed) states.refetch()
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert
        variant="danger"
        className="max-w-xl"
      >
        {formatMessage(directoryMessages.loadError)}
      </Alert>
      <Button
        variant="outline"
        disabled={isRetrying}
        icon={isRetrying ? <Spinner tone="current" /> : undefined}
        onClick={retry}
      >
        {formatMessage(directoryMessages.retry)}
      </Button>
    </div>
  )
}

export default DirectoriesLoadFailed
