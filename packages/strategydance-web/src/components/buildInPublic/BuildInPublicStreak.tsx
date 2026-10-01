import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, FlameColor } from '~types'

import useActivityDays from '~hooks/buildInPublic/useActivityDays'
import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useLocalDate from '~hooks/common/useLocalDate'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useUser from '~hooks/user/useUser'

import getOrganizationDayCount from '~utils/buildInPublic/getOrganizationDayCount'
import getStreak from '~utils/buildInPublic/getStreak'
import getStreakDayLabel from '~utils/buildInPublic/getStreakDayLabel'
import getStreakDays from '~utils/buildInPublic/getStreakDays'
import getDaysBetween from '~utils/date/getDaysBetween'
import toCalendarDate from '~utils/date/toCalendarDate'

import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import BuildInPublicFlame from '~components/buildInPublic/BuildInPublicFlame'
import BuildInPublicOrganization from '~components/buildInPublic/BuildInPublicOrganization'
import BuildInPublicPerson from '~components/buildInPublic/BuildInPublicPerson'
import BuildInPublicSection from '~components/buildInPublic/BuildInPublicSection'
import BuildInPublicWeekFlames from '~components/buildInPublic/BuildInPublicWeekFlames'
import {
  CARD_DISPLAY_CLASS_NAME,
  CARD_EYEBROW_CLASS_NAME,
  CARD_MUTED_CLASS_NAME,
  CARD_RULE_CLASS_NAME,
} from '~components/buildInPublic/cardClassNames'
import FitText from '~components/buildInPublic/FitText'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

// How far back "Active days" looks, or since the organization was made when that is sooner
const ACTIVE_DAYS_WINDOW = 30

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
}

