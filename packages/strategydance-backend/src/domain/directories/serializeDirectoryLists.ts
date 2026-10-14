import { compareDirectoryNames } from 'strategydance-directories'

import type { DirectoryLists } from '~types'

import pickDirectoryFields, { pickInactiveDirectoryFields } from '~domain/directories/pickDirectoryFields'

/*
  The text of the directories package's two files: each list sorted by name, each entry's fields in
  the package's order, so a moved entry keeps its lines, and the JSON written as `JSON.stringify`
  writes it, which the formatter leaves alone in these two files. The package's tests hold the files
  to all three
*/
function serializeDirectoryLists({ directories, inactiveDirectories }: DirectoryLists) {
  return {
    directoriesText: serialize(directories.toSorted(compareDirectoryNames).map(pickDirectoryFields)),
    inactiveDirectoriesText: serialize(
      inactiveDirectories.toSorted(compareDirectoryNames).map(pickInactiveDirectoryFields),
    ),
  }
}

function serialize(list: unknown[]) {
  return `${JSON.stringify(list, null, 2)}\n`
}

export default serializeDirectoryLists
