import { useQueryClient } from '@tanstack/react-query'

/*
  Reads the reader's account and organizations again, as a refusal saying their conversations are
  suspended asks: neither read is live, and the composer's notice reads from them whose suspension it
  is, the account's or the organization's
*/
function useRefreshConversationAccess() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ['GetCurrentUser'] }).catch(() => {})
    queryClient.invalidateQueries({ queryKey: ['GetCurrentUserOrganizations'] }).catch(() => {})
  }
}

export default useRefreshConversationAccess
