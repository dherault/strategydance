import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'

import AspectDocuments from '~components/document/AspectDocuments'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'

import aspectMessages from '~data/intl/aspectMessages'
import aspectPunchlineMessages from '~data/intl/aspectPunchlineMessages'

type Props = {
  aspect: CompanyAspect
}

// One aspect of the company: its name under its motto, then what the team knows about it
function AspectPage({ aspect }: Props) {
  const { formatMessage } = useIntl()

  return (
    <ContainerLayout className="gap-8">
      <PageHeader
        eyebrow={formatMessage(aspectPunchlineMessages[aspect])}
        title={formatMessage(aspectMessages[aspect])}
      />
      <AspectDocuments aspect={aspect} />
    </ContainerLayout>
  )
}

export default AspectPage
