import { useIntl } from 'react-intl'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import type { Directory } from 'strategydance-knowledge/src/directories/types'

import type { DirectoryStatusChoice } from '~types'

import useDirectoryChanges from '~hooks/directory/useDirectoryChanges'

import directoryMessages from '~data/intl/messages/directory'

/*
  Sets where the organization stands with a directory, as its dialog's select does, and says so
  once the server has it, "Devhunt marked submitted", or that it did not go through, the page
  showing the status the server keeps by then
*/
function useSetDirectoryStatus() {
  const { formatMessage } = useIntl()
  const { setStatus } = useDirectoryChanges()

  return async function setDirectoryStatus(directory: Pick<Directory, 'id' | 'name'>, choice: DirectoryStatusChoice) {
    const status = choice === 'TO_DO' ? null : choice

    try {
      await setStatus(directory.id, status)

      toast.success(
        status === null
          ? formatMessage(directoryMessages.movedToDo, { name: directory.name })
          : formatMessage(directoryMessages.markedStatus, { name: directory.name, status }),
      )
    } catch (error) {
      console.error("Failed to save a directory's status", error)

      toast.error(formatMessage(directoryMessages.statusSaveError))
    }
  }
}

export default useSetDirectoryStatus
