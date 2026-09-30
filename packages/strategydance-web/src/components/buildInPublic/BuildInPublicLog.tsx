import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, LogEntry, OrganizationMember } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useLocalDate from '~hooks/common/useLocalDate'
import useLogAuthors from '~hooks/log/useLogAuthors'
import useMemberLatestLogEntries from '~hooks/log/useMemberLatestLogEntries'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import getOrganizationDayCount from '~utils/buildInPublic/getOrganizationDayCount'
import getRichTextSummary from '~utils/buildInPublic/getRichTextSummary'
import pickLogAuthor from '~utils/buildInPublic/pickLogAuthor'
import getDaysBetween from '~utils/date/getDaysBetween'
import toCalendarDate from '~utils/date/toCalendarDate'
import getMemberName from '~utils/team/getMemberName'

import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import BuildInPublicPerson from '~components/buildInPublic/BuildInPublicPerson'
import BuildInPublicSection from '~components/buildInPublic/BuildInPublicSection'
import {
  CARD_DISPLAY_CLASS_NAME,
  CARD_EYEBROW_CLASS_NAME,
  CARD_MUTED_CLASS_NAME,
} from '~components/buildInPublic/cardClassNames'
import FitText from '~components/buildInPublic/FitText'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

// The most entries a picker lists, newest first
const MAX_ENTRY_OPTIONS = 30

const TIMELINE_COUNTS = ['2', '3', '4']

/*
  The design system's rich text, restyled for a card: in the card's own colors on any tone, its
  marks and quote bars in the accent, cut off where the card ends
*/
const CARD_RICH_TEXT_CLASS_NAME = cn(
  'max-h-[180px] overflow-hidden text-base/[1.55] text-inherit',
  '[&_p]:mb-2.5 [&_h2]:text-2xl/[1.2] [&_h2]:text-inherit',
  '[&_blockquote]:border-(--card-mark) [&_blockquote]:text-(--card-quote) [&_li]:marker:text-(--card-mark)',
)

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
}

