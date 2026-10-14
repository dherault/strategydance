import { useIntl } from 'react-intl'
import { TaskStatus } from 'strategydance-database/web'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, CardValues, Task } from '~types'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useFormatTaskDueDate from '~hooks/task/useFormatTaskDueDate'

import BuildInPublicAgentAvatar from '~components/buildInPublic/BuildInPublicAgentAvatar'
import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import {
  CARD_DISPLAY_CLASS_NAME,
  CARD_EYEBROW_CLASS_NAME,
  CARD_MUTED_CLASS_NAME,
} from '~components/buildInPublic/cardClassNames'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

const STATUS_MESSAGES = {
  [TaskStatus.BACKLOG]: buildInPublicMessages.agentQueued,
  [TaskStatus.TODO]: buildInPublicMessages.agentUpNext,
  [TaskStatus.ONGOING]: buildInPublicMessages.agentWorking,
  [TaskStatus.DONE]: buildInPublicMessages.agentDone,
}

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
  // One Strategy Dance is doing
  task: Task
  fields: CardField[]
  values: CardValues
}

// A task the team gave Strategy Dance, under its mark: where the AI stands on it, and when it is
// due while it is not done, under it where the two do not fit on a line
function BuildInPublicAgentTaskCard({ settings, task, fields, values }: Props) {
  const { formatMessage } = useIntl()
  const formatTaskDueDate = useFormatTaskDueDate()

  return (
    <BuildInPublicCard
      cardKey="task-agent"
      label={formatMessage(buildInPublicMessages.agentCard)}
      format="square"
      tone="dark"
      settings={settings}
      fields={fields}
      values={values}
    >
      <BuildInPublicAgentAvatar size="xl" />
      <p className={cn(CARD_EYEBROW_CLASS_NAME, 'mt-5')}>{formatMessage(buildInPublicMessages.delegatedToAi)}</p>
      <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-2 line-clamp-3 text-[28px]/[1.25] wrap-break-word')}>{task.name}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] font-medium">
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-2 flex-none rounded-full bg-(--card-mark)" />
          <span>
            {formatMessage(buildInPublicMessages.agentStatus, { status: formatMessage(STATUS_MESSAGES[task.status]) })}
          </span>
        </span>
        {task.dueDate && task.status !== TaskStatus.DONE ? (
          <span className={cn(CARD_MUTED_CLASS_NAME, 'flex-none')}>
            {formatMessage(buildInPublicMessages.taskDue, { date: formatTaskDueDate(task.dueDate, 'short') })}
          </span>
        ) : null}
      </div>
    </BuildInPublicCard>
  )
}

export default BuildInPublicAgentTaskCard
