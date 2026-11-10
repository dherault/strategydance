import { createFileRoute, notFound } from '@tanstack/react-router'
import { KNOWLEDGE_ID_PATTERN } from 'strategydance-knowledge/src/constants'

import useCloseDirectory from '~hooks/directory/useCloseDirectory'

import DirectoryBouncer from '~components/directory/DirectoryBouncer'
import DirectoryDialog from '~components/directory/DirectoryDialog'

export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/directories/$directoryId')({
  beforeLoad: ({ params }) => {
    if (!KNOWLEDGE_ID_PATTERN.test(params.directoryId)) throw notFound()
  },
  component: DirectoryRoute,
})

/*
  A directory, open in its dialog over the Directories page, under the page's waiter, at an address
  of its id, which never changes. An address naming no directory open to a submission today is a
  page that does not exist. The dialog is keyed by the directory, so opening another starts it anew
*/
function DirectoryRoute() {
  const { directoryId } = Route.useParams()
  const close = useCloseDirectory()

  return (
    <DirectoryBouncer directoryId={directoryId}>
      {directory => (
        <DirectoryDialog
          key={directory.id}
          directory={directory}
          onClose={close}
        />
      )}
    </DirectoryBouncer>
  )
}
