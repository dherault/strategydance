import type { PropsWithChildren } from 'react'

import useActivityDays from '~hooks/buildInPublic/useActivityDays'

import Loading from '~components/common/Loading'

/*
  Holds the build in public page until its first reads land, every one started here at once, so
  they fetch side by side and the page appears whole. `initialLoading` rather than `loading`, so a
  refetch on focus does not blank the page
*/
function BuildInPublicWait({ children }: PropsWithChildren) {
  const { initialLoading: areActivityDaysLoading } = useActivityDays()

  if (areActivityDaysLoading) return <Loading source="BuildInPublicWait" />

  return children
}

export default BuildInPublicWait
