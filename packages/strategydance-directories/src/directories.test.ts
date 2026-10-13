import { describe, expect, it } from 'bun:test'

import {
  compareDirectoryNames,
  DIRECTORIES,
  DIRECTORY_BUSINESS_MODEL_PRECEDENCE,
  DIRECTORY_FIELDS,
  DIRECTORY_ID_PATTERN,
  DirectoryBusinessModel,
  DirectoryCategory,
  DirectoryInactiveReason,
  DirectoryType,
  INACTIVE_DIRECTORIES,
  INACTIVE_DIRECTORY_FIELDS,
  isDirectoryCategoryListValid,
  MAX_DIRECTORY_DESCRIPTION_LENGTH,
} from './index'

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// The files as they are on disk, besides the lists parsed from them
const directoriesText = await Bun.file(new URL('./directories.json', import.meta.url)).text()
const inactiveDirectoriesText = await Bun.file(new URL('./inactiveDirectories.json', import.meta.url)).text()

const LISTS = [
  { name: 'DIRECTORIES', directories: DIRECTORIES, text: directoriesText, fields: DIRECTORY_FIELDS },
  {
    name: 'INACTIVE_DIRECTORIES',
    directories: INACTIVE_DIRECTORIES,
    text: inactiveDirectoriesText,
    fields: INACTIVE_DIRECTORY_FIELDS,
  },
]

const ALL_DIRECTORIES = [...DIRECTORIES, ...INACTIVE_DIRECTORIES]

describe.each(LISTS)('$name', ({ directories, text, fields }) => {
  // Each once, in the enum's order, as the check writes them, so the same categories read the same
  it('holds only known categories, each once, in order, ANY_STARTUP beside no kind', () => {
    for (const { categories } of directories) expect(isDirectoryCategoryListValid(categories)).toBe(true)
  })

  it('holds only known types and business models', () => {
    const types: string[] = Object.values(DirectoryType)
    const businessModels: string[] = Object.values(DirectoryBusinessModel)

    for (const directory of directories) {
      expect(types).toContain(directory.type)
      expect(businessModels).toContain(directory.businessModel)
    }
  })

  // The JSON is cast to its type, which would let an entry without a field through
  it('gives every entry exactly its fields, in order', () => {
    for (const directory of directories) expect(Object.keys(directory)).toEqual([...fields])
  })

  // Days that exist and have come, in UTC, as a check dates what it did
  it('dates its checks by the day', () => {
    const today = new Date().toISOString().slice(0, 10)

    for (const directory of directories) {
      for (const day of [directory.lastChecked, directory.unreachableSince]) {
        if (day === null) continue

        expect(day).toMatch(DAY_PATTERN)
        expect(new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10)).toBe(day)
        expect(day <= today).toBe(true)
      }
    }
  })

  // The first check that could not reach a site dated the entry too, and later ones only move on
  it('counts a site unreachable only from a day it was checked', () => {
    for (const { lastChecked, unreachableSince } of directories) {
      if (unreachableSince !== null) expect(unreachableSince <= (lastChecked ?? '')).toBe(true)
    }
  })

  it('identifies each entry by a slug', () => {
    for (const { id } of directories) expect(id).toMatch(DIRECTORY_ID_PATTERN)
  })

  it('names each entry without spaces around its name', () => {
    for (const { name } of directories) {
      expect(name).not.toBe('')
      expect(name).toBe(name.trim())
    }
  })

  // One sentence, as the check writes it
  it('describes each entry in a line', () => {
    for (const { description } of directories) {
      expect(description.length).toBeLessThanOrEqual(MAX_DIRECTORY_DESCRIPTION_LENGTH)
      expect(description).not.toContain('\n')
      expect(description).toBe(description.trim())
    }
  })

  it('roots each website at the origin it is submitted to', () => {
    for (const directory of directories) {
      const submissionUrl = new URL(directory.submissionUrl)

      expect(['http:', 'https:']).toContain(submissionUrl.protocol)
      // A fragment never reaches the site, so it only makes a second address of one page
      expect(submissionUrl.hash).toBe('')
      expect(submissionUrl.username).toBe('')
      expect(submissionUrl.password).toBe('')

      if (directory.type === DirectoryType.WEBSITE) expect(directory.rootUrl).toBe(`${submissionUrl.origin}/`)
    }
  })

  it('roots each Reddit community at its own page', () => {
    for (const directory of directories.filter(({ type }) => type === DirectoryType.REDDIT_COMMUNITY)) {
      expect(directory.rootUrl).toMatch(/^https:\/\/www\.reddit\.com\/r\/\w+\/$/)
      expect(directory.submissionUrl.startsWith(directory.rootUrl)).toBe(true)
    }
  })

  // In order, so an entry added by hand or by a script lands where a reader looks for it
  it('is sorted by name', () => {
    const names = directories.map(({ name }) => name)

    expect(names).toEqual(directories.toSorted(compareDirectoryNames).map(({ name }) => name))
  })

  // As a script writes it, which is also how the formatter lays it out, so a written file passes the lint
  it('is written as JSON.stringify writes it', () => {
    expect(text).toBe(`${JSON.stringify(directories, null, 2)}\n`)
  })
})

