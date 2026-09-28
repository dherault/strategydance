import { useIntl } from 'react-intl'

import PageHeader from '~components/layout/PageHeader'

import navigationMessages from '~data/intl/messages/navigation'

type Props = {
  title: string
  // Null when there is nothing to count, because the list could not be read
  lead: string | null
}

// An administration page's title, under the section's name, and a line about what it lists
function AdministrationHeader({ title, lead }: Props) {
  const { formatMessage } = useIntl()

  return (
    <PageHeader
      eyebrow={formatMessage(navigationMessages.administration)}
      title={title}
      lead={lead}
    />
  )
}

export default AdministrationHeader
