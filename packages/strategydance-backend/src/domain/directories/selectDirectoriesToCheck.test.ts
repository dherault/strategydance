import { describe, expect, test } from 'bun:test'

import { type Directory, DirectoryType, type InactiveDirectory } from 'strategydance-directories'

import selectDirectoriesToCheck from '~domain/directories/selectDirectoriesToCheck'
import { createDirectory, createInactiveDirectory } from '~domain/directories/testing/directoryFixtures'

const TODAY = '2026-10-20'

// A random source answering the values given, in turn, so a test decides what a shuffle does
function createRandom(...values: number[]) {
  let index = 0

  return () => values[index++ % values.length]
}

function select(directories: Directory[], inactiveDirectories: InactiveDirectory[] = [], count = 3) {
  return selectDirectoriesToCheck(
    { directories, inactiveDirectories },
    { count, inactiveCount: 1, today: TODAY, random: createRandom(0.5) },
  ).map(({ name }) => name)
}

describe('selectDirectoriesToCheck', () => {
  test('picks those never checked before those checked, the longest unchecked first', () => {
    expect(
      select([
        createDirectory('recent', { lastChecked: '2026-10-19' }),
        createDirectory('old', { lastChecked: '2026-09-01' }),
        createDirectory('never'),
        createDirectory('older', { lastChecked: '2026-08-01' }),
      ]),
    ).toEqual(['never', 'older', 'old'])
  })

  test('picks first a site unreachable long enough ago for another check to decide', () => {
    expect(
      select([
        createDirectory('never'),
        createDirectory('struck long ago', { lastChecked: '2026-10-16', unreachableSince: '2026-10-16' }),
        createDirectory('struck yesterday', { lastChecked: '2026-10-19', unreachableSince: '2026-10-19' }),
      ]),
    ).toEqual(['struck long ago', 'never', 'struck yesterday'])
  })

  test('skips Reddit communities and whatever was checked today', () => {
    expect(
      select([
        createDirectory('community', { type: DirectoryType.REDDIT_COMMUNITY }),
        createDirectory('today', { lastChecked: TODAY }),
        createDirectory('never'),
      ]),
    ).toEqual(['never'])
  })

  test('adds as many inactive websites as asked, never checked first', () => {
    expect(
      select(
        [createDirectory('active')],
        [
          createInactiveDirectory('checked', { lastChecked: '2026-09-01' }),
          createInactiveDirectory('never'),
          createInactiveDirectory('community', { type: DirectoryType.REDDIT_COMMUNITY }),
        ],
      ),
    ).toEqual(['active', 'never'])
  })

  test('picks at random among those tied', () => {
    const directories = ['a', 'b', 'c', 'd'].map(name => createDirectory(name))
    const picks = new Set<string>()

    for (const value of [0, 0.3, 0.6, 0.9]) {
      const [first] = selectDirectoriesToCheck(
        { directories, inactiveDirectories: [] },
        { count: 1, inactiveCount: 0, today: TODAY, random: createRandom(value) },
      )

      picks.add(first.name)
    }

    expect(picks.size).toBeGreaterThan(1)
  })
})
