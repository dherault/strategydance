import { Outlet, createFileRoute } from '@tanstack/react-router'

import ConversationsReleaseBouncer from '~components/conversation/ConversationsReleaseBouncer'

export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/conversations')({
  component: ConversationsRoute,
})

/*
  Every page of the reader's conversations, behind the bouncer that keeps them to whoever may have
  them until they launch. Their catalogue is the app's, registered above, since the sidebar reads
  it on every page
*/
function ConversationsRoute() {
  return (
    <ConversationsReleaseBouncer>
      <Outlet />
    </ConversationsReleaseBouncer>
  )
}
