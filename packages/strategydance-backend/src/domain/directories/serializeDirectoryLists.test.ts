import { describe, expect, test } from 'bun:test'

import { DIRECTORY_FIELDS, INACTIVE_DIRECTORY_FIELDS } from 'strategydance-knowledge'

import { DIRECTORIES_FILE_PATH, INACTIVE_DIRECTORIES_FILE_PATH } from '~constants'

import readDirectoryLists from '~domain/directories/readDirectoryLists'
import serializeDirectoryLists from '~domain/directories/serializeDirectoryLists'

const REPOSITORY_ROOT = new URL('../../../../../', import.meta.url)

const directoriesText = await Bun.file(new URL(DIRECTORIES_FILE_PATH, REPOSITORY_ROOT)).text()
const inactiveDirectoriesText = await Bun.file(new URL(INACTIVE_DIRECTORIES_FILE_PATH, REPOSITORY_ROOT)).text()

describe('serializeDirectoryLists', () => {
  test('writes the package files back byte for byte', () => {
    const lists = readDirectoryLists(directoriesText, inactiveDirectoriesText)

    expect(serializeDirectoryLists(lists)).toEqual({ directoriesText, inactiveDirectoriesText })
  })

  test('sorts by name and writes each field in the type order', () => {
    const lists = readDirectoryLists(directoriesText, inactiveDirectoriesText)
    const [first, second] = lists.directories
    // The first one's fields in reverse
    const reversed = Object.fromEntries(Object.entries(first).reverse()) as typeof first
    const shuffled = { directories: [second, reversed], inactiveDirectories: [] }

    const { directoriesText: text } = serializeDirectoryLists(shuffled)

    expect(JSON.parse(text).map(({ name }: { name: string }) => name)).toEqual([first.name, second.name])
    expect(Object.keys(JSON.parse(text)[0])).toEqual([...DIRECTORY_FIELDS])
  })
})

describe('readDirectoryLists', () => {
  // So the reader and the package never disagree on what an entry holds
  test("refuses an entry without one of the package's fields", () => {
    const [entry] = JSON.parse(directoriesText)
    const [inactiveEntry] = JSON.parse(inactiveDirectoriesText)

    for (const field of DIRECTORY_FIELDS) {
      const { [field]: _, ...rest } = entry

      expect(() => readDirectoryLists(JSON.stringify([rest]), '[]')).toThrow()
    }

    for (const field of INACTIVE_DIRECTORY_FIELDS) {
      const { [field]: _, ...rest } = inactiveEntry

      expect(() => readDirectoryLists('[]', JSON.stringify([rest]))).toThrow()
    }
  })

  test('refuses a field it does not know', () => {
    const [entry] = JSON.parse(directoriesText)

    expect(() => readDirectoryLists(JSON.stringify([{ ...entry, newField: true }]), '[]')).toThrow()
  })

  test('refuses a category it does not know', () => {
    const [entry] = JSON.parse(directoriesText)

    expect(() => readDirectoryLists(JSON.stringify([{ ...entry, categories: ['GAMES'] }]), '[]')).toThrow()
  })

  test('refuses a business model it does not know', () => {
    const [entry] = JSON.parse(directoriesText)

    expect(() => readDirectoryLists(JSON.stringify([{ ...entry, businessModel: 'FREE_FOREVER' }]), '[]')).toThrow()
  })

  test('refuses a day that does not exist', () => {
    const [entry] = JSON.parse(directoriesText)

    expect(() => readDirectoryLists(JSON.stringify([{ ...entry, unreachableSince: '2026-99-99' }]), '[]')).toThrow()
  })

  test('refuses a day written otherwise', () => {
    const [entry] = JSON.parse(directoriesText)

    expect(() =>
      readDirectoryLists(JSON.stringify([{ ...entry, lastChecked: '2026-10-13T05:00:00Z' }]), '[]'),
    ).toThrow()
  })
})
