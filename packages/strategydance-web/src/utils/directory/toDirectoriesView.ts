import type { DirectoryStatus } from 'strategydance-core'

import type { DirectoriesView } from '~types'

// The Directories page's tab a directory of that status sits in, To do for one with none
function toDirectoriesView(status: DirectoryStatus | null): Exclude<DirectoriesView, 'all'> {
  switch (status) {
    case 'SUBMITTED':
      return 'submitted'
    case 'LISTED':
      return 'listed'
    case 'DISMISSED':
      return 'dismissed'
    case null:
      return 'todo'
  }
}

export default toDirectoriesView
