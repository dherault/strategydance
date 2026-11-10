import type { DirectoriesView, DirectoryState } from '~types'

import toDirectoriesView from '~utils/directory/toDirectoriesView'

/*
  How many of the directories each of the page's tabs holds: each status's, those to do, and every
  one. The directories given are the release's open list alone, so a status kept for an inactive
  directory counts nowhere
*/
function countDirectoryStatuses(directories: readonly { id: string }[], states: ReadonlyMap<string, DirectoryState>) {
  const counts: Record<DirectoriesView, number> = {
    todo: 0,
    submitted: 0,
    listed: 0,
    dismissed: 0,
    all: directories.length,
  }

  for (const { id } of directories) counts[toDirectoriesView(states.get(id)?.status ?? null)]++

  return counts
}

export default countDirectoryStatuses