describe('INACTIVE_DIRECTORIES', () => {
  it('holds only known reasons', () => {
    const reasons: string[] = Object.values(DirectoryInactiveReason)

    for (const directory of INACTIVE_DIRECTORIES) expect(reasons).toContain(directory.inactiveReason)
  })
})

// One entry per directory across both lists, so a directory is never active and inactive at once,
// whatever checks them never checks or moves one twice, and an id names one directory alone
describe('both lists', () => {
  it('list each directory once', () => {
    const ids = ALL_DIRECTORIES.map(({ id }) => id)
    const names = ALL_DIRECTORIES.map(({ name }) => name.toLowerCase())
    const submissionUrls = ALL_DIRECTORIES.map(({ submissionUrl }) => submissionUrl)
    const websiteRootUrls = ALL_DIRECTORIES.filter(({ type }) => type === DirectoryType.WEBSITE).map(
      ({ rootUrl }) => rootUrl,
    )

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
    expect(new Set(submissionUrls).size).toBe(submissionUrls.length)
    expect(new Set(websiteRootUrls).size).toBe(websiteRootUrls.length)
  })
})

describe('isDirectoryCategoryListValid', () => {
  it('takes known categories, each once, in the enum order', () => {
    expect(isDirectoryCategoryListValid([])).toBe(true)
    expect(isDirectoryCategoryListValid([DirectoryCategory.AI_TOOLS, DirectoryCategory.SAAS])).toBe(true)
    expect(isDirectoryCategoryListValid([DirectoryCategory.SAAS, DirectoryCategory.AI_TOOLS])).toBe(false)
    expect(isDirectoryCategoryListValid([DirectoryCategory.SAAS, DirectoryCategory.SAAS])).toBe(false)
    expect(isDirectoryCategoryListValid(['GAMES'])).toBe(false)
    expect(isDirectoryCategoryListValid([DirectoryCategory.AI_TOOLS, 'GAMES'])).toBe(false)
  })

  it('takes ANY_STARTUP beside REGIONAL alone', () => {
    expect(isDirectoryCategoryListValid([DirectoryCategory.ANY_STARTUP, DirectoryCategory.REGIONAL])).toBe(true)
    expect(isDirectoryCategoryListValid([DirectoryCategory.ANY_STARTUP, DirectoryCategory.AI_TOOLS])).toBe(false)
    expect(isDirectoryCategoryListValid([DirectoryCategory.SAAS, DirectoryCategory.REGIONAL])).toBe(true)
  })
})

describe('DIRECTORY_BUSINESS_MODEL_PRECEDENCE', () => {
  // Every model a directory with a free path can take, once, beside the two that have none
  it('orders every model but PAID and UNKNOWN, once', () => {
    const models: string[] = [
      ...DIRECTORY_BUSINESS_MODEL_PRECEDENCE,
      DirectoryBusinessModel.PAID,
      DirectoryBusinessModel.UNKNOWN,
    ]

    expect(models.toSorted()).toEqual(Object.values(DirectoryBusinessModel).toSorted())
  })
})
