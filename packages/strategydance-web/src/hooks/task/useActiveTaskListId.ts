import usePersistedState from '~hooks/common/usePersistedState'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

/*
  The task list the reader last opened in the current organization, kept in the browser so it is
  open again on their next visit. An id that names no list any more, one deleted elsewhere, is
  left for the page to pass over.

  The key follows the organization, and the Today page is mounted anew for each organization, so
  the state it starts from is always that organization's
*/
function useActiveTaskListId() {
  const { organization } = useCurrentOrganization()

  return usePersistedState<string | null>(`activeTaskList:${organization?.id ?? 'none'}`, null)
}

export default useActiveTaskListId
