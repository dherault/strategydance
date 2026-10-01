import { CheckIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, TaskListSummary } from '~types'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useTaskListSummaries from '~hooks/task/useTaskListSummaries'

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
import FitText from '~components/buildInPublic/FitText'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

// The most lists the "All lists" card has room for
const MAX_LISTS_SHOWN = 4

// How many tasks "List progress" lists before it says how many more there are
const MAX_TASKS_SHOWN = 6

const NEXT_TASK_COUNTS = ['2', '3', '4']

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
}

// A count comes back as a list of one
function countDone(taskList: TaskListSummary) {
  return taskList.doneTasks[0]?._count ?? 0
}

function countAll(taskList: TaskListSummary) {
  return taskList.allTasks[0]?._count ?? 0
}

/*
  The task cards, from the reader's own lists: how far one list is, how many tasks are crossed
  off, what is up next, and every list at once. The section is left out until a list has a task,
  since a card of empty lists says nothing
*/
function BuildInPublicTasks({ settings }: Props) {
  const { formatMessage } = useIntl()
  const { data: taskLists, loading, refetch, hasFailed } = useTaskListSummaries()

  const firstWithTasks = taskLists.find(taskList => countAll(taskList) > 0)

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
  const progressTotal = progressList ? countAll(progressList) : 0
  // Its first tasks, one fewer once the list holds more than fit, to say how many more there are
  const shownTasks =
    progressTotal > MAX_TASKS_SHOWN
      ? (progressList?.firstTasks.slice(0, MAX_TASKS_SHOWN - 1) ?? [])
      : (progressList?.firstTasks ?? [])

  const crossedOffValues = settings.readCard('tasks-crossed-off', { lists: taskListIds })
  const crossedOffLists = pickLists(crossedOffValues.lists)
  const doneCount = crossedOffLists.reduce((sum, taskList) => sum + countDone(taskList), 0)
  const doneTasks = crossedOffLists.flatMap(taskList => taskList.firstDoneTasks).slice(0, 3)

  const firstOpen = taskLists.find(taskList => countAll(taskList) > countDone(taskList)) ?? firstWithTasks
  const upNextValues = settings.readCard('tasks-up-next', { list: firstOpen?.id ?? '', count: '4' })
  const upNextList = findList(upNextValues.list)
  const upNextCount = NEXT_TASK_COUNTS.includes(upNextValues.count) ? upNextValues.count : '4'
  const openTasks = upNextList?.firstOpenTasks.slice(0, Number(upNextCount)) ?? []

  const allListsValues = settings.readCard('tasks-all-lists', { lists: taskListIds.slice(0, MAX_LISTS_SHOWN) })
  const allLists = pickLists(allListsValues.lists).slice(0, MAX_LISTS_SHOWN)
  const allDone = allLists.reduce((sum, taskList) => sum + countDone(taskList), 0)
  const allTotal = allLists.reduce((sum, taskList) => sum + countAll(taskList), 0)

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
              <p
                className={cn(
                  CARD_DISPLAY_CLASS_NAME,
                  'mt-2 line-clamp-3 wrap-break-word text-[28px]/[1.12] descender-room',
                )}
              >
                {progressList.name}
              </p>
              {/* Shrinks once the counts reach three digits, which the panel is not wide enough for */}
              <FitText
                as="p"
                isDisplay
                max={64}
                min={32}
                lineHeight={0.9}
                className="mt-auto text-(--card-strong)"
              >
                {progressDone}/{progressTotal}
              </FitText>
              <p className={cn(CARD_MUTED_CLASS_NAME, 'mt-2 mb-0 text-sm')}>
                {formatMessage(buildInPublicMessages.tasksDone, { count: progressDone })}
              </p>
            </div>
            <div className="flex min-w-0 flex-col px-7 pt-8 pb-11">
              <BuildInPublicBar ratio={progressDone / (progressTotal || 1)} />
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
                {progressTotal > shownTasks.length ? (
                  <li className={cn(CARD_MUTED_CLASS_NAME, 'pl-[34px] text-sm font-medium')}>
                    {formatMessage(buildInPublicMessages.moreTasks, {
                      count: progressTotal - shownTasks.length,
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
        <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto text-[112px] leading-[0.85]')}>{doneCount}</p>
        <p className="mt-2.5 mb-0 truncate text-base font-medium">
          {crossedOffLists.length === 1
            ? formatMessage(buildInPublicMessages.doneOnList, { list: crossedOffLists[0].name })
            : formatMessage(buildInPublicMessages.doneAcrossLists, { count: crossedOffLists.length })}
        </p>
        {doneTasks.length ? (
          <ul className="m-0 mt-5 flex list-none flex-col gap-1.5 p-0">
            {doneTasks.map(task => (
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
          <p
            className={cn(
              CARD_DISPLAY_CLASS_NAME,
              'mt-2 line-clamp-2 flex-none wrap-break-word text-[30px]/[1.12] descender-room',
            )}
          >
            {upNextList.name}
          </p>
          {/* Four tasks take a line each, since four of two lines run past the card */}
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
                  <span
                    className={cn(
                      'wrap-break-word text-[15px] leading-[1.4]',
                      openTasks.length > 3 ? 'line-clamp-1' : 'line-clamp-2',
                    )}
                  >
                    {task.text}
                  </span>
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
                  {countDone(taskList)}/{countAll(taskList)}
                </span>
              </div>
              <BuildInPublicBar ratio={countDone(taskList) / (countAll(taskList) || 1)} />
            </div>
          ))}
        </div>
      </BuildInPublicCard>
    </BuildInPublicSection>
  )
}

export default BuildInPublicTasks
