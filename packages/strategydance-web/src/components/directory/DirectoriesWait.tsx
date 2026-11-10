import type { PropsWithChildren } from 'react'

import useDirectories from '~hooks/directory/useDirectories'
import useDirectoryStates from '~hooks/directory/useDirectoryStates'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import Loading from '~components/common/Loading'

/*
  Holds the Directories page until its first reads land: the release's directories, downloaded
  apart, and what the organization keeps of them, both started here at once so they fetch side by
  side. `initialLoading` rather than `loading`, since the live query writes over the page while
  somebody is looking at it.

  It keeps the team's live query open too, without waiting for it, as every page reading the
  organization's data does, since its pushes tell the app the reader was removed or the
  organization deleted
*/
function DirectoriesWait({ children }: PropsWithChildren) {
  const { initialLoading: areDirectoriesLoading } = useDirectories()
  const { initialLoading: areStatesLoading } = useDirectoryStates()

  useOrganizationTeam()

  if (areDirectoriesLoading || areStatesLoading) return <Loading source="DirectoriesWait" />

  return children
}

export default DirectoriesWait
