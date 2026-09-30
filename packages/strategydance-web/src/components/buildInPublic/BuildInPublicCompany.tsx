import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Avatar, AvatarGroup } from 'strategydance-design-system/components/ui/Avatar'
import { cn } from 'strategydance-design-system/lib/utils'

import useAuthentication from '~hooks/authentication/useAuthentication'
import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useChecklist from '~hooks/checklist/useChecklist'
import useLocalDate from '~hooks/common/useLocalDate'
import useMemberLatestLogEntries from '~hooks/log/useMemberLatestLogEntries'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import getOrganizationDayCount from '~utils/buildInPublic/getOrganizationDayCount'
import addDays from '~utils/date/addDays'
import toCalendarDate from '~utils/date/toCalendarDate'
import getMemberName from '~utils/team/getMemberName'

import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import BuildInPublicLogo from '~components/buildInPublic/BuildInPublicLogo'
import BuildInPublicSection from '~components/buildInPublic/BuildInPublicSection'
import {
  CARD_DISPLAY_CLASS_NAME,
  CARD_EYEBROW_CLASS_NAME,
  CARD_MUTED_CLASS_NAME,
} from '~components/buildInPublic/cardClassNames'
import FitText from '~components/buildInPublic/FitText'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

// As many large avatars, overlapping, as the square card's width holds: 40px each, 28px apart
const MAX_TEAM_AVATARS = 9

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
}

