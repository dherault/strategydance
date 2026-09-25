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

// What inviting people to an organization answers with: who was invited, and who could not be
// because somebody invited them in the meantime
export type InviteOrganizationMembersData = {
  invitedEmails: string[]
  failedEmails: string[]
}
