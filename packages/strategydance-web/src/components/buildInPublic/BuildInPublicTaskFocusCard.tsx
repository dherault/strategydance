import { CheckIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { TaskStatus } from 'strategydance-database/web'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, CardValues, OrganizationMember, Task } from '~types'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useLocalDate from '~hooks/common/useLocalDate'
import useFormatTaskDueDate from '~hooks/task/useFormatTaskDueDate'

import getTaskDays from '~utils/buildInPublic/getTaskDays'
import getTaskDoneDate from '~utils/buildInPublic/getTaskDoneDate'
import getTaskExcerpt from '~utils/buildInPublic/getTaskExcerpt'
import getLocalDate from '~utils/date/getLocalDate'

import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import BuildInPublicTaskAspectChips from '~components/buildInPublic/BuildInPublicTaskAspectChips'
import BuildInPublicTaskOwner from '~components/buildInPublic/BuildInPublicTaskOwner'
import {
  CARD_DISPLAY_CLASS_NAME,
  CARD_EYEBROW_CLASS_NAME,
  CARD_MUTED_CLASS_NAME,
} from '~components/buildInPublic/cardClassNames'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'
import taskStatusMessages from '~data/intl/taskStatusMessages'

const STATUS_MESSAGES = {
  [TaskStatus.BACKLOG]: buildInPublicMessages.taskOnRoadmap,
  [TaskStatus.TODO]: buildInPublicMessages.taskNextUp,
  [TaskStatus.ONGOING]: buildInPublicMessages.taskNowBuilding,
  [TaskStatus.DONE]: buildInPublicMessages.taskShipped,
}

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
  task: Task
  // Its blocks, or an empty string while none is read
  description: string
  fields: CardField[]
  values: CardValues
  members: readonly OrganizationMember[]
}

/*
  One task, large, beside how long it has taken: the days it has been on the board, or once done
  the days it took, from the day it was added to the day it was done. Under its name, the first
  paragraph of its description, and who is doing it beside when it is due, or that it is done
*/
function BuildInPublicTaskFocusCard({ settings, task, description, fields, values, members }: Props) {
  const { formatMessage } = useIntl()
  const formatTaskDueDate = useFormatTaskDueDate()
  const today = useLocalDate()

  const doneDate = getTaskDoneDate(task)
  const days = getTaskDays(getLocalDate(new Date(task.createdAt)), doneDate, today)
  const excerpt = getTaskExcerpt(description)

  return (
    <BuildInPublicCard
      cardKey="task-focus"
      label={formatMessage(buildInPublicMessages.taskFocusCard)}
      format="landscape"
      tone="white"
      isFlush
      settings={settings}
      fields={fields}
      values={values}
    >
      <div className="grid h-full grid-cols-[184px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col bg-(--card-panel) p-7">
          <p className={CARD_EYEBROW_CLASS_NAME}>{formatMessage(STATUS_MESSAGES[task.status])}</p>
          {/* Smaller past two digits, which the panel is as wide as */}
          <p
            className={cn(
              CARD_DISPLAY_CLASS_NAME,
              'mt-auto text-(--card-strong)',
              days < 100 ? 'text-[104px]/[0.85]' : days < 1000 ? 'text-[76px]/[0.85]' : 'text-[56px]/[0.85]',
            )}
          >
            {days}
          </p>
          <p className="mt-2.5 mb-0 text-[15px] font-medium">
            {formatMessage(doneDate ? buildInPublicMessages.daysToShip : buildInPublicMessages.daysOnBoard, {
              count: days,
            })}
          </p>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col px-7 pt-7 pb-11">
          <BuildInPublicTaskAspectChips aspects={task.aspects} />
          <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto line-clamp-3 text-[30px]/[1.25] wrap-break-word')}>
            {task.name}
          </p>
          {excerpt ? (
            <p className={cn(CARD_MUTED_CLASS_NAME, 'mt-2.5 mb-0 line-clamp-2 text-sm/[1.5] wrap-break-word')}>
              {excerpt}
            </p>
          ) : null}
          <div className="mt-5 flex items-center justify-between gap-4">
            <BuildInPublicTaskOwner
              task={task}
              members={members}
            />
            {doneDate ? (
              <p className={cn(CARD_EYEBROW_CLASS_NAME, 'ml-auto flex items-center gap-1.5')}>
                <CheckIcon
                  size={14}
                  strokeWidth={3}
                  aria-hidden="true"
                />
                {formatMessage(taskStatusMessages[TaskStatus.DONE])}
              </p>
            ) : task.dueDate ? (
              <p className={cn(CARD_EYEBROW_CLASS_NAME, 'ml-auto')}>
                {formatMessage(buildInPublicMessages.taskDue, { date: formatTaskDueDate(task.dueDate, 'short') })}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </BuildInPublicCard>
  )
}

export default BuildInPublicTaskFocusCard
