import { Outlet, createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import parseDirectoriesSearch from '~utils/directory/parseDirectoriesSearch'

import DirectoriesPage from '~components/directory/DirectoriesPage'
import DirectoriesWait from '~components/directory/DirectoriesWait'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// At module scope so the reference is stable across renders. The aspect's for the Marketing motto
const DIRECTORIES_MESSAGE_TYPES: MessageType[] = ['directory', 'aspect']

export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/directories')({
  validateSearch: parseDirectoriesSearch,
  component: DirectoriesRoute,
})

/*
  The current organization's directories, under the Marketing aspect though not under its address,
  on the tab the address names, and under it the directory opened from it, whose dialog lies over
  the page rather than replacing it. The waiter is keyed by the organization, so switching
  organizations mounts the page anew
*/
function DirectoriesRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={DIRECTORIES_MESSAGE_TYPES}>
      <DirectoriesWait key={organization?.id ?? 'none'}>
        <DirectoriesPage />
        <Outlet />
      </DirectoriesWait>
    </IntlMessagesRegistration>
  )
}
