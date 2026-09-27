import { useIntl } from 'react-intl'

import useAdministrationUsers from '~hooks/administration/useAdministrationUsers'

import AdministrationHeader from '~components/administration/AdministrationHeader'
import AdministrationLoadFailed from '~components/administration/AdministrationLoadFailed'
import AdministrationUsersTable from '~components/administration/AdministrationUsersTable'
import ContainerLayout from '~components/layout/ContainerLayout'

import administrationMessages from '~data/intl/messages/administration'
import navigationMessages from '~data/intl/messages/navigation'

// Every account on Strategy Dance, newest first, for its administrators
function AdministrationUsers() {
  const { formatMessage } = useIntl()
  const { data: users, loading, refetch, hasFailed } = useAdministrationUsers()

  return (
    <ContainerLayout className="gap-8">
      <AdministrationHeader
        title={formatMessage(navigationMessages.administrationUsers)}
        lead={hasFailed ? null : formatMessage(administrationMessages.usersLead, { count: users.length })}
      />
      {hasFailed
        ? (
            <AdministrationLoadFailed
              message={formatMessage(administrationMessages.usersLoadError)}
              isRetrying={loading}
              onRetry={refetch}
            />
          )
        : (
            <AdministrationUsersTable users={users} />
          )}
    </ContainerLayout>
  )
}

export default AdministrationUsers
