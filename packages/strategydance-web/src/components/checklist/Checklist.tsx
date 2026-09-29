import { useIntl } from 'react-intl'

import useDefaultChecklistItems from '~hooks/checklist/useDefaultChecklistItems'
import useTodayOwner from '~hooks/today/useTodayOwner'

import ChecklistTable from '~components/checklist/ChecklistTable'
import PageSection from '~components/layout/PageSection'
import TodayMemberSelect from '~components/today/TodayMemberSelect'

import checklistMessages from '~data/intl/messages/checklist'

/*
  The habits a member ticks every day: the reader's own to begin with, and any teammate's through
  the picker, read only. The picker is not there on a team of one.

  The reader's own starts with the default habits the first time they open it
*/
function Checklist() {
  const { formatMessage } = useIntl()
  const { ownerId, isOwn, pickOwner } = useTodayOwner()

  useDefaultChecklistItems()

  return (
    <PageSection
      title={formatMessage(checklistMessages.title)}
      description={formatMessage(checklistMessages.description)}
      actions={(
        <TodayMemberSelect
          ownerId={ownerId}
          isOwn={isOwn}
          onOwnerChange={pickOwner}
          aria-label={formatMessage(checklistMessages.showFor)}
        />
      )}
    >
      {ownerId
        ? (
            <ChecklistTable
              key={ownerId}
              userId={ownerId}
              isOwn={isOwn}
            />
          )
        : null}
    </PageSection>
  )
}

export default Checklist
