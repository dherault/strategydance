import { useState } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

/*
  Whose a section of the Today page shows: the reader's own to begin with, and any teammate's once
  picked, which the section keeps to itself. A teammate who leaves while picked falls back to the
  reader's own, as does a team that could not be read
*/
function useTodayOwner() {
  const { data: viewer } = useAuthentication()
  const { data: team } = useOrganizationTeam()

  const viewerId = viewer?.uid ?? null
  const [pickedUserId, setPickedUserId] = useState(viewerId)

  const ownerId = team.userOrganizations.some(({ user }) => user.id === pickedUserId) ? pickedUserId : viewerId

  return {
    ownerId,
    isOwn: ownerId === viewerId,
    pickOwner: setPickedUserId,
  }
}

export default useTodayOwner
