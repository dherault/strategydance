import { useState } from 'react'
import { OrganizationRole } from 'strategydance-database/web'

import type { OrganizationMember } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import BanMemberDialog from '~components/team/BanMemberDialog'
import EditJobTitleDialog from '~components/team/EditJobTitleDialog'
import InviteMembersDialog from '~components/team/InviteMembersDialog'
import TeamHeader from '~components/team/TeamHeader'
import TeamNoOrganization from '~components/team/TeamNoOrganization'
import TeamTable from '~components/team/TeamTable'

/*
  The current organization's people: who they are, what they do, and what they may do here.

  Whether the reader administers the organization is read off their own row in the team rather
  than off their memberships, so the page and the rows it draws always agree, even in the moment
  between the live team query arriving and the memberships catching up.

  The dialogs are mounted only while open, each around the member it acts on
*/
function Team() {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()
  const { data: team } = useOrganizationTeam()

  const [isInviting, setIsInviting] = useState(false)
  const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null)
  const [banningMember, setBanningMember] = useState<OrganizationMember | null>(null)

  const viewerId = viewer?.uid ?? null
  const viewerRole = team.userOrganizations.find(({ user }) => user.id === viewerId)?.role ?? null
  const isAdministrator = viewerRole === OrganizationRole.ADMINISTRATOR

  return (
    <div className="flex max-w-[1024px] flex-col gap-8 px-2 pt-5 pb-12">
      <TeamHeader
        organizationName={organization?.name ?? null}
        memberCount={team.userOrganizations.length}
        invitationCount={team.organizationInvitations.length}
        onInvite={organization && isAdministrator ? () => setIsInviting(true) : null}
      />
      {organization
        ? (
            <TeamTable
              organizationId={organization.id}
              team={team}
              viewerId={viewerId}
              isAdministrator={isAdministrator}
              onEditJobTitle={setEditingMember}
              onBan={setBanningMember}
            />
          )
        : <TeamNoOrganization />}
      {organization && isInviting
        ? (
            <InviteMembersDialog
              organizationId={organization.id}
              organizationName={organization.name}
              memberEmails={team.userOrganizations.map(({ user }) => user.email)}
              invitedEmails={team.organizationInvitations.map(({ email }) => email)}
              onClose={() => setIsInviting(false)}
            />
          )
        : null}
      {organization && editingMember
        ? (
            <EditJobTitleDialog
              organizationId={organization.id}
              organizationName={organization.name}
              member={editingMember}
              isViewer={editingMember.user.id === viewerId}
              onClose={() => setEditingMember(null)}
            />
          )
        : null}
      {organization && banningMember
        ? (
            <BanMemberDialog
              organizationId={organization.id}
              organizationName={organization.name}
              member={banningMember}
              onClose={() => setBanningMember(null)}
            />
          )
        : null}
    </div>
  )
}

export default Team