/*
  The log cards, from one author's latest entries in the team's log: one entry in full, a quote from
  one, the last few updates, and the day the organization is on. They show the reader's own log
  unless they pick a teammate who wrote in it, one pick for every card, so only that author's
  entries are read. A card is left out while its author has nothing for it
*/
function BuildInPublicLog({ settings }: Props) {
  const { formatMessage, formatDate } = useIntl()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  // The authors' names and pictures, without which no entry has anybody to show it under
  const { data: team, loading: isTeamLoading, refetch: refetchTeam, hasFailed: hasTeamFailed } = useOrganizationTeam()
  const today = useLocalDate()
  const {
    data: authorIds,
    loading: areAuthorsLoading,
    refetch: refetchAuthors,
    hasFailed: haveAuthorsFailed,
  } = useLogAuthors()

  const viewerId = viewer?.uid ?? ''
  // The pick every card showing somebody shares
  const { user: pickedId } = settings.readCard('log-entry', { user: viewerId })
  const {
    data: entries,
    loading,
    refetch,
    hasFailed,
  } = useMemberLatestLogEntries(pickLogAuthor(pickedId, authorIds, viewerId))
  const authors = team.userOrganizations.filter(member => authorIds.includes(member.user.id))
  // Whose entries are on screen, which are the last author's while another's are read
  const author = authors.find(member => member.user.id === entries[0]?.user.id) ?? null
  const dayCount = organization ? getOrganizationDayCount(organization.createdAt, today) : 1

  function formatDay(date: string) {
    const daysAgo = getDaysBetween(date, today)

    if (daysAgo === 0) return formatMessage(buildInPublicMessages.today)
    if (daysAgo === 1) return formatMessage(buildInPublicMessages.yesterday)

    return formatDate(toCalendarDate(date), { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }

  function formatShortDate(date: string) {
    return formatDate(toCalendarDate(date), { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }

  const teammateFields: CardField[] =
    authors.length > 1
      ? [
          {
            kind: 'select',
            key: 'user',
            label: formatMessage(buildInPublicMessages.teammate),
            options: authors.map(member => ({ value: member.user.id, label: getMemberName(member) })),
          },
        ]
      : []

  function entryField(
    key: string,
    label: string,
    choices: LogEntry[],
    describe: (entry: LogEntry) => string,
  ): CardField[] {
    if (choices.length < 2) return []

    return [
      {
        kind: 'select',
        key,
        label,
        options: choices.slice(0, MAX_ENTRY_OPTIONS).map(entry => ({
          value: entry.id,
          label: (
            <span className="block truncate">
              {formatMessage(buildInPublicMessages.entryOption, { day: formatDay(entry.date), text: describe(entry) })}
            </span>
          ),
        })),
      },
    ]
  }

  // An entry card: which of the author's entries, the newest unless another is picked
  function readEntryCard(cardKey: string, choose: (authored: LogEntry[]) => LogEntry[]) {
    const choices = choose(entries)
    const { entry: entryId } = settings.readCard(cardKey, { entry: choices[0]?.id ?? '' })
    const entry = choices.find(choice => choice.id === entryId) ?? choices[0] ?? null

    return { author, choices, entry, values: { user: author?.user.id ?? viewerId, entry: entry?.id ?? '' } }
  }

  const summaryOf = (entry: LogEntry) => getRichTextSummary(entry.content).text
  const quoteOf = (entry: LogEntry) => getRichTextSummary(entry.content).quote ?? ''

  const logEntry = readEntryCard('log-entry', authored => authored)
  const quote = readEntryCard('log-quote', authored =>
    authored.filter(entry => getRichTextSummary(entry.content).quote),
  )
  const counter = readEntryCard('log-day-counter', authored => authored)

  const { count: timelineCountValue } = settings.readCard('log-timeline', { count: '4' })
  const timelineCount = Math.min(
    TIMELINE_COUNTS.includes(timelineCountValue) ? Number(timelineCountValue) : 4,
    entries.length,
  )

  // A card is posted for anybody to see, so it names somebody only by the name they gave
  function renderPerson(member: OrganizationMember | null) {
    if (!member?.user.displayName) return null

    return (
      <BuildInPublicPerson
        name={member.user.displayName}
        imageUrl={member.user.imageUrl ?? null}
        jobTitle={member.jobTitle ?? null}
      />
    )
  }

  // The name as they gave it, since a first word is not a first name where the family name comes first
  const quoteAuthorName = quote.author?.user.displayName ?? null

  return (
    <BuildInPublicSection
      title={formatMessage(buildInPublicMessages.logTitle)}
      description={formatMessage(buildInPublicMessages.logDescription)}
      failure={
        hasFailed || haveAuthorsFailed || hasTeamFailed
          ? {
              message: formatMessage(buildInPublicMessages.logLoadFailed),
              isRetrying: loading || areAuthorsLoading || isTeamLoading,
              onRetry: () => {
                if (hasFailed) refetch()
                if (haveAuthorsFailed) refetchAuthors()
                if (hasTeamFailed) refetchTeam()
              },
            }
          : null
      }
    >
      {logEntry.entry ? (
        <BuildInPublicCard
          cardKey="log-entry"
          label={formatMessage(buildInPublicMessages.logEntryCard)}
          format="landscape"
          tone="white"
          settings={settings}
          fields={[
            ...teammateFields,
            ...entryField('entry', formatMessage(buildInPublicMessages.logEntryCard), logEntry.choices, summaryOf),
          ]}
          values={logEntry.values}
        >
          <div className="flex items-center justify-between gap-4">
            {renderPerson(logEntry.author)}
            <p className={cn(CARD_EYEBROW_CLASS_NAME, 'ml-auto')}>
              {formatMessage(buildInPublicMessages.logOn, { day: formatDay(logEntry.entry.date) })}
            </p>
          </div>
          <RichText
            value={logEntry.entry.content}
            className={cn(CARD_RICH_TEXT_CLASS_NAME, 'mt-5')}
          />
        </BuildInPublicCard>
      ) : null}
      {quote.entry ? (
        <BuildInPublicCard
          cardKey="log-quote"
          label={formatMessage(buildInPublicMessages.quoteCard)}
          format="square"
          tone="tint"
          settings={settings}
          fields={[
            ...teammateFields,
            ...entryField('entry', formatMessage(buildInPublicMessages.quoteCard), quote.choices, quoteOf),
          ]}
          values={quote.values}
        >
          <p
            aria-hidden="true"
            className={cn(CARD_DISPLAY_CLASS_NAME, 'h-11 text-[96px] leading-[0.7] text-(--card-strong)')}
          >
            “
          </p>
          <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-3 line-clamp-6 wrap-break-word text-[22px]/[1.25]')}>
            {quoteOf(quote.entry)}
          </p>
          {quoteAuthorName ? (
            <p className={cn(CARD_MUTED_CLASS_NAME, 'mt-auto mb-0 line-clamp-2 wrap-break-word text-xs font-medium')}>
              {formatMessage(buildInPublicMessages.fromLog, {
                // Cut short where it runs long, so the date after it always shows
                name: <span className="inline-block max-w-[60%] truncate align-bottom">{quoteAuthorName}</span>,
                date: formatShortDate(quote.entry.date),
              })}
            </p>
          ) : null}
        </BuildInPublicCard>
      ) : null}
      {timelineCount > 0 ? (
        <BuildInPublicCard
          cardKey="log-timeline"
          label={formatMessage(buildInPublicMessages.timelineCard)}
          format="portrait"
          tone="white"
          settings={settings}
          fields={[
            ...teammateFields,
            ...(entries.length > 2
              ? [
                  {
                    kind: 'select' as const,
                    key: 'count',
                    label: formatMessage(buildInPublicMessages.numberOfUpdates),
                    options: TIMELINE_COUNTS.map(count => ({
                      value: count,
                      label: formatMessage(buildInPublicMessages.updatesOption, { count: Number(count) }),
                    })),
                  },
                ]
              : []),
          ]}
          values={{ user: author?.user.id ?? viewerId, count: String(timelineCount) }}
        >
          <p className={CARD_EYEBROW_CLASS_NAME}>{formatMessage(buildInPublicMessages.buildLog)}</p>
          {/* On one line, shrinking where it runs long, as in Spanish, so four updates of two lines fit */}
          <FitText
            as="p"
            isDisplay
            max={26}
            min={20}
            lineHeight={1.12}
            className="mt-2"
          >
            {formatMessage(buildInPublicMessages.lastUpdates, { count: timelineCount })}
          </FitText>
          {/* Spaced from here rather than below the heading, whose margin its fit takes over */}
          <ol className="m-0 mt-5 flex list-none flex-col p-0">
            {entries.slice(0, timelineCount).map((entry, index) => (
              <li
                key={entry.id}
                className="relative grid grid-cols-[20px_minmax(0,1fr)] pb-3 last:pb-0"
              >
                {index < timelineCount - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-3.5 -bottom-0.5 left-[3.5px] w-px bg-[color-mix(in_srgb,currentColor_18%,transparent)]"
                  />
                ) : null}
                <span className="mt-1 size-2 rounded-full bg-(--card-mark)" />
                <div className="min-w-0">
                  <span
                    className={cn(CARD_MUTED_CLASS_NAME, 'block text-[11px] font-semibold tracking-wider uppercase')}
                  >
                    {formatDay(entry.date)}
                  </span>
                  <span className="mt-0.5 line-clamp-2 wrap-break-word text-[13px] leading-[1.45]">
                    {summaryOf(entry)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </BuildInPublicCard>
      ) : null}
      {counter.entry ? (
        <BuildInPublicCard
          cardKey="log-day-counter"
          label={formatMessage(buildInPublicMessages.dayCounterCard)}
          format="square"
          tone="dark"
          settings={settings}
          fields={[
            ...teammateFields,
            ...entryField('entry', formatMessage(buildInPublicMessages.logEntryCard), counter.choices, summaryOf),
          ]}
          values={counter.values}
        >
          <FitText
            as="p"
            max={11}
            min={10}
            lines={2}
            lineHeight={1.35}
            className={CARD_EYEBROW_CLASS_NAME}
          >
            {formatMessage(buildInPublicMessages.buildingInPublic, { organization: organization?.name ?? '' })}
          </FitText>
          <p className="m-0 mt-auto flex items-baseline gap-3">
            {formatMessage(buildInPublicMessages.dayCounter, {
              count: dayCount,
              word: (chunks: ReactNode[]) => (
                <span className={cn(CARD_DISPLAY_CLASS_NAME, 'text-[28px]/[1.12]')}>{chunks}</span>
              ),
              number: (chunks: ReactNode[]) => (
                <span className={cn(CARD_DISPLAY_CLASS_NAME, 'text-[112px] leading-[0.9] text-(--card-strong)')}>
                  {chunks}
                </span>
              ),
            })}
          </p>
          <p className={cn(CARD_MUTED_CLASS_NAME, 'mt-4 mb-0 line-clamp-3 wrap-break-word text-[15px] leading-[1.5]')}>
            {summaryOf(counter.entry)}
          </p>
        </BuildInPublicCard>
      ) : null}
    </BuildInPublicSection>
  )
}

export default BuildInPublicLog
