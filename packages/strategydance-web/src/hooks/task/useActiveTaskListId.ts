import useAuthentication from '~hooks/authentication/useAuthentication'
import usePersistedState from '~hooks/common/usePersistedState'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

/*
  The task list the reader last opened in the current organization, kept in the browser so it is
  open again on their next visit. An id that names no list any more, one deleted elsewhere, is
  left for the page to pass over.

  The key follows the reader and the organization, and the Today page is mounted anew for each
  organization and behind each sign-in, so the state it starts from is always that reader's in
  that organization
*/
function useActiveTaskListId() {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  return usePersistedState<string | null>(`activeTaskList:${viewer?.uid ?? 'none'}:${organization?.id ?? 'none'}`, null)
}

export default useActiveTaskListId
