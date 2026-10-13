import { describe, expect, test } from 'bun:test'

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
    expect(Object.keys(JSON.parse(text)[0])).toEqual([
      'name',
      'type',
      'rootUrl',
      'submissionUrl',
      'description',
      'businessModel',
      'lastChecked',
      'unreachableSince',
    ])
  })
})

describe('readDirectoryLists', () => {
  test('refuses a field it does not know', () => {
    const [entry] = JSON.parse(directoriesText)

    expect(() => readDirectoryLists(JSON.stringify([{ ...entry, newField: true }]), '[]')).toThrow()
  })

  test('refuses a business model it does not know', () => {
    const [entry] = JSON.parse(directoriesText)

    expect(() => readDirectoryLists(JSON.stringify([{ ...entry, businessModel: 'FREE_FOREVER' }]), '[]')).toThrow()
  })

  test('refuses a day written otherwise', () => {
    const [entry] = JSON.parse(directoriesText)

    expect(() =>
      readDirectoryLists(JSON.stringify([{ ...entry, lastChecked: '2026-10-13T05:00:00Z' }]), '[]'),
    ).toThrow()
  })
})
