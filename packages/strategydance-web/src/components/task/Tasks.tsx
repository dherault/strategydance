import { useIntl } from 'react-intl'

import useTodayOwner from '~hooks/today/useTodayOwner'

import PageSection from '~components/layout/PageSection'
import TaskBoard from '~components/task/TaskBoard'
import TodayMemberSelect from '~components/today/TodayMemberSelect'

import taskMessages from '~data/intl/messages/task'

/*
  A member's task lists: the reader's own to begin with, and any teammate's through the picker,
  read only. The picker is not there on a team of one
*/
function Tasks() {
  const { formatMessage } = useIntl()
  const { ownerId, isOwn, pickOwner } = useTodayOwner()

  return (
    <PageSection
      title={formatMessage(taskMessages.title)}
      description={formatMessage(taskMessages.description)}
      actions={(
        <TodayMemberSelect
          ownerId={ownerId}
          isOwn={isOwn}
          onOwnerChange={pickOwner}
          aria-label={formatMessage(taskMessages.showFor)}
        />
      )}
    >
      {ownerId
        ? (
            <TaskBoard
              key={ownerId}
              userId={ownerId}
              isOwn={isOwn}
            />
          )
        : null}
    </PageSection>
  )
}

export default Tasks
