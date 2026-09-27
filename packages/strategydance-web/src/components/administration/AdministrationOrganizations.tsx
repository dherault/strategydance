import { useIntl } from 'react-intl'

import useAdministrationOrganizations from '~hooks/administration/useAdministrationOrganizations'

import AdministrationHeader from '~components/administration/AdministrationHeader'
import AdministrationLoadFailed from '~components/administration/AdministrationLoadFailed'
import AdministrationOrganizationsTable from '~components/administration/AdministrationOrganizationsTable'
import ContainerLayout from '~components/layout/ContainerLayout'

import administrationMessages from '~data/intl/messages/administration'
import navigationMessages from '~data/intl/messages/navigation'

// Every organization on Strategy Dance, newest first, for its administrators
function AdministrationOrganizations() {
  const { formatMessage } = useIntl()
  const { data: organizations, loading, refetch, hasFailed } = useAdministrationOrganizations()

  return (
    <ContainerLayout className="gap-8">
      <AdministrationHeader
        title={formatMessage(navigationMessages.administrationOrganizations)}
        lead={hasFailed ? null : formatMessage(administrationMessages.organizationsLead, { count: organizations.length })}
      />
      {hasFailed
        ? (
            <AdministrationLoadFailed
              message={formatMessage(administrationMessages.organizationsLoadError)}
              isRetrying={loading}
              onRetry={refetch}
            />
          )
        : (
            <AdministrationOrganizationsTable organizations={organizations} />
          )}
    </ContainerLayout>
  )
}

export default AdministrationOrganizations
