import { notFound } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { Directory } from 'strategydance-knowledge/src/directories/types'

import useDirectories from '~hooks/directory/useDirectories'

type Props = {
  directoryId: string
  children: (directory: Directory) => ReactNode
}

/*
  Lets through an address naming one of the directories that take a submission today, under the
  Directories page's waiter, so the release's list is read by the time it judges. Any other, an
  inactive directory's included, which the app never shows, is a page that does not exist. While
  the list could not be read it shows nothing, the page under it saying so
*/
function DirectoryBouncer({ directoryId, children }: Props) {
  const { data: directories, hasFailed } = useDirectories()

  if (hasFailed) return null

  const directory = directories.find(({ id }) => id === directoryId)

  if (!directory) throw notFound()

  return children(directory)
}

export default DirectoryBouncer
