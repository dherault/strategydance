import { useIntl } from 'react-intl'
import { Select } from 'strategydance-design-system/components/ui/Select'
import type { Directory } from 'strategydance-knowledge/src/directories/types'

import type { DirectoryStatusChoice } from '~types'

import useNow from '~hooks/common/useNow'
import useDirectoryStates from '~hooks/directory/useDirectoryStates'
import useSetDirectoryStatus from '~hooks/directory/useSetDirectoryStatus'

import getTimeAgo from '~utils/date/getTimeAgo'

import directoryStatusMessages from '~data/intl/directoryStatusMessages'
import directoryMessages from '~data/intl/messages/directory'

const CHOICES: DirectoryStatusChoice[] = ['TO_DO', 'SUBMITTED', 'LISTED', 'DISMISSED']

type Props = {
  directory: Pick<Directory, 'id' | 'name'>
}

/*
  Where the organization stands with a directory, in its dialog: a select of the statuses, To do
  first, and under it since when it holds one, "Submitted 3 days ago", or, while it is to do, how
  the statuses go
*/
function DirectoryStatusField({ directory }: Props) {
  const { formatMessage, formatRelativeTime, formatDate } = useIntl()
  const now = useNow()
  const { data: states } = useDirectoryStates()
  const setDirectoryStatus = useSetDirectoryStatus()

  const state = states.get(directory.id)
  const choice: DirectoryStatusChoice = state?.status ?? 'TO_DO'

  function renderHint() {
    if (!state?.status || !state.changedAt) return formatMessage(directoryMessages.statusHint)

    const status = formatMessage(directoryStatusMessages[state.status])
    const timeAgo = getTimeAgo(state.changedAt, now)

    if (timeAgo.unit === 'justNow') return formatMessage(directoryMessages.statusChangedJustNow, { status })

    if (timeAgo.unit === 'date') {
      return formatMessage(directoryMessages.statusChangedOn, {
        status,
        date: formatDate(state.changedAt, { month: 'short', day: 'numeric', year: 'numeric' }),
      })
    }

    return formatMessage(directoryMessages.statusChangedAgo, {
      status,
      time: formatRelativeTime(-timeAgo.value, timeAgo.unit, { numeric: 'auto' }),
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        label={formatMessage(directoryMessages.status)}
        value={choice}
        options={CHOICES.map(value => ({ value, label: formatMessage(directoryStatusMessages[value]) }))}
        onValueChange={value => {
          if (value !== choice) setDirectoryStatus(directory, value as DirectoryStatusChoice)
        }}
      />
      <p className="m-0 text-xs leading-normal text-muted-foreground">{renderHint()}</p>
    </div>
  )
}

export default DirectoryStatusField
