import type { Directory } from 'strategydance-knowledge/src/directories/types'

import type { DirectoryState } from '~types'

/*
  The directories to do that the Marketing aspect's section suggests next, `count` at most, as the
  design ranks them: one the daily check described before one it has not read, a free one before one
  with a catch, and those before a paid one or one whose pricing nobody knows, a site the check could
  not reach lately last of all. Among equals, the most lately checked first, then the catalogue's
  order, by name
*/
function rankNextDirectories(
  directories: readonly Directory[],
  states: ReadonlyMap<string, DirectoryState>,
  count: number,
) {
  return directories
    .filter(directory => !states.get(directory.id)?.status)
    .map((directory, index) => ({ directory, index, rank: rank(directory) }))
    .sort(
      (a, b) =>
        a.rank - b.rank
        || (b.directory.lastChecked ?? '').localeCompare(a.directory.lastChecked ?? '')
        || a.index - b.index,
    )
    .slice(0, count)
    .map(({ directory }) => directory)
}

function rank(directory: Directory) {
  const description = directory.description ? 0 : 4
  const pricing =
    directory.businessModel === 'FREE'
      ? 0
      : directory.businessModel === 'PAID' || directory.businessModel === 'UNKNOWN'
        ? 2
        : 1
  const reach = directory.unreachableSince ? 10 : 0

  return description + pricing + reach
}

export default rankNextDirectories
