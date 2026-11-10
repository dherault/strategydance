import { useIntl } from 'react-intl'
import { CompanyAspect } from 'strategydance-database/web'

import AspectDirectories from '~components/directory/AspectDirectories'
import AspectDocuments from '~components/document/AspectDocuments'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'

import aspectMessages from '~data/intl/aspectMessages'
import aspectPunchlineMessages from '~data/intl/aspectPunchlineMessages'

type Props = {
  aspect: CompanyAspect
}

// One aspect of the company: its name under its motto, then what the team knows about it, and for
// Marketing the directories the product can be listed in
function AspectPage({ aspect }: Props) {
  const { formatMessage } = useIntl()

  return (
    <ContainerLayout className="gap-8">
      <PageHeader
        eyebrow={formatMessage(aspectPunchlineMessages[aspect])}
        title={formatMessage(aspectMessages[aspect])}
      />
      <AspectDocuments aspect={aspect} />
      {aspect === CompanyAspect.MARKETING ? <AspectDirectories /> : null}
    </ContainerLayout>
  )
}

export default AspectPage
