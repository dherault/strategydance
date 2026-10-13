import { describe, expect, it } from 'bun:test'

import {
  DIRECTORIES,
  DIRECTORY_BUSINESS_MODEL_PRECEDENCE,
  DirectoryBusinessModel,
  DirectoryInactiveReason,
  DirectoryType,
  INACTIVE_DIRECTORIES,
} from './index'

const DIRECTORY_KEYS = [
  'name',
  'type',
  'rootUrl',
  'submissionUrl',
  'description',
  'businessModel',
  'lastChecked',
  'unreachableSince',
]

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// The files as they are on disk, besides the lists parsed from them
const directoriesText = await Bun.file(new URL('./directories.json', import.meta.url)).text()
const inactiveDirectoriesText = await Bun.file(new URL('./inactiveDirectories.json', import.meta.url)).text()

const LISTS = [
  { name: 'DIRECTORIES', directories: DIRECTORIES, text: directoriesText, keys: DIRECTORY_KEYS },
  {
    name: 'INACTIVE_DIRECTORIES',
    directories: INACTIVE_DIRECTORIES,
    text: inactiveDirectoriesText,
    keys: [...DIRECTORY_KEYS, 'inactiveReason'],
  },
]

const ALL_DIRECTORIES = [...DIRECTORIES, ...INACTIVE_DIRECTORIES]

describe.each(LISTS)('$name', ({ directories, text, keys }) => {
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
    for (const directory of directories) expect(Object.keys(directory)).toEqual(keys)
  })

  it('dates its checks by the day', () => {
    for (const directory of directories) {
      if (directory.lastChecked !== null) expect(directory.lastChecked).toMatch(DAY_PATTERN)
      if (directory.unreachableSince !== null) expect(directory.unreachableSince).toMatch(DAY_PATTERN)
    }
  })

  it('roots each website at the origin it is submitted to', () => {
    for (const directory of directories) {
      const submissionUrl = new URL(directory.submissionUrl)

      expect(['http:', 'https:']).toContain(submissionUrl.protocol)

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

    expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })))
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
// and whatever checks them never checks or moves one twice
describe('both lists', () => {
  it('list each directory once', () => {
    const names = ALL_DIRECTORIES.map(({ name }) => name.toLowerCase())
    const submissionUrls = ALL_DIRECTORIES.map(({ submissionUrl }) => submissionUrl)
    const websiteRootUrls = ALL_DIRECTORIES.filter(({ type }) => type === DirectoryType.WEBSITE).map(
      ({ rootUrl }) => rootUrl,
    )

    expect(new Set(names).size).toBe(names.length)
    expect(new Set(submissionUrls).size).toBe(submissionUrls.length)
    expect(new Set(websiteRootUrls).size).toBe(websiteRootUrls.length)
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
