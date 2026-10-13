import type { Directory, InactiveDirectory } from 'strategydance-directories'

import type { DirectoryLists } from '~types'

/*
  The text of the directories package's two files: each list sorted by name, as its test holds it,
  each entry's fields in the type's order, so a moved entry keeps its lines, and the JSON written as
  `JSON.stringify` writes it, which is how the formatter lays the files out
*/
function serializeDirectoryLists({ directories, inactiveDirectories }: DirectoryLists) {
  return {
    directoriesText: serialize(sortByName(directories).map(toDirectoryEntry)),
    inactiveDirectoriesText: serialize(
      sortByName(inactiveDirectories).map(directory => ({
        ...toDirectoryEntry(directory),
        inactiveReason: directory.inactiveReason,
      })),
    ),
  }
}

export function sortByName<T extends Directory>(directories: T[]) {
  return directories.toSorted((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
}

function toDirectoryEntry(directory: Directory | InactiveDirectory): Directory {
  return {
    name: directory.name,
    type: directory.type,
    rootUrl: directory.rootUrl,
    submissionUrl: directory.submissionUrl,
    description: directory.description,
    businessModel: directory.businessModel,
    lastChecked: directory.lastChecked,
    unreachableSince: directory.unreachableSince,
  }
}

function serialize(list: unknown[]) {
  return `${JSON.stringify(list, null, 2)}\n`
}

export default serializeDirectoryLists
