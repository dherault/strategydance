import { UserPlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'

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

// The page's title, under the sidebar group it sits in, how many people the team counts, and the
// way to invite more
function TeamHeader({ organizationName, memberCount, invitationCount, onInvite }: Props) {
  const { formatMessage } = useIntl()

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-3">
        <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {formatMessage(navigationMessages.company)}
        </p>
        <h1 className="m-0 text-5xl leading-[1.05]">
          {formatMessage(navigationMessages.team)}
        </h1>
        {organizationName
          ? (
              <p className="m-0 text-base leading-[1.6] text-muted-foreground">
                {formatMessage(teamMessages.lead, { memberCount, invitationCount, organizationName })}
              </p>
            )
          : null}
      </div>
      {onInvite
        ? (
            <Button
              icon={<UserPlusIcon />}
              onClick={onInvite}
            >
              {formatMessage(teamMessages.invite)}
            </Button>
          )
        : null}
    </header>
  )
}

export default TeamHeader
