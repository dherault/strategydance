import { type Directory, DirectoryType, type InactiveDirectory } from 'strategydance-directories'

import type { DirectoryLists } from '~types'

import countDaysBetween from '~domain/directories/countDaysBetween'
import { DIRECTORY_UNREACHABLE_DAYS } from '~domain/directories/directoryCheckSettings'

type Options = {
  // How many active directories, and how many inactive ones, to pick
  count: number
  inactiveCount: number
  // The UTC day of the run, YYYY-MM-DD
  today: string
  random?: () => number
}

/*
  The directories a run checks: websites only, since Reddit answers a bot's GET with a 403 whatever
  the community, and none checked today, so a run started again the same day picks others.

  Of the active ones, those a check could not reach long enough ago for another to decide come
  first, then those never checked, then the longest unchecked, at random within each, so every
  directory is checked in turn and a run's picks are not always neighbours. Then as many inactive
  ones, never checked first, then the longest unchecked, so a site moved by mistake comes back
*/
function selectDirectoriesToCheck(
  { directories, inactiveDirectories }: DirectoryLists,
  { count, inactiveCount, today, random = Math.random }: Options,
): (Directory | InactiveDirectory)[] {
  const isCandidate = (directory: Directory) =>
    directory.type === DirectoryType.WEBSITE && directory.lastChecked !== today
  const isDue = (directory: Directory) =>
    directory.unreachableSince !== null
    && countDaysBetween(directory.unreachableSince, today) >= DIRECTORY_UNREACHABLE_DAYS
  const candidates = directories.filter(isCandidate)
  const due = shuffle(candidates.filter(isDue), random)
  const rest = candidates.filter(directory => !isDue(directory))

  return [
    ...[...due, ...byLastChecked(rest, random)].slice(0, count),
    ...byLastChecked(inactiveDirectories.filter(isCandidate), random).slice(0, inactiveCount),
  ]
}

// Never checked first, then the longest unchecked, at random among those checked the same day
function byLastChecked<T extends Directory>(directories: T[], random: () => number) {
  return shuffle(directories, random).toSorted((a, b) => {
    if (a.lastChecked === b.lastChecked) return 0
    if (a.lastChecked === null) return -1
    if (b.lastChecked === null) return 1

    return a.lastChecked < b.lastChecked ? -1 : 1
  })
}

function shuffle<T>(items: T[], random: () => number) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))

    ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
  }

  return shuffled
}

export default selectDirectoriesToCheck
