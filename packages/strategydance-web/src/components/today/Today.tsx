import { useIntl } from 'react-intl'

import useLocalDate from '~hooks/common/useLocalDate'

import toCalendarDate from '~utils/date/toCalendarDate'

import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'

import navigationMessages from '~data/intl/messages/navigation'

/*
  The page a member opens their day on, under the date: the team's top priorities, their own
  tasks, the checklist they keep every day, and the log the team writes
*/
function Today() {
  const { formatMessage, formatDate } = useIntl()
  const today = useLocalDate()

  return (
    <ContainerLayout className="gap-8">
      <PageHeader
        eyebrow={formatDate(toCalendarDate(today), { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
        title={formatMessage(navigationMessages.today)}
      />
    </ContainerLayout>
  )
}

export default Today
