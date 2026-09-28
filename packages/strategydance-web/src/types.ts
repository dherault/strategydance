import type { Locale } from 'strategydance-core'
import type { GetAdministrationOrganizationsData, GetAdministrationUsersData, GetChecklistData, GetCurrentUserData, GetCurrentUserOrganizationsData, GetOrganizationInvitationData, GetOrganizationLogData, GetOrganizationTeamData, GetTaskListsData, GetTasksData, GetTodayPreferencesData } from 'strategydance-database/web'

import type { MESSAGE_TYPES } from '~constants'

export type MessageType = typeof MESSAGE_TYPES[number]

/*
  The shape every context that owns remote data exposes, so a consumer reads the same four
  names whichever one it is holding.

  `initialLoading` is true only until the first answer lands; `loading` is true whenever one is
  in flight, including a refetch over data already on screen. A waiter reads `loading`, and a
  screen that wants to keep showing what it has while it refreshes reads `initialLoading`
*/
export type DataSource<Data> = {
  data: Data
  initialLoading: boolean
  loading: boolean
  refetch: () => Promise<void>
}

/*
  The reader's row in Postgres, as opposed to the Firebase account in
  `AuthenticationContext`. Taken from the generated SDK rather than written out again, so a
  column added to `schema.gql` reaches every consumer the moment the SDK is regenerated
*/
export type User = NonNullable<GetCurrentUserData['user']>

/*
  What the account page saves about the reader. The picture is a file to upload, null to remove
  the one there, or undefined to leave it as it is, since an unchanged picture is not sent again.
  The language is the account's and the interface's both
*/
export type UserProfile = {
  displayName: string
  image: Blob | null | undefined
  bio: string | null
  locale: Locale
}

/*
  One of the reader's memberships: an organization, and what they are in it. The role is why this
  is the join row rather than the organization on its own, the `_via_` relation Data Connect
  generates being typed `[Organization!]!` and so having nowhere to put it.

  Taken from the generated SDK rather than written out again, for the same reason `User` is. No
  `NonNullable` here though: `userOrganizations` is a list rather than a row lookup, so it is never
  null, only empty
*/
export type UserOrganization = GetCurrentUserOrganizationsData['userOrganizations'][number]

export type Organization = UserOrganization['organization']

/*
  What the profile page saves about an organization, all of it at once: the color null for the
  default, and the brief null for none. The pictures are not here, since each is a file sent on
  its own
*/
export type OrganizationDetails = {
  name: string
  color: string | null
  brief: string | null
  isPublic: boolean
}

/*
  An organization's people as the team page reads them: its members, and the invitations still
  waiting for an answer. From the generated SDK, like the types above
*/
export type OrganizationTeam = GetOrganizationTeamData

// One member: what they may do, what they do, and who they are
export type OrganizationMember = OrganizationTeam['userOrganizations'][number]

// An invitation as its addressee reads it: the organization, and who sent it
export type OrganizationInvitation = GetOrganizationInvitationData['organizationInvitations'][number]

// An account as the administration's users page lists it, with the organizations it belongs to
export type AdministrationUser = GetAdministrationUsersData['users'][number]

// An organization as the administration's organizations page lists it, with its member count
export type AdministrationOrganization = GetAdministrationOrganizationsData['organizations'][number]

/*
  A picture chosen but not saved yet: undefined while nothing was chosen, null once the one there
  is to be removed, or the file with an object URL that previews it
*/
export type StagedImage = {
  blob: Blob
  url: string
} | null | undefined

// How the reader's own Today page lists the team's priorities: the order they chose, and whom they
// hid, both as user ids
export type TodayPreferences = NonNullable<GetTodayPreferencesData['userOrganization']>

// One of the reader's task lists, with how many of its tasks are still open
export type TaskList = GetTaskListsData['taskLists'][number]

// One task on a list, where it sits in it, and whether it is done
export type Task = GetTasksData['tasks'][number]

// Somebody's checklist as the Today page opens it: who they are, their columns with the last week
// of ticks, and how far back their ticks go
export type Checklist = GetChecklistData

// One column of a checklist, a habit, with the days it was ticked that the page has read
export type ChecklistItem = GetChecklistData['checklistItems'][number]

// One entry of an organization's log, by the id of whoever wrote it
export type LogEntry = GetOrganizationLogData['logEntries'][number]
