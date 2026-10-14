import { useIntl } from 'react-intl'
import { TaskStatus } from 'strategydance-database/web'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, CardValues, Task } from '~types'

import { TASK_STATUSES } from '~constants'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'

import getBoardStats from '~utils/buildInPublic/getBoardStats'

import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import { CARD_DISPLAY_CLASS_NAME, CARD_EYEBROW_CLASS_NAME } from '~components/buildInPublic/cardClassNames'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'
import taskStatusMessages from '~data/intl/taskStatusMessages'

// The columns from done back to the backlog, each fainter, as the bar lays them
const SEGMENTS = [...TASK_STATUSES].reverse()

const SEGMENT_OPACITIES: Record<TaskStatus, number> = {
  [TaskStatus.DONE]: 1,
  [TaskStatus.ONGOING]: 0.6,
  [TaskStatus.TODO]: 0.35,
  [TaskStatus.BACKLOG]: 0.18,
}

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
  // Everybody's, or one assignee's
  tasks: readonly Task[]
  // Whose they are, when they are one assignee's who can be named
  name: string | null
  fields: CardField[]
  values: CardValues
}

// How much of the board is done, large, over a bar of its columns, done first, and each column's
// count
function BuildInPublicBoardProgressCard({ settings, tasks, name, fields, values }: Props) {
  const { formatMessage, formatNumber } = useIntl()

  const { statusCounts } = getBoardStats(tasks)
  const doneRatio = tasks.length ? statusCounts[TaskStatus.DONE] / tasks.length : 0

  return (
    <BuildInPublicCard
      cardKey="board-progress"
      label={formatMessage(buildInPublicMessages.progressCard)}
      format="square"
      tone="accent"
      settings={settings}
      fields={fields}
      values={values}
    >
      <p className={cn(CARD_EYEBROW_CLASS_NAME, 'truncate')}>
        {name
          ? formatMessage(buildInPublicMessages.boardProgressOf, { name })
          : formatMessage(buildInPublicMessages.boardProgress)}
      </p>
      <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto text-[104px] leading-[0.85] whitespace-nowrap')}>
        {formatNumber(doneRatio, { style: 'percent' })}
      </p>
      <p className="mt-3 mb-0 text-[15px] font-medium">
        {formatMessage(buildInPublicMessages.tasksDoneOf, { count: tasks.length })}
      </p>
      <div className="mt-5 flex h-2.5 gap-0.5">
        {SEGMENTS.filter(status => statusCounts[status] > 0).map(status => (
          <span
            key={status}
            className="rounded-[2px] bg-current"
            style={{ flex: statusCounts[status], opacity: SEGMENT_OPACITIES[status] }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1">
        {SEGMENTS.map(status => (
          <div
            key={status}
            className="flex min-w-0 flex-col gap-0.5"
          >
            <span className={cn(CARD_DISPLAY_CLASS_NAME, 'text-xl leading-none')}>{statusCounts[status]}</span>
            <span className="truncate text-[11px] font-medium">{formatMessage(taskStatusMessages[status])}</span>
          </div>
        ))}
      </div>
    </BuildInPublicCard>
  )
}

export default BuildInPublicBoardProgressCard
