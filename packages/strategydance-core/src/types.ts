/*
  The envelope every backend response is wrapped in, success and failure alike. Declared here
  because the backend writes it and the web app reads it, and a copy on each side would drift
*/

export type ApiSuccessResponse<T = void> = {
  status: 'success'
  data?: T
}

export type ApiErrorResponse = {
  status: 'error'
  code: string
  message: string
}

export type ApiResponse<T = void> = ApiSuccessResponse<T> | ApiErrorResponse

/* ---
  ORGANIZATIONS
--- */

/*
  Why an address was not invited: taken by another invitation or a membership in the meantime,
  no room left in the team, the inviter no longer administering it, or a failure on the server's
  side
*/
export type InvitationFailureReason = 'taken' | 'full' | 'forbidden' | 'error'

// What inviting people to an organization answers with: who was invited, and who was not and why.
// Some can go out while others do not, since each address is inserted on its own
export type InviteOrganizationMembersData = {
  invitedEmails: string[]
  failedEmails: {
    email: string
    reason: InvitationFailureReason
  }[]
}

// Which of an organization's pictures a request is about
export type OrganizationImageKind = 'logo' | 'banner'
