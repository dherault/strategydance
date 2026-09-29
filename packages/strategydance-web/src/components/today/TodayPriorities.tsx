import { EyeIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'
import { cn } from 'strategydance-design-system/lib/utils'

import type { TodayPreferences } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'
import useTodayPreferences from '~hooks/today/useTodayPreferences'

import getPriorityColumnCount from '~utils/today/getPriorityColumnCount'
import sortByPriorityOrder from '~utils/today/sortByPriorityOrder'

import PageSection from '~components/layout/PageSection'
import PriorityVisibilityDialog from '~components/today/PriorityVisibilityDialog'
import TodayPriorityCard from '~components/today/TodayPriorityCard'
import TodaySectionLoadFailed from '~components/today/TodaySectionLoadFailed'
import TopPriorityDialog from '~components/today/TopPriorityDialog'

import todayMessages from '~data/intl/messages/today'

// Literal classes, which Tailwind can find: the columns a count calls for, narrowed as the
// section does, to two under 800px and one under 560px
const GRID_COLUMNS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 @min-[560px]:grid-cols-2',
  3: 'grid-cols-1 @min-[560px]:grid-cols-2 @min-[800px]:grid-cols-3',
}

/*
  The one thing each teammate is moving forward, the reader's first and editable, in the order and
  with the people the reader chose. Kept live by the team's query, so a teammate's new priority
  lands without a reload
*/
function TodayPriorities() {
  const { formatMessage } = useIntl()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const { data: team, hasFailed: hasTeamFailed, loading: isTeamLoading, refetch: refetchTeam } = useOrganizationTeam()
  const {
    data: preferences,
    hasFailed: havePreferencesFailed,
    loading: arePreferencesLoading,
    refetch: refetchPreferences,
    update: updatePreferences,
  } = useTodayPreferences()

  const [isEditing, setIsEditing] = useState(false)
  const [isArranging, setIsArranging] = useState(false)

  const viewerId = viewer?.uid ?? null
  const members = sortByPriorityOrder(team.userOrganizations, preferences.priorityOrder)
  const visibleMembers = members.filter(
    ({ user }) => user.id === viewerId || !preferences.hiddenPriorities.includes(user.id),
  )
  const viewerMember = members.find(({ user }) => user.id === viewerId)
  const hasFailed = hasTeamFailed || havePreferencesFailed

  async function saveArrangement(next: TodayPreferences) {
    setIsArranging(false)

    const isUnchanged =
      next.priorityOrder.join() === members.map(({ user }) => user.id).join()
      && [...next.hiddenPriorities].sort().join()
        === preferences.hiddenPriorities
          .filter(userId => userId !== viewerId)
          .sort()
          .join()

    if (isUnchanged) return

    try {
      await updatePreferences(next)
    } catch (error) {
      console.error('Failed to save the priorities view', error)

      toast.error(formatMessage(todayMessages.visibilityError))
    }
  }

  async function retry() {
    await Promise.all([hasTeamFailed ? refetchTeam() : null, havePreferencesFailed ? refetchPreferences() : null])
  }

  return (
    <PageSection
      title={formatMessage(todayMessages.prioritiesTitle, { count: visibleMembers.length })}
      description={formatMessage(todayMessages.prioritiesDescription)}
      actions={
        hasFailed ? null : (
          <Tooltip
            content={formatMessage(todayMessages.arrangePriorities)}
            delay={300}
          >
            <Button
              variant="transparent"
              size="sm"
              icon={<EyeIcon />}
              aria-label={formatMessage(todayMessages.arrangePrioritiesLabel, {
                visible: visibleMembers.length,
                total: members.length,
              })}
              onClick={() => setIsArranging(true)}
            />
          </Tooltip>
        )
      }
    >
      {hasFailed ? (
        <TodaySectionLoadFailed
          message={formatMessage(todayMessages.prioritiesLoadError)}
          isRetrying={isTeamLoading || arePreferencesLoading}
          onRetry={retry}
        />
      ) : (
        <div className="@container">
          <ul
            className={cn('m-0 grid list-none gap-4 p-0', GRID_COLUMNS[getPriorityColumnCount(visibleMembers.length)])}
          >
            {visibleMembers.map(member => (
              <li
                key={member.user.id}
                className="flex min-w-0 [&>*]:flex-1"
              >
                <TodayPriorityCard
                  member={member}
                  isViewer={member.user.id === viewerId}
                  onEdit={() => setIsEditing(true)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {organization && viewerId && isEditing ? (
        <TopPriorityDialog
          organizationId={organization.id}
          viewerId={viewerId}
          topPriority={viewerMember?.topPriority ?? null}
          onClose={() => setIsEditing(false)}
        />
      ) : null}
      {viewerId && isArranging ? (
        <PriorityVisibilityDialog
          members={members}
          hiddenPriorities={preferences.hiddenPriorities}
          viewerId={viewerId}
          onClose={saveArrangement}
        />
      ) : null}
    </PageSection>
  )
}

export default TodayPriorities
