import { useIntl } from 'react-intl'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import { cn } from 'strategydance-design-system/lib/utils'

import type { OrganizationMember, Task } from '~types'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'

import getBoardStats from '~utils/buildInPublic/getBoardStats'
import toTaskAssigneeValue from '~utils/task/toTaskAssigneeValue'

import BuildInPublicAgentAvatar from '~components/buildInPublic/BuildInPublicAgentAvatar'
import BuildInPublicBar from '~components/buildInPublic/BuildInPublicBar'
import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import {
  CARD_DISPLAY_CLASS_NAME,
  CARD_EYEBROW_CLASS_NAME,
  CARD_MUTED_CLASS_NAME,
} from '~components/buildInPublic/cardClassNames'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'
import taskMessages from '~data/intl/messages/task'

// As many as the card holds
const MAX_WORKERS = 6

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
  tasks: readonly Task[]
  members: readonly OrganizationMember[]
}

/*
  Who does the board's tasks: how many members and whether Strategy Dance among them, the share of
  the tasks the AI does, large, and the busiest of them with how many each does, the AI's bar in the
  mark color. A member is named only by the name they gave, since the card is posted for anybody to
  see, so one who gave none is counted among the people but listed nowhere. Nothing while nobody
  is doing any task
*/
function BuildInPublicBoardWorkersCard({ settings, tasks, members }: Props) {
  const { formatMessage, formatNumber } = useIntl()

  const membersByWorker = new Map(
    members.map(member => [toTaskAssigneeValue({ assigneeId: member.user.id, isAssignedToAgent: false }), member]),
  )
  // A member gone since leaves no tasks behind, but one the team has not loaded yet is left out
  const workers = getBoardStats(tasks).workers.filter(({ worker }) => worker === 'agent' || membersByWorker.has(worker))

  if (!workers.length) return null

  const agentCount = workers.find(({ worker }) => worker === 'agent')?.total ?? 0
  const peopleCount = workers.filter(({ worker }) => worker !== 'agent').length
  const listed = workers
    .filter(({ worker }) => worker === 'agent' || membersByWorker.get(worker)?.user.displayName)
    .slice(0, MAX_WORKERS)
  const mostTasks = Math.max(...listed.map(({ total }) => total))

  return (
    <BuildInPublicCard
      cardKey="board-workers"
      label={formatMessage(buildInPublicMessages.workersCard)}
      format="landscape"
      tone="dark"
      settings={settings}
    >
      <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-8">
        <div className="flex min-w-0 flex-col">
          <p className={CARD_EYEBROW_CLASS_NAME}>{formatMessage(buildInPublicMessages.whoDoesTheWork)}</p>
          <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-2 text-[28px]/[1.12]')}>
            {formatMessage(agentCount ? buildInPublicMessages.peopleAndAi : buildInPublicMessages.people, {
              count: peopleCount,
            })}
          </p>
          <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto text-[96px] leading-[0.85] text-(--card-strong)')}>
            {formatNumber(tasks.length ? agentCount / tasks.length : 0, { style: 'percent' })}
          </p>
          <p className="mt-2.5 mb-0 text-sm font-medium">{formatMessage(buildInPublicMessages.tasksForAi)}</p>
        </div>
        <ul className="m-0 flex list-none flex-col justify-end gap-3 p-0">
          {listed.map(({ worker, total }) => {
            const isAgent = worker === 'agent'
            const name = isAgent
              ? formatMessage(taskMessages.strategyDance)
              : (membersByWorker.get(worker)?.user.displayName ?? '')

            return (
              <li
                key={worker}
                className="grid grid-cols-[24px_minmax(0,1fr)_52px] items-center gap-2.5"
              >
                {isAgent ? (
                  <BuildInPublicAgentAvatar size="sm" />
                ) : (
                  <Avatar
                    src={membersByWorker.get(worker)?.user.imageUrl ?? undefined}
                    name={name}
                    size="sm"
                  />
                )}
                <div className="flex min-w-0 flex-col gap-[5px]">
                  <span className="truncate text-xs font-medium">{name}</span>
                  <BuildInPublicBar
                    ratio={total / mostTasks}
                    className="h-[5px]"
                    fillClassName={isAgent ? undefined : 'bg-current'}
                  />
                </div>
                <span className={cn(CARD_MUTED_CLASS_NAME, 'text-right text-xs tabular-nums')}>
                  {formatMessage(buildInPublicMessages.taskCount, { count: total })}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </BuildInPublicCard>
  )
}

export default BuildInPublicBoardWorkersCard
