import type { PropsWithChildren } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useActivityDays from '~hooks/buildInPublic/useActivityDays'
import useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useChecklist from '~hooks/checklist/useChecklist'
import useRecentChecklistTicks from '~hooks/checklist/useRecentChecklistTicks'
import useLogAuthors from '~hooks/log/useLogAuthors'
import useMemberLatestLogEntries from '~hooks/log/useMemberLatestLogEntries'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import pickLogAuthor from '~utils/buildInPublic/pickLogAuthor'

import Loading from '~components/common/Loading'

/*
  Holds the build in public page until its first reads land, every one started here at once, so
  they fetch side by side and the page appears whole. The log cards' author is resolved as the log
  section resolves it, from the reader's pick and who has written, so the entries waited on are the
  ones the page opens with; the reader's own are read beside them for the recap. `initialLoading`
  rather than `loading`, so a refetch on focus does not blank the page
*/
function BuildInPublicWait({ children }: PropsWithChildren) {
  const { data: viewer } = useAuthentication()
  const viewerId = viewer?.uid ?? null
  const { readCard } = useBuildInPublicSettings()
  const { user: pickedId } = readCard('log-entry', { user: viewerId ?? '' })
  const { initialLoading: areActivityDaysLoading } = useActivityDays()
  const { initialLoading: isTeamLoading } = useOrganizationTeam()
  const { initialLoading: isChecklistLoading } = useChecklist(viewerId)
  const { initialLoading: areTicksLoading } = useRecentChecklistTicks()
  const { data: authorIds, initialLoading: areAuthorsLoading } = useLogAuthors()
  const { initialLoading: isAuthorLogLoading } = useMemberLatestLogEntries(pickLogAuthor(pickedId, authorIds, viewerId))
  const { initialLoading: isOwnLogLoading } = useMemberLatestLogEntries(viewerId)

  if (
    areActivityDaysLoading
    || isTeamLoading
    || isChecklistLoading
    || areTicksLoading
    || areAuthorsLoading
    || isAuthorLogLoading
    || isOwnLogLoading
  ) {
    return <Loading source="BuildInPublicWait" />
  }

  return children
}

export default BuildInPublicWait
