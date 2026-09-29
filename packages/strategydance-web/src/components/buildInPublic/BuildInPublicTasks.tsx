import { CheckIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, TaskListWithTasks } from '~types'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useTaskListsWithTasks from '~hooks/task/useTaskListsWithTasks'

import BuildInPublicBar from '~components/buildInPublic/BuildInPublicBar'
import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import BuildInPublicCheckbox from '~components/buildInPublic/BuildInPublicCheckbox'
import BuildInPublicOrganization from '~components/buildInPublic/BuildInPublicOrganization'
import BuildInPublicSection from '~components/buildInPublic/BuildInPublicSection'
import {
  CARD_DISPLAY_CLASS_NAME,
  CARD_EYEBROW_CLASS_NAME,
  CARD_MUTED_CLASS_NAME,
} from '~components/buildInPublic/cardClassNames'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

// The most lists the "All lists" card has room for
const MAX_LISTS_SHOWN = 4

// How many tasks "List progress" lists before it says how many more there are
const MAX_TASKS_SHOWN = 6

const NEXT_TASK_COUNTS = ['2', '3', '4']

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
}

function countDone(taskList: TaskListWithTasks) {
  return taskList.tasks.filter(task => task.isDone).length
}

/*
  The task cards, from the reader's own lists: how far one list is, how many tasks are crossed
  off, what is up next, and every list at once. The section is left out until a list has a task,
  since a card of empty lists says nothing
*/
function BuildInPublicTasks({ settings }: Props) {
  const { formatMessage } = useIntl()
  const { data: taskLists, loading, refetch, hasFailed } = useTaskListsWithTasks()

  const firstWithTasks = taskLists.find(taskList => taskList.tasks.length > 0)

  if (!hasFailed && !firstWithTasks) return null

  const taskListIds = taskLists.map(taskList => taskList.id)
  const options = taskLists.map(taskList => ({ value: taskList.id, label: taskList.name }))
  const isMultiple = taskLists.length > 1

  // The list picked, or the first with a task in it once that one is gone
  function findList(id: string) {
    return taskLists.find(taskList => taskList.id === id) ?? firstWithTasks ?? taskLists[0]
  }

  // The lists picked that are still there, in the rail's order, or all of them when none is
  function pickLists(ids: string[]) {
    const picked = taskLists.filter(taskList => ids.includes(taskList.id))

    return picked.length ? picked : taskLists
  }

  const listField: CardField = {
    kind: 'select',
    key: 'list',
    label: formatMessage(buildInPublicMessages.taskList),
    options,
  }

  function listsField(max?: number): CardField {
    return {
      kind: 'multiSelect',
      key: 'lists',
      label: formatMessage(buildInPublicMessages.taskLists),
      options,
      max,
    }
  }

  const progressValues = settings.readCard('tasks-progress', { list: firstWithTasks?.id ?? '' })
  const progressList = findList(progressValues.list)
  const progressDone = progressList ? countDone(progressList) : 0
  const progressTasks = progressList?.tasks ?? []
  const shownTasks =
    progressTasks.length > MAX_TASKS_SHOWN ? progressTasks.slice(0, MAX_TASKS_SHOWN - 1) : progressTasks

  const crossedOffValues = settings.readCard('tasks-crossed-off', { lists: taskListIds })
  const crossedOffLists = pickLists(crossedOffValues.lists)
  const doneTasks = crossedOffLists.flatMap(taskList => taskList.tasks.filter(task => task.isDone))

  const firstOpen = taskLists.find(taskList => taskList.tasks.some(task => !task.isDone)) ?? firstWithTasks
  const upNextValues = settings.readCard('tasks-up-next', { list: firstOpen?.id ?? '', count: '4' })
  const upNextList = findList(upNextValues.list)
  const upNextCount = NEXT_TASK_COUNTS.includes(upNextValues.count) ? upNextValues.count : '4'
  const openTasks = upNextList?.tasks.filter(task => !task.isDone).slice(0, Number(upNextCount)) ?? []

  const allListsValues = settings.readCard('tasks-all-lists', { lists: taskListIds.slice(0, MAX_LISTS_SHOWN) })
  const allLists = pickLists(allListsValues.lists).slice(0, MAX_LISTS_SHOWN)
  const allDone = allLists.reduce((sum, taskList) => sum + countDone(taskList), 0)
  const allTotal = allLists.reduce((sum, taskList) => sum + taskList.tasks.length, 0)

  return (
    <BuildInPublicSection
      title={formatMessage(buildInPublicMessages.tasksTitle)}
      description={formatMessage(buildInPublicMessages.tasksDescription)}
      failure={
        hasFailed
          ? { message: formatMessage(buildInPublicMessages.tasksLoadFailed), isRetrying: loading, onRetry: refetch }
          : null
      }
    >
      {progressList ? (
        <BuildInPublicCard
          cardKey="tasks-progress"
          label={formatMessage(buildInPublicMessages.progressCard)}
          format="landscape"
          tone="white"
          isFlush
          settings={settings}
          fields={isMultiple ? [listField] : []}
          values={{ list: progressList.id }}
        >
          <div className="grid h-full grid-cols-[200px_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col bg-(--card-panel) p-7">
              <p className={CARD_EYEBROW_CLASS_NAME}>{formatMessage(buildInPublicMessages.taskList)}</p>
              <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-2 line-clamp-3 text-[28px]/[1.12]')}>{progressList.name}</p>
              <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto text-[64px] leading-[0.9] text-(--card-strong)')}>
                {progressDone}/{progressTasks.length}
              </p>
              <p className={cn(CARD_MUTED_CLASS_NAME, 'mt-2 mb-0 text-sm')}>
                {formatMessage(buildInPublicMessages.tasksDone, { count: progressDone })}
              </p>
            </div>
            <div className="flex min-w-0 flex-col px-7 pt-8 pb-11">
              <BuildInPublicBar ratio={progressDone / (progressTasks.length || 1)} />
              <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
                {shownTasks.map(task => (
                  <li
                    key={task.id}
                    className="flex min-w-0 items-center gap-3 text-[15px] font-medium"
                  >
                    <BuildInPublicCheckbox isChecked={task.isDone} />
                    <span className={cn('truncate', !task.isDone && CARD_MUTED_CLASS_NAME)}>{task.text}</span>
                  </li>
                ))}
                {progressTasks.length > shownTasks.length ? (
                  <li className={cn(CARD_MUTED_CLASS_NAME, 'pl-[34px] text-sm font-medium')}>
                    {formatMessage(buildInPublicMessages.moreTasks, {
                      count: progressTasks.length - shownTasks.length,
                    })}
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </BuildInPublicCard>
      ) : null}
      <BuildInPublicCard
        cardKey="tasks-crossed-off"
        label={formatMessage(buildInPublicMessages.crossedOffCard)}
        format="square"
        tone="accent"
        settings={settings}
        fields={isMultiple ? [listsField()] : []}
        values={{ lists: crossedOffLists.map(taskList => taskList.id) }}
      >
        <p className={CARD_EYEBROW_CLASS_NAME}>{formatMessage(buildInPublicMessages.tasksCrossedOff)}</p>
        <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto text-[112px] leading-[0.85]')}>{doneTasks.length}</p>
        <p className="mt-2.5 mb-0 truncate text-base font-medium">
          {crossedOffLists.length === 1
            ? formatMessage(buildInPublicMessages.doneOnList, { list: crossedOffLists[0].name })
            : formatMessage(buildInPublicMessages.doneAcrossLists, { count: crossedOffLists.length })}
        </p>
        {doneTasks.length ? (
          <ul className="m-0 mt-5 flex list-none flex-col gap-1.5 p-0">
            {doneTasks.slice(0, 3).map(task => (
              <li
                key={task.id}
                className="flex min-w-0 items-center gap-2 text-sm"
              >
                <CheckIcon
                  size={14}
                  strokeWidth={3}
                  aria-hidden="true"
                  className="flex-none"
                />
                <span className="truncate">{task.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </BuildInPublicCard>
      {upNextList ? (
        <BuildInPublicCard
          cardKey="tasks-up-next"
          label={formatMessage(buildInPublicMessages.upNextCard)}
          format="portrait"
          tone="dark"
          settings={settings}
          fields={[
            ...(isMultiple ? [listField] : []),
            {
              kind: 'select',
              key: 'count',
              label: formatMessage(buildInPublicMessages.numberOfTasks),
              options: NEXT_TASK_COUNTS.map(count => ({
                value: count,
                label: formatMessage(buildInPublicMessages.tasksOption, { count: Number(count) }),
              })),
            },
          ]}
          values={{ list: upNextList.id, count: upNextCount }}
        >
          <BuildInPublicOrganization maxSize={13} />
          <p className={cn(CARD_EYEBROW_CLASS_NAME, 'mt-auto')}>{formatMessage(buildInPublicMessages.upNext)}</p>
          <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-2 line-clamp-2 text-[30px]/[1.12]')}>{upNextList.name}</p>
          {openTasks.length ? (
            <ol className="m-0 mt-5 flex list-none flex-col gap-3.5 p-0">
              {openTasks.map((task, index) => (
                <li
                  key={task.id}
                  className="grid grid-cols-[32px_minmax(0,1fr)] items-baseline"
                >
                  <span className={cn(CARD_DISPLAY_CLASS_NAME, 'text-xl/[1.12] text-(--card-strong)')}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="line-clamp-2 text-[15px] leading-[1.4]">{task.text}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={cn(CARD_MUTED_CLASS_NAME, 'mt-5 mb-0 text-[15px]')}>
              {formatMessage(buildInPublicMessages.allDone)}
            </p>
          )}
        </BuildInPublicCard>
      ) : null}
      <BuildInPublicCard
        cardKey="tasks-all-lists"
        label={formatMessage(buildInPublicMessages.allListsCard)}
        format="square"
        tone="tint"
        settings={settings}
        fields={isMultiple ? [listsField(MAX_LISTS_SHOWN)] : []}
        values={{ lists: allLists.map(taskList => taskList.id) }}
      >
        <p className={CARD_EYEBROW_CLASS_NAME}>
          {formatMessage(buildInPublicMessages.tasksAcrossLists, { count: allLists.length })}
        </p>
        <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-2 text-[26px]/[1.12]')}>
          {formatMessage(buildInPublicMessages.doneOf, { done: allDone, total: allTotal })}
        </p>
        <div className="mt-auto flex flex-col gap-3.5">
          {allLists.map(taskList => (
            <div
              key={taskList.id}
              className="flex flex-col gap-1.5"
            >
              <div className="flex justify-between gap-3 text-[13px]">
                <span className="truncate font-medium">{taskList.name}</span>
                <span className={cn(CARD_MUTED_CLASS_NAME, 'tabular-nums')}>
                  {countDone(taskList)}/{taskList.tasks.length}
                </span>
              </div>
              <BuildInPublicBar
                ratio={countDone(taskList) / (taskList.tasks.length || 1)}
                className="bg-white"
              />
            </div>
          ))}
        </div>
      </BuildInPublicCard>
    </BuildInPublicSection>
  )
}

export default BuildInPublicTasks