/*
  The streak cards: how many days in a row the reader has changed something of theirs on the Today
  page, their week, and the last five. A day counts from its first change, and today not counting
  yet leaves the streak where it was until the day is over: see `getStreak`
*/
function BuildInPublicStreak({ settings }: Props) {
  const intl = useIntl()
  const { formatMessage, formatDate, formatDateTimeRange } = intl
  const { organization, jobTitle } = useCurrentOrganization()
  const { data: user } = useUser()
  const { data: dates, loading, refetch, hasFailed } = useActivityDays()
  const today = useLocalDate()

  const organizationName = organization?.name ?? ''
  const { current, best } = getStreak(dates, today)
  const isLit = current > 0
  const week = getStreakDays(dates, today, 1)
  const calendar = getStreakDays(dates, today, 5)
  const activeDaysWindow = Math.min(
    ACTIVE_DAYS_WINDOW,
    organization ? getOrganizationDayCount(organization.createdAt, today) : ACTIVE_DAYS_WINDOW,
  )
  const activeDayCount = dates.filter(date => date <= today && getDaysBetween(date, today) < activeDaysWindow).length
  // A card is posted for anybody to see, so it names the reader only by the name they gave
  const name = user?.displayName ?? null

  const flameField: CardField = {
    kind: 'select',
    key: 'flame',
    label: formatMessage(buildInPublicMessages.flameColor),
    options: [
      { value: 'organization', label: formatMessage(buildInPublicMessages.companyColor) },
      { value: 'warm', label: formatMessage(buildInPublicMessages.flameWarm) },
    ],
  }

  function readFlame(cardKey: string) {
    const { flame } = settings.readCard(cardKey, { flame: 'organization' })
    const flameColor: FlameColor = flame === 'warm' ? 'warm' : 'organization'

    return { values: { flame: flameColor }, flameColor }
  }

  const flame = readFlame('streak-flame')
  const thisWeek = readFlame('streak-week')
  const poster = readFlame('streak-poster')
  const calendarFlame = readFlame('streak-calendar')

  function formatWeekday(date: string) {
    return formatDate(toCalendarDate(date), { weekday: 'narrow', timeZone: 'UTC' })
  }

  return (
    <BuildInPublicSection
      title={formatMessage(buildInPublicMessages.streakTitle)}
      description={formatMessage(buildInPublicMessages.streakDescription)}
      failure={
        hasFailed
          ? { message: formatMessage(buildInPublicMessages.streakLoadFailed), isRetrying: loading, onRetry: refetch }
          : null
      }
    >
      <BuildInPublicCard
        cardKey="streak-flame"
        label={formatMessage(buildInPublicMessages.flameCard)}
        format="square"
        tone="accent"
        settings={settings}
        fields={[flameField]}
        values={flame.values}
        flameColor={flame.flameColor}
      >
        <FitText
          as="p"
          max={11}
          min={10}
          lines={2}
          lineHeight={1.35}
          className={CARD_EYEBROW_CLASS_NAME}
        >
          {formatMessage(buildInPublicMessages.buildingInPublic, { organization: organizationName })}
        </FitText>
        <div className="mt-auto flex items-end gap-3">
          <BuildInPublicFlame
            size={96}
            isLit={isLit}
            className="text-(--flame-off)"
          />
          <p className={cn(CARD_DISPLAY_CLASS_NAME, 'text-[112px] leading-[0.82]')}>{current}</p>
        </div>
        <p className="mt-3.5 mb-0 text-base font-medium">
          {formatMessage(buildInPublicMessages.dayStreak, { count: current })}
        </p>
        <div className={cn(CARD_RULE_CLASS_NAME, 'mt-5 mb-4')} />
        <BuildInPublicWeekFlames
          days={week}
          size={20}
          className="gap-1"
        />
      </BuildInPublicCard>
      <BuildInPublicCard
        cardKey="streak-week"
        label={formatMessage(buildInPublicMessages.weekCard)}
        format="landscape"
        tone="white"
        isFlush
        settings={settings}
        fields={[flameField]}
        values={thisWeek.values}
        flameColor={thisWeek.flameColor}
      >
        <div className="grid h-full grid-cols-[192px_minmax(0,1fr)]">
          <div
            className={cn(
              'flex flex-col p-7',
              thisWeek.flameColor === 'warm'
                ? 'bg-(--flame-background) text-(--flame-foreground)'
                : 'bg-(--card-panel)',
            )}
          >
            <BuildInPublicFlame
              size={64}
              isLit={isLit}
              className="text-(--flame-off)"
            />
            {/* Shrinks past two digits, which the panel is as wide as */}
            <FitText
              as="p"
              isDisplay
              max={104}
              min={48}
              lineHeight={0.85}
              className={cn('mt-auto', thisWeek.flameColor !== 'warm' && 'text-(--card-strong)')}
            >
              {current}
            </FitText>
            <p className="mt-2.5 mb-0 text-[15px] font-medium">
              {formatMessage(buildInPublicMessages.dayStreak, { count: current })}
            </p>
          </div>
          <div className="flex min-w-0 flex-col px-7 pt-7 pb-11">
            {/* The week wraps rather than leaving the name no room, as its range runs long in French */}
            <div className="flex items-center justify-between gap-4">
              <BuildInPublicOrganization
                maxSize={15}
                lineHeight={1.2}
              />
              <p className={cn(CARD_EYEBROW_CLASS_NAME, 'max-w-[55%] text-right text-balance whitespace-normal')}>
                {formatMessage(buildInPublicMessages.thisWeek, {
                  range: formatDateTimeRange(toCalendarDate(week[0].date), toCalendarDate(week[6].date), {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  }),
                })}
              </p>
            </div>
            <BuildInPublicWeekFlames
              days={week}
              size={34}
              className="mt-6 gap-2"
              letterClassName="text-xs"
            />
            <div className="mt-auto grid grid-cols-2">
              {[
                {
                  label: formatMessage(buildInPublicMessages.bestStreak),
                  value: formatMessage(buildInPublicMessages.days, { count: best }),
                },
                {
                  label: formatMessage(buildInPublicMessages.activeDays),
                  value: formatMessage(buildInPublicMessages.activeDaysCount, {
                    count: activeDayCount,
                    total: activeDaysWindow,
                  }),
                },
              ].map((stat, index) => (
                <div
                  key={stat.label}
                  className={cn(
                    'flex flex-col gap-2',
                    index ? 'border-l border-[color-mix(in_srgb,currentColor_18%,transparent)] px-4' : 'pr-4',
                  )}
                >
                  <p className={cn(CARD_MUTED_CLASS_NAME, 'm-0 text-xs font-medium whitespace-nowrap')}>{stat.label}</p>
                  <p className={cn(CARD_DISPLAY_CLASS_NAME, 'text-2xl leading-none')}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BuildInPublicCard>
      <BuildInPublicCard
        cardKey="streak-poster"
        label={formatMessage(buildInPublicMessages.posterCard)}
        format="portrait"
        tone="dark"
        settings={settings}
        fields={[flameField]}
        values={poster.values}
        flameColor={poster.flameColor}
      >
        <BuildInPublicOrganization maxSize={13} />
        <div className="mt-auto flex flex-col items-center text-center">
          <BuildInPublicFlame
            size={112}
            isLit={isLit}
            className="text-(--flame-off)"
          />
          <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-3 text-[96px] leading-[0.9]')}>{current}</p>
          <p className={cn(CARD_EYEBROW_CLASS_NAME, 'mt-2.5')}>
            {formatMessage(buildInPublicMessages.daysInARow, { count: current })}
          </p>
        </div>
        <div className={cn(CARD_RULE_CLASS_NAME, 'mt-auto mb-4')} />
        {name ? (
          <BuildInPublicPerson
            name={name}
            imageUrl={user?.imageUrl ?? null}
            jobTitle={jobTitle}
          />
        ) : null}
      </BuildInPublicCard>
      <BuildInPublicCard
        cardKey="streak-calendar"
        label={formatMessage(buildInPublicMessages.calendarCard)}
        format="square"
        tone="white"
        settings={settings}
        fields={[flameField]}
        values={calendarFlame.values}
        flameColor={calendarFlame.flameColor}
      >
        <div className="flex items-center gap-2">
          <BuildInPublicFlame
            size={22}
            isLit={isLit}
            className="text-(--flame-off)"
          />
          {/* The two share the line, the streak shrinking to what the name leaves it, as it runs long
              in Portuguese or French, rather than squeezing the name out */}
          <FitText
            as="p"
            isDisplay
            max={22}
            min={13}
            lineHeight={1}
            className="flex-1"
          >
            {formatMessage(buildInPublicMessages.streakDays, { count: current })}
          </FitText>
          <BuildInPublicOrganization
            maxSize={15}
            lineHeight={1.2}
            className="max-w-[45%] flex-none"
          />
        </div>
        <div className="mt-auto grid grid-cols-7 gap-1.5">
          {week.map(day => (
            <span
              key={`weekday-${day.date}`}
              aria-hidden="true"
              className={cn(CARD_MUTED_CLASS_NAME, 'mb-0.5 text-center text-[10px] font-semibold')}
            >
              {formatWeekday(day.date)}
            </span>
          ))}
          {calendar.map(day => (
            <span
              key={day.date}
              role="img"
              aria-label={getStreakDayLabel(intl, day)}
              className={cn(
                'grid aspect-square place-items-center rounded-[2px]',
                day.isFuture
                  ? 'shadow-[inset_0_0_0_1px_var(--card-square)]'
                  : day.isOn
                    ? 'bg-(--flame-background)'
                    : 'bg-(--card-square)',
                day.isToday && 'shadow-[inset_0_0_0_1.5px_var(--flame-outer)]',
              )}
            >
              {day.isOn ? <BuildInPublicFlame size={16} /> : null}
            </span>
          ))}
        </div>
      </BuildInPublicCard>
    </BuildInPublicSection>
  )
}

export default BuildInPublicStreak
