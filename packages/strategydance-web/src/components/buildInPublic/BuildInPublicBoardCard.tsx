import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, CardValues, Task } from '~types'

import { TASK_STATUSES } from '~constants'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useLocalDate from '~hooks/common/useLocalDate'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import toCalendarDate from '~utils/date/toCalendarDate'

import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import BuildInPublicLogo from '~components/buildInPublic/BuildInPublicLogo'
import { CARD_EYEBROW_CLASS_NAME, CARD_MUTED_CLASS_NAME } from '~components/buildInPublic/cardClassNames'
import FitText from '~components/buildInPublic/FitText'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'
import taskStatusMessages from '~data/intl/taskStatusMessages'

// The most tasks a column shows: all of them up to this many, else one fewer and how many more
const MAX_SHOWN = 3

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
  // Everybody's, or one assignee's
  tasks: readonly Task[]
  // Whose they are, when they are one assignee's who can be named
  name: string | null
  fields: CardField[]
  values: CardValues
}

// The board as it is today, its four columns side by side, each with how many tasks it holds and
// the first of them
function BuildInPublicBoardCard({ settings, tasks, name, fields, values }: Props) {
  const { formatMessage, formatDate } = useIntl()
  const { organization } = useCurrentOrganization()
  const today = useLocalDate()

  const organizationName = organization?.name ?? ''

  return (
    <BuildInPublicCard
      cardKey="board-snapshot"
      label={formatMessage(buildInPublicMessages.boardCard)}
      format="landscape"
      tone="white"
      settings={settings}
      fields={fields}
      values={values}
    >
      <div className="flex items-center gap-2.5">
        <BuildInPublicLogo
          name={organizationName}
          logoUrl={organization?.logoUrl ?? null}
          size={28}
        />
        <FitText
          max={14}
          min={11}
          className="flex-1 font-semibold"
        >
          {name
            ? formatMessage(buildInPublicMessages.organizationAndMember, { organization: organizationName, name })
            : organizationName}
        </FitText>
        <p className={CARD_EYEBROW_CLASS_NAME}>
          {formatMessage(buildInPublicMessages.boardOn, {
            date: formatDate(toCalendarDate(today), { month: 'short', day: 'numeric', timeZone: 'UTC' }),
          })}
        </p>
      </div>
      <div className="mt-5 grid min-h-0 flex-1 grid-cols-4 gap-2">
        {TASK_STATUSES.map(status => {
          const column = tasks.filter(task => task.status === status)
          const shown = column.length > MAX_SHOWN ? column.slice(0, MAX_SHOWN - 1) : column

          return (
            <div
              key={status}
              className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-hidden rounded-[2px] bg-(--card-panel) p-2"
            >
              <div className="flex items-center justify-between gap-1 px-0.5 pt-0.5 pb-1 text-xs font-semibold">
                <span className="truncate">{formatMessage(taskStatusMessages[status])}</span>
                <span className={cn(CARD_MUTED_CLASS_NAME, 'tabular-nums')}>{column.length}</span>
              </div>
              {shown.map(task => (
                <div
                  key={task.id}
                  className="flex-none rounded-[2px] bg-white px-2 py-[7px] text-[11.5px]/[1.35] font-medium text-secondary-900"
                >
                  <span className="line-clamp-2 wrap-break-word">{task.name}</span>
                </div>
              ))}
              {column.length > shown.length ? (
                <div className={cn(CARD_MUTED_CLASS_NAME, 'px-0.5 text-[11px] font-medium')}>
                  {formatMessage(buildInPublicMessages.moreTasks, { count: column.length - shown.length })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </BuildInPublicCard>
  )
}

export default BuildInPublicBoardCard
