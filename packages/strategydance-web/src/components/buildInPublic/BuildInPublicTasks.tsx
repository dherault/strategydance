import { useIntl } from 'react-intl'
import { TaskStatus } from 'strategydance-database/web'

import type { CardField, Task } from '~types'

import { TASK_STATUSES } from '~constants'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useLocalDate from '~hooks/common/useLocalDate'
import useTaskDescriptions from '~hooks/task/useTaskDescriptions'
import useTasks from '~hooks/task/useTasks'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import getDaysBetween from '~utils/date/getDaysBetween'
import toTaskAssigneeValue from '~utils/task/toTaskAssigneeValue'
import getMemberName from '~utils/team/getMemberName'

import BuildInPublicAgentTaskCard from '~components/buildInPublic/BuildInPublicAgentTaskCard'
import BuildInPublicBoardAspectsCard from '~components/buildInPublic/BuildInPublicBoardAspectsCard'
import BuildInPublicBoardCard from '~components/buildInPublic/BuildInPublicBoardCard'
import BuildInPublicBoardProgressCard from '~components/buildInPublic/BuildInPublicBoardProgressCard'
import BuildInPublicBoardWorkersCard from '~components/buildInPublic/BuildInPublicBoardWorkersCard'
import BuildInPublicSection from '~components/buildInPublic/BuildInPublicSection'
import BuildInPublicTaskCountdownCard from '~components/buildInPublic/BuildInPublicTaskCountdownCard'
import BuildInPublicTaskFocusCard from '~components/buildInPublic/BuildInPublicTaskFocusCard'
import BuildInPublicTaskStatusCard from '~components/buildInPublic/BuildInPublicTaskStatusCard'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'
import taskMessages from '~data/intl/messages/task'
import taskStatusMessages from '~data/intl/taskStatusMessages'

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
}

/*
  The task cards, from the team's board: one task where it stands, how long it has taken, its
  countdown to its due date and one Strategy Dance does, each picked by the reader among the tasks
  the card can show, then the board itself, how far along it is, the aspects it is about and who
  does the work, the board's cards for everybody or one assignee. The section shows once the board
  has a task, and each card once it has something to show.

  A picked task deleted since, or one the card can no longer show, reads as the card's own pick,
  as a teammate gone since does on the other cards
*/
function BuildInPublicTasks({ settings }: Props) {
  const { formatMessage } = useIntl()
  const { data: tasks, loading, refetch, hasFailed } = useTasks()
  const { data: descriptions } = useTaskDescriptions()
  const { data: team } = useOrganizationTeam()
  const today = useLocalDate()

  const members = team.userOrganizations

  if (!hasFailed && !tasks.length) return null

  // The pick among a card's tasks, by column then in the board's order, once there are two to pick
  function getTaskField(pool: readonly Task[]): CardField[] {
    if (pool.length < 2) return []

    return [
      {
        kind: 'combobox',
        key: 'task',
        label: formatMessage(buildInPublicMessages.taskField),
        options: TASK_STATUSES.map(status => ({
          label: formatMessage(taskStatusMessages[status]),
          options: pool.filter(task => task.status === status).map(task => ({ value: task.id, label: task.name })),
        })).filter(group => group.options.length),
        searchPlaceholder: formatMessage(buildInPublicMessages.searchTasks),
        emptyText: formatMessage(buildInPublicMessages.noTasksFound),
      },
    ]
  }

  function readTask(cardKey: string, pool: readonly Task[], preferred: Task | undefined) {
    const fallback = preferred ?? pool[0] ?? null
    const { task: taskId } = settings.readCard(cardKey, { task: fallback?.id ?? '' })
    const task = pool.find(other => other.id === taskId) ?? fallback

    return { task, fields: getTaskField(pool), values: { task: task?.id ?? '' } }
  }

  // Whose tasks a board card counts: everybody's, Strategy Dance's, or a member's, as the assignee
  // select names them, everybody's again once a member picked is gone
  function readAssignee(cardKey: string) {
    const { who } = settings.readCard(cardKey, { who: 'everyone' })
    const member = members.find(
      teamMember => toTaskAssigneeValue({ assigneeId: teamMember.user.id, isAssignedToAgent: false }) === who,
    )
    const value = who === 'agent' || member ? who : 'everyone'
    const shown = value === 'everyone' ? tasks : tasks.filter(task => toTaskAssigneeValue(task) === value)
    // Named on the card only by the name a member gave, since it is posted for anybody to see
    const name = value === 'agent' ? formatMessage(taskMessages.strategyDance) : (member?.user.displayName ?? null)

    return { tasks: shown, name, values: { who: value } }
  }

  const assigneeField: CardField = {
    kind: 'select',
    key: 'who',
    label: formatMessage(buildInPublicMessages.assigneeField),
    options: [
      { value: 'everyone', label: formatMessage(buildInPublicMessages.everyone) },
      { value: 'agent', label: formatMessage(taskMessages.strategyDance) },
      ...members.map(member => ({
        value: toTaskAssigneeValue({ assigneeId: member.user.id, isAssignedToAgent: false }),
        label: getMemberName(member),
      })),
    ],
  }

  const datedTasks = tasks.filter(task => task.dueDate !== null)
  const agentTasks = tasks.filter(task => task.isAssignedToAgent)
  const status = readTask(
    'task-status',
    tasks,
    tasks.find(task => task.status === TaskStatus.DONE),
  )
  const focus = readTask(
    'task-focus',
    tasks,
    tasks.find(task => task.status === TaskStatus.ONGOING),
  )
  // The next due, from tomorrow on, so it counts down
  const countdown = readTask(
    'task-countdown',
    datedTasks,
    datedTasks
      .filter(task => getDaysBetween(today, task.dueDate!) >= 1)
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0],
  )
  const agentTask = readTask(
    'task-agent',
    agentTasks,
    agentTasks.find(task => task.status === TaskStatus.ONGOING),
  )
  const board = readAssignee('board-snapshot')
  const progress = readAssignee('board-progress')

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
      {status.task ? (
        <BuildInPublicTaskStatusCard
          settings={settings}
          task={status.task}
          fields={status.fields}
          values={status.values}
          members={members}
        />
      ) : null}
      {focus.task ? (
        <BuildInPublicTaskFocusCard
          settings={settings}
          task={focus.task}
          description={descriptions.get(focus.task.id) ?? ''}
          fields={focus.fields}
          values={focus.values}
          members={members}
        />
      ) : null}
      {countdown.task ? (
        <BuildInPublicTaskCountdownCard
          settings={settings}
          task={countdown.task}
          fields={countdown.fields}
          values={countdown.values}
          members={members}
        />
      ) : null}
      {agentTask.task ? (
        <BuildInPublicAgentTaskCard
          settings={settings}
          task={agentTask.task}
          fields={agentTask.fields}
          values={agentTask.values}
        />
      ) : null}
      <BuildInPublicBoardCard
        settings={settings}
        tasks={board.tasks}
        name={board.name}
        fields={[assigneeField]}
        values={board.values}
      />
      <BuildInPublicBoardProgressCard
        settings={settings}
        tasks={progress.tasks}
        name={progress.name}
        fields={[assigneeField]}
        values={progress.values}
      />
      <BuildInPublicBoardAspectsCard
        settings={settings}
        tasks={tasks}
      />
      <BuildInPublicBoardWorkersCard
        settings={settings}
        tasks={tasks}
        members={members}
      />
    </BuildInPublicSection>
  )
}

export default BuildInPublicTasks
