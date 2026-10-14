import { useIntl } from 'react-intl'
import { TaskStatus } from 'strategydance-database/web'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, CardValues, OrganizationMember, Task } from '~types'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useFormatTaskDueDate from '~hooks/task/useFormatTaskDueDate'

import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import BuildInPublicTaskAspects from '~components/buildInPublic/BuildInPublicTaskAspects'
import BuildInPublicTaskOwner from '~components/buildInPublic/BuildInPublicTaskOwner'
import BuildInPublicTaskStatusMark from '~components/buildInPublic/BuildInPublicTaskStatusMark'
import { CARD_DISPLAY_CLASS_NAME, CARD_EYEBROW_CLASS_NAME } from '~components/buildInPublic/cardClassNames'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

const STATUS_MESSAGES = {
  [TaskStatus.BACKLOG]: buildInPublicMessages.taskOnRoadmap,
  [TaskStatus.TODO]: buildInPublicMessages.taskUpNext,
  [TaskStatus.ONGOING]: buildInPublicMessages.taskInProgress,
  [TaskStatus.DONE]: buildInPublicMessages.taskShipped,
}

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
  task: Task
  fields: CardField[]
  values: CardValues
  members: readonly OrganizationMember[]
}

// One task and where it stands: shipped, in progress, up next or on the roadmap, with the day it
// is due while it is not done, the aspects it is about and who is doing it
function BuildInPublicTaskStatusCard({ settings, task, fields, values, members }: Props) {
  const { formatMessage } = useIntl()
  const formatTaskDueDate = useFormatTaskDueDate()

  const status = formatMessage(STATUS_MESSAGES[task.status])

  return (
    <BuildInPublicCard
      cardKey="task-status"
      label={formatMessage(buildInPublicMessages.statusCard)}
      format="square"
      tone="accent"
      settings={settings}
      fields={fields}
      values={values}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={cn(CARD_EYEBROW_CLASS_NAME, 'min-w-0 truncate')}>
          {task.status !== TaskStatus.DONE && task.dueDate
            ? formatMessage(buildInPublicMessages.taskStatusDue, {
                status,
                date: formatTaskDueDate(task.dueDate, 'short'),
              })
            : status}
        </p>
        <BuildInPublicTaskAspects aspects={task.aspects} />
      </div>
      <BuildInPublicTaskStatusMark
        status={task.status}
        className="mt-auto"
      />
      <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-4 line-clamp-3 text-[30px]/[1.25] wrap-break-word')}>{task.name}</p>
      <BuildInPublicTaskOwner
        task={task}
        members={members}
        isInverted
        className="mt-5"
      />
    </BuildInPublicCard>
  )
}

export default BuildInPublicTaskStatusCard
