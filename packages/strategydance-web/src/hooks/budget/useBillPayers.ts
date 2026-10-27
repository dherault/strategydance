import { useIntl } from 'react-intl'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useBills from '~hooks/budget/useBills'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import listBillPayers from '~utils/budget/listBillPayers'

/*
  Who pays the organization's bills: its members, live, then whoever a bill names who has left the
  organization since, the reader marked among them. The team is not waited on, as no Budget page
  waits on it, so until it lands the members are those the bills name
*/
function useBillPayers() {
  const { locale } = useIntl()
  const { data: viewer } = useAuthentication()
  const { data: team } = useOrganizationTeam()
  const { data: bills } = useBills()

  return listBillPayers(team.userOrganizations, bills, viewer?.uid ?? null, locale)
}

export default useBillPayers