/*
  The company cards: the organization's profile, its team, and a recap of the reader's day, their
  priority beside how many checklist ticks and log entries their last seven days hold
*/
function BuildInPublicCompany({ settings }: Props) {
  const { formatMessage, formatDate } = useIntl()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const { data: team, loading: isTeamLoading, refetch: refetchTeam, hasFailed: hasTeamFailed } = useOrganizationTeam()
  const today = useLocalDate()
  const viewerId = viewer?.uid ?? null
  // The recap counts the week's ticks and entries from these, so neither may fail quietly into a 0
  const {
    data: checklist,
    loading: isChecklistLoading,
    refetch: refetchChecklist,
    hasFailed: hasChecklistFailed,
  } = useChecklist(viewerId)
  const {
    data: logEntries,
    loading: isLogLoading,
    refetch: refetchLog,
    hasFailed: hasLogFailed,
  } = useMemberLatestLogEntries(viewerId)
  const [failedBannerUrl, setFailedBannerUrl] = useState<string | null>(null)

  const name = organization?.name ?? ''
  const logoUrl = organization?.logoUrl ?? null
  const bannerUrl = organization?.bannerUrl ?? null
  const members = team.userOrganizations
  const dayCount = organization ? getOrganizationDayCount(organization.createdAt, today) : 1
  const weekStart = addDays(today, -6)

  const { members: pickedIds } = settings.readCard('company-team', {
    members: members.slice(0, MAX_TEAM_AVATARS).map(member => member.user.id),
  })
  const pickedMembers = members.filter(member => pickedIds.includes(member.user.id)).slice(0, MAX_TEAM_AVATARS)
  const shownMembers = pickedMembers.length ? pickedMembers : members.slice(0, MAX_TEAM_AVATARS)

  const viewerMember = members.find(member => member.user.id === viewerId)
  // Left out rather than standing in for, since a card is posted for anybody to see
  const priority = viewerMember?.topPriority || null
  const weekChecks = checklist.checklistItems.reduce(
    (sum, item) =>
      sum + item.completions.filter(completion => completion.date >= weekStart && completion.date <= today).length,
    0,
  )
  const weekLogs = logEntries.filter(
    entry => entry.user.id === viewerId && entry.date >= weekStart && entry.date <= today,
  ).length

  return (
    <BuildInPublicSection
      title={formatMessage(buildInPublicMessages.companyTitle)}
      description={formatMessage(buildInPublicMessages.companyDescription)}
      failure={
        hasTeamFailed || hasChecklistFailed || hasLogFailed
          ? {
              message: formatMessage(buildInPublicMessages.companyLoadFailed),
              isRetrying: isTeamLoading || isChecklistLoading || isLogLoading,
              onRetry: () => {
                if (hasTeamFailed) refetchTeam()
                if (hasChecklistFailed) refetchChecklist()
                if (hasLogFailed) refetchLog()
              },
            }
          : null
      }
    >
      <BuildInPublicCard
        cardKey="company-profile"
        label={formatMessage(buildInPublicMessages.profileCard)}
        format="landscape"
        tone="white"
        isFlush
        settings={settings}
      >
        {/* The banner over the accent, which shows wherever the banner does not */}
        <div className="relative h-[136px] flex-none bg-(--card-accent)">
          {bannerUrl && bannerUrl !== failedBannerUrl ? (
            <img
              src={bannerUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
              onError={() => setFailedBannerUrl(bannerUrl)}
            />
          ) : null}
        </div>
        {/* Down to just above the address, so a name of two lines and a brief of two fit */}
        <div className="flex min-h-0 flex-1 flex-col px-7 pb-8">
          {/* Positioned, so its white frame is drawn over the banner it overlaps rather than under it */}
          <div className="relative -mt-9 self-start rounded-xs bg-white p-[3px]">
            <BuildInPublicLogo
              name={name}
              logoUrl={logoUrl}
              size={72}
            />
          </div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <FitText
              as="p"
              max={30}
              min={22}
              lines={2}
              lineHeight={1.12}
              isDisplay
            >
              {name}
            </FitText>
            <p className={cn(CARD_EYEBROW_CLASS_NAME, 'pb-1.5')}>
              {formatMessage(buildInPublicMessages.dayNumber, { count: dayCount })}
            </p>
          </div>
          <p
            className={cn(
              CARD_MUTED_CLASS_NAME,
              'mt-1.5 mb-0 line-clamp-2 flex-none wrap-break-word text-sm leading-[1.5]',
            )}
          >
            {organization?.brief || formatMessage(buildInPublicMessages.teamBrief, { count: members.length })}
          </p>
        </div>
      </BuildInPublicCard>
      <BuildInPublicCard
        cardKey="company-team"
        label={formatMessage(buildInPublicMessages.teamCard)}
        format="square"
        tone="accent"
        settings={settings}
        fields={
          members.length > 1
            ? [
                {
                  kind: 'multiSelect',
                  key: 'members',
                  label: formatMessage(buildInPublicMessages.members),
                  max: MAX_TEAM_AVATARS,
                  options: members.map(member => ({ value: member.user.id, label: getMemberName(member) })),
                },
              ]
            : []
        }
        values={{ members: shownMembers.map(member => member.user.id) }}
      >
        <BuildInPublicLogo
          name={name}
          logoUrl={logoUrl}
          size={56}
        />
        <FitText
          as="p"
          max={34}
          min={24}
          lines={2}
          lineHeight={1.12}
          isDisplay
          className="mt-5"
        >
          {name}
        </FitText>
        <p className="mt-1.5 mb-0 text-sm font-medium">
          {formatMessage(buildInPublicMessages.teamDay, { count: members.length, day: dayCount })}
        </p>
        <AvatarGroup className="mt-auto">
          {shownMembers.map(member => (
            <Avatar
              key={member.user.id}
              src={member.user.imageUrl ?? undefined}
              name={member.user.displayName ?? ''}
              size="lg"
            />
          ))}
        </AvatarGroup>
      </BuildInPublicCard>
      <BuildInPublicCard
        cardKey="company-recap"
        label={formatMessage(buildInPublicMessages.recapCard)}
        format="landscape"
        tone="white"
        settings={settings}
      >
        <div className="flex items-center gap-2.5">
          <BuildInPublicLogo
            name={name}
            logoUrl={logoUrl}
            size={28}
          />
          <FitText
            max={14}
            min={11}
            className="flex-1 font-semibold"
          >
            {name}
          </FitText>
          <p className={CARD_EYEBROW_CLASS_NAME}>
            {formatDate(toCalendarDate(today), { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}
          </p>
        </div>
        <div className={cn('mt-auto grid min-h-[170px]', priority ? 'grid-cols-[1.5fr_1fr_1fr]' : 'grid-cols-2')}>
          {priority ? (
            <div className="flex min-w-0 flex-col gap-3 pr-5">
              <p className={CARD_EYEBROW_CLASS_NAME}>{formatMessage(buildInPublicMessages.priorityTitle)}</p>
              <p className={cn(CARD_DISPLAY_CLASS_NAME, 'line-clamp-5 wrap-break-word text-[22px]/[1.2]')}>
                {priority}
              </p>
            </div>
          ) : null}
          {[
            {
              label: formatMessage(buildInPublicMessages.checklistTitle),
              count: weekChecks,
              words: formatMessage(buildInPublicMessages.tasksDoneThisWeek, { count: weekChecks }),
            },
            {
              label: formatMessage(buildInPublicMessages.logTitle),
              count: weekLogs,
              words: formatMessage(buildInPublicMessages.updatesThisWeek, { count: weekLogs }),
            },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                'flex min-w-0 flex-col gap-3 px-5',
                // The first opens the card's row when there is no priority before it to set it apart from
                priority || index > 0 ? 'border-l border-[color-mix(in_srgb,currentColor_18%,transparent)]' : 'pl-0',
              )}
            >
              <p className={CARD_EYEBROW_CLASS_NAME}>{stat.label}</p>
              <div>
                <p className={cn(CARD_DISPLAY_CLASS_NAME, 'text-[56px] leading-none text-(--card-strong)')}>
                  {stat.count}
                </p>
                <p className={cn(CARD_MUTED_CLASS_NAME, 'mt-1.5 mb-0 text-[13px]')}>{stat.words}</p>
              </div>
            </div>
          ))}
        </div>
      </BuildInPublicCard>
    </BuildInPublicSection>
  )
}

export default BuildInPublicCompany
