import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, CardValues, OrganizationMember, Task } from '~types'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useLocalDate from '~hooks/common/useLocalDate'

import getTaskCountdown, { type TaskCountdown } from '~utils/buildInPublic/getTaskCountdown'
import getTaskDoneDate from '~utils/buildInPublic/getTaskDoneDate'

import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import BuildInPublicOrganization from '~components/buildInPublic/BuildInPublicOrganization'
import BuildInPublicTaskOwner from '~components/buildInPublic/BuildInPublicTaskOwner'
import {
  CARD_DISPLAY_CLASS_NAME,
  CARD_EYEBROW_CLASS_NAME,
  CARD_RULE_CLASS_NAME,
} from '~components/buildInPublic/cardClassNames'
import FitText from '~components/buildInPublic/FitText'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

const KIND_MESSAGES: Record<TaskCountdown['kind'], typeof buildInPublicMessages.shippingIn> = {
  shippingIn: buildInPublicMessages.shippingIn,
  shippingToday: buildInPublicMessages.shippingToday,
  pastDue: buildInPublicMessages.pastDue,
  shippedAhead: buildInPublicMessages.shippedAhead,
  shippedOnTime: buildInPublicMessages.shippedOnTime,
  shipped: buildInPublicMessages.taskShipped,
}

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
  // One with a due date
  task: Task
  fields: CardField[]
  values: CardValues
  members: readonly OrganizationMember[]
}

/*
  The days to a task's due date, large, or since it passed, or how far ahead of it the task was
  done, then its name and who is doing it: see `getTaskCountdown`
*/
function BuildInPublicTaskCountdownCard({ settings, task, fields, values, members }: Props) {
  const { formatMessage } = useIntl()
  const today = useLocalDate()

  const { kind, days } = getTaskCountdown(task.dueDate!, getTaskDoneDate(task), today)
  const unit =
    days === null
      ? null
      : formatMessage(
          kind === 'shippedOnTime' || kind === 'shipped'
            ? buildInPublicMessages.daysAgo
            : buildInPublicMessages.dayUnit,
          {
            count: days,
          },
        )
  // Under a rule, once somebody is doing it who can be named
  const hasOwner =
    task.isAssignedToAgent || Boolean(members.find(member => member.user.id === task.assigneeId)?.user.displayName)

  return (
    <BuildInPublicCard
      cardKey="task-countdown"
      label={formatMessage(buildInPublicMessages.countdownCard)}
      format="portrait"
      tone="dark"
      settings={settings}
      fields={fields}
      values={values}
    >
      <BuildInPublicOrganization maxSize={13} />
      <p className={cn(CARD_EYEBROW_CLASS_NAME, 'mt-auto')}>{formatMessage(KIND_MESSAGES[kind])}</p>
      {days === null ? (
        // Today shrinks to the card's width, which it runs past in French
        <FitText
          as="p"
          isDisplay
          max={112}
          min={40}
          lineHeight={0.85}
          className="mt-2 text-(--card-strong)"
        >
          {formatMessage(buildInPublicMessages.today)}
        </FitText>
      ) : (
        <div className="mt-2 flex items-baseline gap-3">
          <span className={cn(CARD_DISPLAY_CLASS_NAME, 'text-[112px] leading-[0.85] text-(--card-strong)')}>
            {days}
          </span>
          <span className={cn(CARD_DISPLAY_CLASS_NAME, 'text-[28px]/[1.12]')}>{unit}</span>
        </div>
      )}
      <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-5 line-clamp-3 text-2xl/[1.25] wrap-break-word')}>{task.name}</p>
      {hasOwner ? (
        <>
          <div className={cn(CARD_RULE_CLASS_NAME, 'mt-6 mb-4')} />
          <BuildInPublicTaskOwner
            task={task}
            members={members}
            isInverted
          />
        </>
      ) : null}
    </BuildInPublicCard>
  )
}

export default BuildInPublicTaskCountdownCard
