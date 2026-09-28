import { useState } from 'react'
import { useIntl } from 'react-intl'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLocalDate from '~hooks/common/useLocalDate'
import useOrganizationLogWeek from '~hooks/log/useOrganizationLogWeek'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import addDays from '~utils/date/addDays'

import PageSection from '~components/layout/PageSection'
import LogComposer from '~components/log/LogComposer'
import LogWeek from '~components/log/LogWeek'

import logMessages from '~data/intl/messages/log'

// The days of a week of the log, today among them for the newest
const WEEK_DAYS = 7

type Week = {
  from: string
  to: string
}

/*
  What each member moved forward, one entry a day, as a feed the whole team reads: the reader's
  editor for today first, then the last seven days, newest first, kept live. Each "Load previous
  week" adds the seven days ending on the newest entry before those shown, so a stretch nobody
  wrote in is skipped rather than loaded as empty weeks
*/
function Log() {
  const { formatMessage } = useIntl()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const { data: team } = useOrganizationTeam()
  const today = useLocalDate()

  // The weeks loaded before the newest, as of the day they were loaded on. The newest week moves at
  // midnight, and a day would then fall between it and the older ones, shown in neither, so a new
  // day starts over from the newest alone. The page is not remounted for it, so a draft stays
  const [loaded, setLoaded] = useState<{ today: string, weeks: Week[] }>({ today: '', weeks: [] })

  const olderWeeks = loaded.today === today ? loaded.weeks : []
  const viewerId = viewer?.uid ?? null
  const newestWeek: Week = { from: addDays(today, -(WEEK_DAYS - 1)), to: today }
  const { data: newest } = useOrganizationLogWeek({ ...newestWeek, isLive: true })
  const membersById = new Map(team.userOrganizations.map(member => [member.user.id, member]))
  const todayEntry = newest.logEntries.find(entry => entry.user.id === viewerId && entry.date === today) ?? null
  const weeks = [newestWeek, ...olderWeeks]

  function loadPrevious(olderDate: string) {
    setLoaded({ today, weeks: [...olderWeeks, { from: addDays(olderDate, -(WEEK_DAYS - 1)), to: olderDate }] })
  }

  if (!organization) return null

  return (
    <PageSection
      title={formatMessage(logMessages.title)}
      description={formatMessage(logMessages.description)}
    >
      <div className="flex flex-col gap-4">
        <LogComposer
          organizationId={organization.id}
          today={today}
          todayEntry={todayEntry}
        />
        {weeks.map((week, index) => (
          <LogWeek
            key={index === 0 ? 'newest' : week.from}
            organizationId={organization.id}
            from={week.from}
            to={week.to}
            isLive={index === 0}
            today={today}
            viewerId={viewerId}
            membersById={membersById}
            onLoadPrevious={index === weeks.length - 1 ? loadPrevious : null}
          />
        ))}
      </div>
    </PageSection>
  )
}

export default Log
