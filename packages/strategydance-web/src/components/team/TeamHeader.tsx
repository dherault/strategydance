import { UserPlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'

import PageHeader from '~components/layout/PageHeader'

import navigationMessages from '~data/intl/messages/navigation'
import teamMessages from '~data/intl/messages/team'

type Props = {
  // Null when the reader belongs to no organization, which leaves the lead out
  organizationName: string | null
  memberCount: number
  invitationCount: number
  // Null unless the reader administers the organization, which is who may invite
  onInvite: (() => void) | null
}

// The page's title, under a friendly label, how many people the team counts, and the way to invite
// more
function TeamHeader({ organizationName, memberCount, invitationCount, onInvite }: Props) {
  const { formatMessage } = useIntl()

  return (
    <PageHeader
      eyebrow={formatMessage(teamMessages.eyebrow)}
      title={formatMessage(navigationMessages.team)}
      lead={organizationName ? formatMessage(teamMessages.lead, { memberCount, invitationCount, organizationName }) : null}
      actions={onInvite
        ? (
            <Button
              icon={<UserPlusIcon />}
              onClick={onInvite}
            >
              {formatMessage(teamMessages.invite)}
            </Button>
          )
        : null}
    />
  )
}

export default TeamHeader
