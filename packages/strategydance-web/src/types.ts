import type { ReactNode } from 'react'
import type { Locale } from 'strategydance-core'
import type {
  CompanyAspect,
  GetAdministrationOrganizationsData,
  GetAdministrationUsersData,
  GetChecklistData,
  GetCurrentUserData,
  GetCurrentUserOrganizationsData,
  GetDocumentData,
  GetOrganizationDocumentsData,
  GetOrganizationInvitationData,
  GetOrganizationLogData,
  GetOrganizationTeamData,
  GetTaskListsData,
  GetTaskListSummariesData,
  GetTasksData,
  GetTodayPreferencesData,
} from 'strategydance-database/web'

import type { CARD_ACCENT_COLORS, MESSAGE_TYPES } from '~constants'

export type MessageType = (typeof MESSAGE_TYPES)[number]

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
  What the account page's form saves about the reader. The picture is not part of it: its dialog
  saves it on its own. The language is the account's and the interface's both
*/
export type UserProfile = {
  displayName: string
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

// A picture chosen and being saved, with an object URL that previews it, or undefined for none
export type StagedImage =
  | {
      blob: Blob
      url: string
    }
  | undefined

// How the reader's own Today page lists the team's priorities: the order they chose, and whom they
// hid, both as user ids
export type TodayPreferences = NonNullable<GetTodayPreferencesData['userOrganization']>

// One of the reader's task lists, with how many of its tasks are still open
export type TaskList = GetTaskListsData['taskLists'][number]

// One task on a list, where it sits in it, and whether it is done
export type Task = GetTasksData['tasks'][number]

// One of the reader's task lists as the build in public page reads it: its counts, and the few
// tasks its cards list
export type TaskListSummary = GetTaskListSummariesData['taskLists'][number]

// Somebody's checklist as the Today page opens it: who they are, their columns with the last week
// of ticks, and how far back their ticks go
export type Checklist = GetChecklistData

// One column of a checklist, a habit, with the days it was ticked that the page has read
export type ChecklistItem = GetChecklistData['checklistItems'][number]

// One entry of an organization's log, by the id of whoever wrote it
export type LogEntry = GetOrganizationLogData['logEntries'][number]

/*
  One document of an organization's knowledge as its lists read it: its title, aspects and when it
  last changed, without its content. Named apart from the DOM's `Document`, which a bare name would
  hide in every file that imports it
*/
export type KnowledgeDocumentSummary = GetOrganizationDocumentsData['documents'][number]

// One document whole, as its own page reads it once to seed the editor
export type KnowledgeDocument = GetDocumentData['documents'][number]

// What the document page saves of a document, each field by an operation of its own. The content
// is an empty string when there is no text, never an empty document
export type KnowledgeDocumentFields = {
  title: string
  content: string
  aspects: CompanyAspect[]
  isAiLocked: boolean
}

/*
  Where the document page's saving stands: nothing to save, a change waiting for the reader to
  pause, one on its way, one that failed and waits for the next try, content too long to send, or
  content refused because somebody else saved theirs first
*/
export type KnowledgeDocumentSaveStatus = 'idle' | 'pending' | 'saving' | 'error' | 'tooLong' | 'conflict'

// How a build in public card is laid out: 16:9, 1:1 or 4:5
export type CardFormat = 'landscape' | 'square' | 'portrait'

// What a build in public card is drawn on: the accent, a light tint of it, white, light gray or navy
export type CardTone = 'accent' | 'tint' | 'white' | 'neutral' | 'dark'

// The organization's own color, or one of the others a card's accent can take
export type CardAccent = 'organization' | keyof typeof CARD_ACCENT_COLORS

// The streak cards' flame: in the accent, or in the warm colors of a real one
export type FlameColor = 'organization' | 'warm'

// What the reader chose for one card, by field: one option's value, or several
export type CardValues = Record<string, string | string[]>

// One option of a card's field, its label a swatch or a truncated line where plain text is not enough
export type CardFieldOption = {
  value: string
  label: ReactNode
}

// One setting a card offers beside it: a pick of one option, or of several, up to `max`
export type CardField =
  | {
      kind: 'select'
      key: string
      label: string
      options: CardFieldOption[]
    }
  | {
      kind: 'multiSelect'
      key: string
      label: string
      options: CardFieldOption[]
      max?: number
    }

// The look every card shares once the reader picks one: what they are drawn on, and in which color
export type CardLook = {
  tone?: CardTone
  accent?: CardAccent
}

/*
  What the reader chose on the build in public page, kept in their browser: the look, the settings
  every card that has them shares, such as whose priority to show, and each card's own
*/
export type BuildInPublicSettings = {
  look: CardLook
  shared: CardValues
  cards: Record<string, CardValues>
}

// One day of a streak's week or calendar, `YYYY-MM-DD`, and whether it was active
export type StreakDay = {
  date: string
  isOn: boolean
  isToday: boolean
  isFuture: boolean
}
