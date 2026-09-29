import { useIntl } from 'react-intl'

import useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'

import BuildInPublicChecklist from '~components/buildInPublic/BuildInPublicChecklist'
import BuildInPublicLog from '~components/buildInPublic/BuildInPublicLog'
import BuildInPublicPriority from '~components/buildInPublic/BuildInPublicPriority'
import BuildInPublicStreak from '~components/buildInPublic/BuildInPublicStreak'
import BuildInPublicTasks from '~components/buildInPublic/BuildInPublicTasks'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'
import navigationMessages from '~data/intl/messages/navigation'

/*
  Cards drawn from what the reader does, to post as pictures: their streak, their top priority,
  their tasks, their checklist, the team's log and the organization. Each card is read from the
  same data the Today page writes, and the reader's settings for them stay in their browser
*/
function BuildInPublic() {
  const { formatMessage } = useIntl()
  const settings = useBuildInPublicSettings()

  return (
    <ContainerLayout className="gap-10">
      <PageHeader
        eyebrow={formatMessage(buildInPublicMessages.eyebrow)}
        title={formatMessage(navigationMessages.buildInPublic)}
        lead={formatMessage(buildInPublicMessages.lead)}
      />
      <BuildInPublicStreak settings={settings} />
      <BuildInPublicPriority settings={settings} />
      <BuildInPublicTasks settings={settings} />
      <BuildInPublicChecklist settings={settings} />
      <BuildInPublicLog settings={settings} />
    </ContainerLayout>
  )
}

export default BuildInPublic
