import { Link } from '@tanstack/react-router'
import { useIntl } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'
import { cn } from 'strategydance-design-system/lib/utils'

import useAuthentication from '~hooks/authentication/useAuthentication'

import invitationMessages from '~data/intl/messages/invitation'

/*
  What the invitation page says when there is nothing to answer. It names the address the reader
  is signed in with, since an invitation sent to their other address is the likeliest reason
*/
function OrganizationInvitationMissing() {
  const { formatMessage } = useIntl()
  const { data: viewer } = useAuthentication()

  return (
    <>
      <h1 className="m-0 text-5xl leading-[1.05]">
        {formatMessage(invitationMessages.missingTitle)}
      </h1>
      <p className="m-0 max-w-xl text-base leading-[1.6] text-pretty text-muted-foreground">
        {formatMessage(invitationMessages.missingLead, { email: viewer?.email ?? '' })}
      </p>
      <div>
        {/* Through `cn`, as the Button does it: the outline border and the base's transparent one
            both come out of `buttonVariants`, and only merging keeps the right one */}
        <Link
          to="/-"
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          {formatMessage(invitationMessages.continue)}
        </Link>
      </div>
    </>
  )
}

export default OrganizationInvitationMissing
