import type { GetCurrentUserData, GetCurrentUserOrganizationsData } from 'strategydance-database/web'

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
  One row of the join table, which is where the role lives: the `_via_` relation Data Connect
  generates is typed `[Organization!]!` and has nowhere to put the join row's own columns. So what
  the context holds is a list of memberships, each carrying the organization it is a membership of.

  Taken from the generated SDK rather than written out again, for the same reason `User` is. No
  `NonNullable` here though: `organizationUsers` is a list rather than a row lookup, so it is never
  null, only empty
*/
export type OrganizationMembership = GetCurrentUserOrganizationsData['organizationUsers'][number]

export type Organization = OrganizationMembership['organization']
