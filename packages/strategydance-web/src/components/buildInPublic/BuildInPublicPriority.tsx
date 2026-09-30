import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, OrganizationMember } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useLocalDate from '~hooks/common/useLocalDate'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import toCalendarDate from '~utils/date/toCalendarDate'
import getMemberName from '~utils/team/getMemberName'

import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import BuildInPublicOrganization from '~components/buildInPublic/BuildInPublicOrganization'
import BuildInPublicPerson from '~components/buildInPublic/BuildInPublicPerson'
import BuildInPublicSection from '~components/buildInPublic/BuildInPublicSection'
import {
  CARD_DISPLAY_CLASS_NAME,
  CARD_EYEBROW_CLASS_NAME,
  CARD_RULE_CLASS_NAME,
} from '~components/buildInPublic/cardClassNames'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
}

/*
  The top priority cards: the one thing somebody is moving forward, the reader's own unless they
  pick a teammate, which every card showing somebody picks with it. A teammate gone since reads as
  the reader again
*/
function BuildInPublicPriority({ settings }: Props) {
  const { formatMessage, formatDate } = useIntl()
  const { data: viewer } = useAuthentication()
  const { data: team, loading, refetch, hasFailed } = useOrganizationTeam()
  const today = useLocalDate()

  const viewerId = viewer?.uid ?? ''
  const members = team.userOrganizations
  const date = toCalendarDate(today)

  const teammateField: CardField = {
    kind: 'select',
    key: 'user',
    label: formatMessage(buildInPublicMessages.teammate),
    options: members.map(member => ({ value: member.user.id, label: getMemberName(member) })),
  }

  function readMember(cardKey: string) {
    const { user } = settings.readCard(cardKey, { user: viewerId })
    const member =
      members.find(teamMember => teamMember.user.id === user)
      ?? members.find(teamMember => teamMember.user.id === viewerId)
      ?? null
    const isViewer = member?.user.id === viewerId
    const priority =
      member?.topPriority
      || formatMessage(isViewer ? buildInPublicMessages.setPriority : buildInPublicMessages.noPriority)

    return { values: { user: member?.user.id ?? viewerId }, member, priority }
  }

  const focus = readMember('priority-focus')
  const statement = readMember('priority-statement')
  const oneThing = readMember('priority-one-thing')
  // The picker only once there is somebody else to pick
  const fields = members.length > 1 ? [teammateField] : []

  // A card is posted for anybody to see, so it names somebody only by the name they gave
  function renderPerson(member: OrganizationMember | null, className?: string) {
    if (!member?.user.displayName) return null

    return (
      <BuildInPublicPerson
        name={member.user.displayName}
        imageUrl={member.user.imageUrl ?? null}
        jobTitle={member.jobTitle ?? null}
        className={className}
      />
    )
  }

  return (
    <BuildInPublicSection
      title={formatMessage(buildInPublicMessages.priorityTitle)}
      description={formatMessage(buildInPublicMessages.priorityDescription)}
      failure={
        hasFailed
          ? { message: formatMessage(buildInPublicMessages.teamLoadFailed), isRetrying: loading, onRetry: refetch }
          : null
      }
    >
      <BuildInPublicCard
        cardKey="priority-focus"
        label={formatMessage(buildInPublicMessages.focusCard)}
        format="landscape"
        tone="white"
        isFlush
        settings={settings}
        fields={fields}
        values={focus.values}
      >
        <div className="grid h-full grid-cols-[184px_minmax(0,1fr)]">
          <div className="flex flex-col bg-(--card-panel) p-7">
            <p className={CARD_EYEBROW_CLASS_NAME}>{formatDate(date, { weekday: 'long', timeZone: 'UTC' })}</p>
            <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto text-[120px] leading-[0.9] text-(--card-strong)')}>
              {formatDate(date, { day: 'numeric', timeZone: 'UTC' })}
            </p>
            <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-2 text-[28px]/[1.12]')}>
              {formatDate(date, { month: 'long', timeZone: 'UTC' })}
            </p>
          </div>
          <div className="flex min-w-0 flex-col px-7 pt-7 pb-11">
            <p className={CARD_EYEBROW_CLASS_NAME}>{formatMessage(buildInPublicMessages.focusedOn)}</p>
            <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto line-clamp-4 wrap-break-word text-[32px]/[1.12]')}>
              {focus.priority}
            </p>
            {renderPerson(focus.member, 'mt-6')}
          </div>
        </div>
      </BuildInPublicCard>
      <BuildInPublicCard
        cardKey="priority-statement"
        label={formatMessage(buildInPublicMessages.statementCard)}
        format="square"
        tone="accent"
        settings={settings}
        fields={fields}
        values={statement.values}
      >
        <p className={CARD_EYEBROW_CLASS_NAME}>
          {formatMessage(buildInPublicMessages.priorityOn, {
            date: formatDate(date, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
          })}
        </p>
        <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto line-clamp-5 wrap-break-word text-[30px]/[1.12]')}>
          {statement.priority}
        </p>
        {renderPerson(statement.member, 'mt-6')}
      </BuildInPublicCard>
      <BuildInPublicCard
        cardKey="priority-one-thing"
        label={formatMessage(buildInPublicMessages.oneThingCard)}
        format="portrait"
        tone="dark"
        settings={settings}
        fields={fields}
        values={oneThing.values}
      >
        <BuildInPublicOrganization maxSize={13} />
        <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto text-[96px] leading-[0.9] text-(--card-strong)')}>1</p>
        <p className={cn(CARD_EYEBROW_CLASS_NAME, 'mt-3')}>{formatMessage(buildInPublicMessages.oneThingToday)}</p>
        <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-3 line-clamp-5 wrap-break-word text-[30px]/[1.12]')}>
          {oneThing.priority}
        </p>
        {oneThing.member?.user.displayName ? (
          <>
            <div className={cn(CARD_RULE_CLASS_NAME, 'mt-6 mb-4')} />
            {renderPerson(oneThing.member)}
          </>
        ) : null}
      </BuildInPublicCard>
    </BuildInPublicSection>
  )
}

export default BuildInPublicPriority
